# UserNotification Scheduler

배포된 RouteOne API의 다음 엔드포인트를 Cloud Scheduler가 직접 호출한다.

```text
POST https://API_HOST/internal/notifications/run
```

- 한국시간 09:00부터 20:50까지 10분 간격으로 실행한다.
- 축제 알림은 푸시가 활성화된 사용자별·한국 날짜별 최대 1건으로 합친다.
- 루트 회고 알림은 완료 시각 24시간 후부터 루트별 1건만 발송한다.
- 한 번의 실행에서는 사용자별 알림 1건만 처리한다.
- 실패한 알림은 `nextPushAttemptAt` 이후 실행에서 재시도한다.

## API 환경 변수

충분히 긴 임의 문자열을 API 배포 환경 변수로 등록한다.

```text
NOTIFICATION_SCHEDULER_SECRET=RANDOM_SECRET
```

Cloud Scheduler의 `Authorization` 헤더에도 같은 값을 Bearer 토큰으로 설정한다.
이 값이 없거나 다르면 API는 실행 요청을 거부한다.

## Cloud Scheduler 설정

- 대상 유형: HTTP
- URL: `https://API_HOST/internal/notifications/run`
- HTTP 메서드: `POST`
- 빈도: `*/10 9-20 * * *`
- 시간대: `Asia/Seoul`
- 헤더 `Content-Type`: `application/json`
- 헤더 `Authorization`: `Bearer RANDOM_SECRET`
- 본문:

```json
{
  "mode": "scheduled"
}
```

운영 Scheduler는 이 본문을 유지한다. Scheduler 화면의 `강제 실행`을 누르면 예약
로직이 즉시 한 번 실행된다.

## 강제 푸시 테스트

같은 API에 테스트 모드와 RouteOne 계정 ID를 전달하면 발송 시간과 운영 중복 방지
상태에 관계없이 테스트 푸시를 즉시 시도한다.

축제 알림 테스트:

```bash
curl -X POST "https://API_HOST/internal/notifications/run" \
  -H "Authorization: Bearer RANDOM_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"mode":"festival-test","accountId":"ACCOUNT_ID"}'
```

루트 회고 알림 테스트:

```bash
curl -X POST "https://API_HOST/internal/notifications/run" \
  -H "Authorization: Bearer RANDOM_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"mode":"route-review-test","accountId":"ACCOUNT_ID"}'
```

테스트 알림 키는 운영 알림 키와 분리되므로 운영 발송 여부에 영향을 주지 않는다.
축제 테스트는 알림 지역과 실제 축제 데이터가 필요하고, 루트 회고 테스트는 장소가
포함된 완료 루트와 활성화된 푸시 기기가 필요하다.

Cloud Scheduler의 수동 실행은 저장된 운영 본문만 전송하므로 테스트 모드를 선택할
수 없다. Scheduler에서 테스트해야 한다면 반복 일정이 없는 별도 테스트 HTTP 작업을
잠시 만들고, 테스트 후 삭제하거나 일시중지한다.

## DB 스키마 반영

배포 전에 최신 Prisma 스키마를 반영한다.

```bash
pnpm --filter api prisma:push
```
