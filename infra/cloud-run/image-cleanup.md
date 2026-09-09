# 고아 이미지 정리

Cloud Scheduler가 매일 한국시간 새벽 4시에 Cloud Run Job을 호출한다.
API 서버의 프로세스나 요청 수에 의존하지 않는 별도 작업이며 공개 삭제 엔드포인트는 없다.

## 삭제 기준

- Cloudflare의 실제 `filename`이 `routeone-`으로 시작하는 이미지 (`routeone-dev-…`, `routeone-prod-…`)
- Cloudflare 메타데이터의 `kind`가 `route-stop-visit-photo`이고 `environment`가 지정한 `dev` 또는 `prod`와 일치하는 이미지
- 업로드 후 최소 24시간이 지난 이미지
- 아래 DB 필드 어디에서도 참조하지 않는 이미지

| 모델 | 확인하는 필드 |
| --- | --- |
| RouteStop | verificationPhotoImageId, verificationPhotoUrl, place.imageUrl |
| PlacePhoto | imageId, imageUrl, thumbnailUrl, placeImageUrl |
| PlaceStayStat | imageUrl |
| User | avatarUrl |

부모 루트가 삭제됐어도 다른 레코드에 참조가 남아 있으면 보존한다. 비공개·비활성 사진도
참조로 취급한다. URL은 이미지 ID의 부분 일치로 보수적으로 검사하므로 서명 쿼리나
썸네일 variant가 달라도 보존하며, 비슷한 ID로 인한 오탐은 삭제 대신 보존으로 처리한다.
이미지 관련 필드를 추가할 때 `imageReference.repository.ts`와 참조 범위 테스트도 수정한다.

Cloudflare 목록 API에 `meta.kind[eq:string]=route-stop-visit-photo`와
`meta.environment[eq:string]=dev` 또는 `prod`를 전달해 요청 단계에서 대상 목록을 제한한다.
다음 페이지에도 같은 필터를 유지하며, 실패 시 필터 없는 전체 조회로 재시도하지 않는다.
`scannedCount`는 계정 전체 이미지 수가 아니라 이 필터로 조회한 이미지 수다.

파일명 접두사 검색은 목록 API의 제공 필터에 없으므로 응답을 받은 뒤 실제 파일명을 검사한다.
`routeone-`으로 시작하지 않거나 파일명을 확인할 수 없는 이미지는 DB 참조 조회와 삭제 대상에서 제외한다.
메타데이터의 `fileName`만 RouteOne 형식인 경우도 제외한다. 삭제 직전 상세 조회에서도
실제 파일명을 다시 확인하므로 같은 계정에서 사용하는 다른 서비스의 사진은 처리하지 않는다.

메타데이터가 없거나 다른 서비스·환경의 이미지, 업로드 시각을 확인할 수 없는 이미지와
draft는 제외한다. Cloudflare의 미업로드 draft는 목록 API에 나타나지 않으므로 이 작업은
업로드된 이미지의 고아 정리를 담당한다. 오래된 메타데이터 없는 파일은 자동 삭제하지 않는다.

전체 목록과 최초 참조 조회가 성공한 뒤 삭제 단계로 넘어간다. 삭제 직전 Cloudflare 상세와
DB 참조를 다시 확인한다. 유예 기간과 재확인으로 저장 중인 사진을 보호하지만 DB와
Cloudflare 삭제는 원자적이지 않다. 24시간 이상 저장을 미룬 사진이 재확인과 삭제 사이에
DB에 연결되는 극히 짧은 경합까지 막지는 못한다. 장기간 지연 저장을 보장해야 한다면
이미지 저장 예약·삭제 잠금을 저장 경로와 함께 도입해야 한다.

목록·상세·DB 조회 또는 삭제 실패는 Job 실패로 기록된다. 이미 삭제된 이미지의 404는
정상 처리하며, 기본 100개를 넘는 삭제 후보가 나오면 실제 삭제 전에 중단한다.

## 로컬 점검

`DATABASE_URL`, `CF_ACCOUNT`, `CF_TOKEN`을 실행 환경에 설정한다. Cloudflare 토큰은
대상 계정의 Images 읽기·삭제 권한이 필요하다. 토큰이나 DB 연결 문자열을 명령에 직접 쓰지 않는다.

```bash
pnpm --filter api build
IMAGE_CLEANUP_ENVIRONMENT=prod pnpm --filter api images:cleanup
```

기본은 `IMAGE_CLEANUP_DRY_RUN=true`로 삭제하지 않고 후보 ID와 집계만 출력한다.
빌드 없이 실행할 때는 `pnpm --filter api images:cleanup:dev`를 사용한다.
이 명령의 `:dev`는 TypeScript 직접 실행을 뜻하며 대상 환경은 `IMAGE_CLEANUP_ENVIRONMENT`로 정한다.

업로드 직후 고아 여부를 확인하려면 `--include-recent`를 붙인다.
이 옵션은 점검 모드에서만 유예 시간을 건너뛰며, 파일명·환경·DB 참조 검사는 그대로 적용한다.

```bash
IMAGE_CLEANUP_ENVIRONMENT=dev IMAGE_CLEANUP_DRY_RUN=true \
  pnpm --filter api images:cleanup:dev --include-recent
```

로그의 `includeRecent: true`, `cutoffAt: null`은 유예 시간 없이 조회했다는 뜻이다.
`candidateIds`에 방금 업로드한 미참조 이미지도 표시되며 `deletedCount`는 0이다.
`IMAGE_CLEANUP_DRY_RUN=false`와 함께 쓰면 외부 조회 전에 오류로 중단한다.
실제 삭제와 예약 작업은 기존 24시간 이상의 유예 조건을 유지한다.

## 스케줄 배포

Google Cloud CLI 인증과 배포 권한이 있는 환경에서 다음 값을 지정한다.

- `PROJECT_ID`: 실제 GCP 프로젝트 ID
- `API_IMAGE`: 이번 API 빌드를 포함한 배포 이미지 주소
- `IMAGE_CLEANUP_ENVIRONMENT`: 연결한 DB에 맞는 `dev` 또는 `prod`
- `DATABASE_SECRET`, `CF_ACCOUNT_SECRET`, `CF_TOKEN_SECRET`: Secret Manager의 기존 시크릿 이름

개발·운영이 같은 Cloudflare 계정을 사용해도 환경별 Job과 DB 시크릿을 따로 지정한다.
잘못된 DB를 연결하면 참조 여부를 잘못 판단하므로 첫 점검 로그에서 사용 중인 사진이
후보로 나오지 않는지 확인한다.

```bash
bash infra/cloud-run/deploy-image-cleanup.sh
gcloud run jobs execute "routeone-image-cleanup-${IMAGE_CLEANUP_ENVIRONMENT}" \
  --project="${PROJECT_ID}" --region=asia-northeast3 --wait
```

첫 배포는 점검 모드다. 후보를 확인한 뒤 같은 환경 변수로 실제 삭제를 활성화한다.

```bash
DRY_RUN=false bash infra/cloud-run/deploy-image-cleanup.sh
```

`GRACE_HOURS`는 기본 24(최소 24), `MAX_DELETES`는 기본 100이다. `SCHEDULE`, `TIME_ZONE`,
`REGION`으로 실행 시간을 바꿀 수 있다. 컨테이너 작업 디렉터리가 모노레포 루트라면
`CLEANUP_ENTRYPOINT=apps/api/dist/jobs/cleanupOrphanImages.js`를 지정한다.
DB 스키마 변경은 필요하지 않다.

실행 로그의 `orphan-image-cleanup.completed`에서 후보·삭제·재확인 보존 수를 확인한다.
삭제 성공 건은 `orphan-image-cleanup.deleted`, 실패는 `orphan-image-cleanup.failed`로 남는다.
스크립트는 Job/Scheduler 생성·갱신만 수행하며 즉시 이미지 삭제를 실행하지 않는다.

참고: [Cloudflare 목록 API](https://developers.cloudflare.com/api/resources/images/subresources/v2/methods/list/),
[직접 업로드와 draft](https://developers.cloudflare.com/images/storage/upload-images/direct-creator-upload/)
