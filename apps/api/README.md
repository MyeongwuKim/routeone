# RouteOne API

RouteOne의 계정, 여행 루트, 장소 현지화, 알림 기능을 제공하는 GraphQL API입니다.

## 기술 스택

- Apollo Server
- Fastify
- Prisma
- MongoDB

## 로컬 실행

1. `apps/api/.env`에 `DATABASE_URL`을 설정합니다.
2. 저장소 루트에서 의존성을 설치하고 Prisma Client를 생성합니다.
3. API 개발 서버를 실행합니다.

```bash
pnpm install
pnpm --filter api prisma:generate
pnpm dev:api
```

기본 서버 주소는 `http://localhost:4000`입니다.

## API 오류 모니터링

Fastify 요청과 GraphQL Resolver에서 발생한 내부 서버 오류는 `routeone-api` Sentry 프로젝트로 전송합니다. 사용자 식별에는 내부 사용자 ID만 사용하며 요청 본문, URL 쿼리, 쿠키와 요청 헤더는 전송 전에 제거합니다.

| 환경변수 | 필요 조건 | 설명 |
| --- | --- | --- |
| `SENTRY_DSN` | Sentry 수집 사용 시 | `routeone-api` 프로젝트의 DSN입니다. |
| `SENTRY_ENVIRONMENT` | 선택 | 환경 이름을 직접 지정합니다. 미설정 시 로컬은 `local`, `NODE_ENV=production`은 `prod`가 적용됩니다. |
| `SENTRY_RELEASE` | 선택 | 릴리스 이름을 직접 지정합니다. Cloud Run에서는 revision을 이용해 자동 생성합니다. |

별도 테스트 API를 배포할 때는 기존 `ROUTEONE_ENV=dev`를 설정하면 Sentry 환경도 `dev`로 구분됩니다. 성능 추적과 로그 수집은 활성화하지 않습니다.

## 라우팅 구조

| 메서드 | 경로 | 설명 | 인증 |
| --- | --- | --- | --- |
| `GET` | `/health` | API 서버의 실행 상태를 확인합니다. | 없음 |
| `POST` | `/graphql` | 모든 GraphQL Query와 Mutation을 처리합니다. | 작업별로 다름 |
| `POST` | `/internal/notifications/run` | 예약 알림을 실행하거나 축제·루트 회고 테스트 알림을 발송합니다. | Scheduler 전용 Bearer 토큰 |

`/internal/notifications/run`은 `Authorization: Bearer <NOTIFICATION_SCHEDULER_SECRET>` 헤더가 필요합니다. 요청 본문의 `mode`에는 `scheduled`, `festival-test`, `route-review-test`를 사용할 수 있으며 테스트 모드에서는 `accountId`도 전달합니다.

## GraphQL 도메인 구조

GraphQL 스키마는 `src/schema.ts`에서 도메인별 SDL과 Resolver를 합쳐 구성합니다.

| 도메인 | 위치 | 역할 |
| --- | --- | --- |
| 사용자 | `src/modules/user` | 비밀번호 및 Google·Apple 로그인, 세션 갱신, 내 정보 조회, 회원 탈퇴 처리 |
| 여행 루트 | `src/modules/routes` | 루트 생성·조회·수정, 일정 시작, 장소 방문 인증과 사진, 완료 루트 공유·좋아요·저장·복제 처리 |
| 장소 현지화 | `src/modules/places` | 관광지 이름·카테고리·소개 정보의 다국어 변환과 캐시 처리 |
| 알림 | `src/modules/notifications` | 알림함, 읽음 상태, 알림 설정, 푸시 기기, 축제·도착·루트 회고 알림 처리 |

## 인증 방식

`loginWithPassword` 또는 `loginWithNativeOAuth` Mutation이 발급한 토큰을 GraphQL 요청의 `Authorization: Bearer <token>` 헤더로 전달합니다. `refreshAuthSession` Mutation으로 로그인 세션을 갱신할 수 있습니다.

인증 토큰이 없는 요청은 초기 개발 호환성을 위해 로컬 기본 사용자 `local@routeone.dev`를 사용합니다. 다만 알림, 세션 갱신, 회원 탈퇴처럼 인증 세션이 필요한 작업은 유효한 토큰이 없으면 거부됩니다.
