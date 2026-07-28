# UserNotification cleanup

저장소에는 API용 Cloud Run 배포 파일이 없으므로, 이 구성은 배포 중인 API
이미지를 재사용해 별도 Cloud Run Job으로 실행한다. 공개 HTTP cleanup
엔드포인트는 만들지 않는다.

정리 작업은 실행 시각을 기준으로 `availableAt`이 180일보다 오래된
`UserNotification`을 삭제한다. `deleteMany` 기반이라 같은 작업을 다시 실행해도
안전하다.

## 로컬 실행

API 빌드 후 배포 환경과 같은 명령을 실행한다.

```bash
pnpm --filter api build
DATABASE_URL="mongodb://..." pnpm --filter api notifications:cleanup
```

개발 중에는 빌드 없이 실행할 수 있다.

```bash
DATABASE_URL="mongodb://..." pnpm --filter api notifications:cleanup:dev
```

보존 기간을 바꿔 검증하려면 양의 정수 일수를 지정한다.

```bash
USER_NOTIFICATION_RETENTION_DAYS=180 \
DATABASE_URL="mongodb://..." \
pnpm --filter api notifications:cleanup:dev
```

성공 로그에는 기준 시각과 삭제 건수가 JSON으로 출력된다. 실패 시 프로세스가
0이 아닌 종료 코드로 끝나 Cloud Run Job 실행 실패로 기록된다.

## Cloud Run Job과 Scheduler 배포

API 이미지는 `pnpm --filter api build` 결과와 프로덕션 의존성을 포함하고,
컨테이너 작업 디렉터리에서 `dist/jobs/cleanupNotifications.js`에 접근할 수 있어야
한다. 저장소의 기존 API 시작 명령도 `dist/server.js`를 기준으로 한다.
API 이미지의 작업 디렉터리가 모노레포 루트라면 배포할 때
`CLEANUP_ENTRYPOINT="apps/api/dist/jobs/cleanupNotifications.js"`로 경로를
덮어쓴다.

Job 배포 전에 운영 환경의 기존 스키마 배포 절차로 최신 Prisma 스키마를
반영하고, `UserNotification.availableAt` 단일 인덱스가 생성되었는지 확인한다.

먼저 MongoDB 연결 문자열을 Secret Manager에 준비한다.

```bash
gcloud secrets create routeone-database-url \
  --project="PROJECT_ID" \
  --replication-policy="automatic"

printf '%s' 'mongodb+srv://...' | \
  gcloud secrets versions add routeone-database-url \
    --project="PROJECT_ID" \
    --data-file=-
```

필수 값과 이미지를 지정해 배포한다.

```bash
export PROJECT_ID="routeone-prod"
export API_IMAGE="asia-northeast3-docker.pkg.dev/routeone-prod/routeone/api:IMAGE_TAG"

./infra/cloud-run/deploy-notification-cleanup.sh
```

기본 구성은 다음과 같다.

- Cloud Run 리전: `asia-northeast3`
- Job: `routeone-notification-cleanup`
- 보존 기간: 180일
- Scheduler: 매일 `03:30`, `Asia/Seoul`
- Job 재시도: 1회
- Job 제한 시간: 10분

리전, 리소스 이름, 스케줄과 Secret 이름은 환경 변수로 덮어쓸 수 있다.

```bash
REGION="asia-northeast3" \
DATABASE_SECRET="routeone-database-url" \
SCHEDULE="30 3 * * *" \
TIME_ZONE="Asia/Seoul" \
./infra/cloud-run/deploy-notification-cleanup.sh
```

스크립트는 두 개의 전용 서비스 계정을 만든다.

- Runtime 서비스 계정: `DATABASE_URL` Secret의
  `roles/secretmanager.secretAccessor`만 부여
- Scheduler 서비스 계정: cleanup Job에만 `roles/run.invoker` 부여

Cloud Scheduler는 Runtime 서비스 계정이나 데이터베이스 Secret에 접근하지
않는다. OAuth 액세스 토큰으로 Cloud Run v2의 `jobs.run` API를 호출한다.
Scheduler 서비스 에이전트에는 토큰 발급에 필요한
`roles/cloudscheduler.serviceAgent`를 유지한다.

배포를 실행하는 계정에는 서비스 활성화, 서비스 계정 생성과 사용, Secret IAM,
Cloud Run Job, Scheduler, 프로젝트 IAM을 관리할 권한이 필요하다.

## 운영 검증

배포 직후 Job을 직접 한 번 실행한다.

```bash
gcloud run jobs execute routeone-notification-cleanup \
  --project="${PROJECT_ID}" \
  --region="asia-northeast3" \
  --wait
```

최근 실행과 Scheduler 구성을 확인한다.

```bash
gcloud run jobs executions list \
  --job="routeone-notification-cleanup" \
  --project="${PROJECT_ID}" \
  --region="asia-northeast3"

gcloud scheduler jobs describe routeone-notification-cleanup-daily \
  --project="${PROJECT_ID}" \
  --location="asia-northeast3"
```
