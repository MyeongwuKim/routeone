---
name: masil-feature-verification
description: 마실의 일정 만들기, 내 루트, 공유 루트, 내 정보, 인증, 알림, 방문 인증, 신고·차단, 공통 API 또는 네이티브 기능을 수정하거나 검증할 때 사용한다. 홈 추천·지도에 한정된 변경에는 masil-home-verification을 사용한다.
---

# 마실 기능 변경 검증

`git status --short`로 기존 변경을 확인한다. `docs/ai/project-context.md`에서 기능 진입점을 찾고 `docs/ai/route-flows.md`나 `docs/ai/account-platform-flows.md`에서 변경에 연결된 부분을 읽는다. 해당 화면이 읽고 쓰는 상태, API 요청, 서버 권한과 다른 화면의 갱신까지 필요한 범위만 추적한다.

## 변경별 확인

- **일정 만들기·내 루트:** 기존 일정과 새 일정, 날짜별 출발지·방문 순서, 시작과 완료 상태 중 수정한 부분을 확인한다. 저장 경로를 바꾸면 동일 요청의 재시도와 일부 저장 실패를 확인한다. 방문을 편집하면 기록과 통계를 읽는 곳을 확인한다.
- **공유 루트·찜:** 공개 목록과 직접 상세 진입, 비로그인·소유자·다른 사용자의 권한을 구분한다. 공유 여부와 차단이 변경되면 내 정보의 찜 목록까지 확인한다. 찜 수정은 실패 시 목록과 상세에 원래 값이 돌아오는지 확인한다.
- **내 정보·인증:** 로그아웃 상태, 세션 만료, 로그인 뒤 복귀, 계정 전환 중 영향받는 흐름을 선택한다. 세션이나 사용자 데이터 변경은 이전 계정의 캐시와 기기 등록이 재사용되지 않는지 확인한다.
- **알림·방문 인증·사진:** 앱 설정, OS 권한, 서버 기록, 기기 동작 중 바뀐 경계를 찾는다. 읽음 상태, 기본 지역 변경, 사진 공개와 신고·차단에는 관련 목록의 갱신과 테스트 계정의 노출 범위도 확인한다.
- **GraphQL·WebView:** API 계약 변경은 resolver와 `.graphql` 문서를 맞추고 `pnpm --filter web codegen`을 실행한다. 브릿지 변경은 웹에서의 동작과 iOS의 권한·응답을 구분한다. iOS 반영을 확인할 때 실행 중인 번들과 API 대상을 함께 확인한다.

## 관련 테스트 선택

저장소 루트에서 영향이 있는 테스트 파일만 골라 실행한다. 웹은 `node --test apps/web/tests/<파일명>`으로, API는 `pnpm --filter api exec node --import tsx --test tests/<파일명>`으로 실행한다.

| 영역 | 웹 테스트 | API 테스트 |
| --- | --- | --- |
| 일정 만들기·편집·내 루트 | `routeCheckoutApi.test.mjs`, `routeResultEditor.test.mjs`, `dayRouteStartLocation.test.mjs` | `routeTransactions.test.mjs`, `routeDayStartLocation.test.mjs` |
| 공유 루트·찜·차단 | `sharedRouteFilters.test.mjs`, `sharedRouteLike.test.mjs` | `userBlock.test.mjs` |
| 내 정보·세션·기본 지역 | `accountLoading.test.mjs`, `authSession.test.mjs`, `defaultServiceAreaSelection.test.mjs` | `oauthAudience.test.mjs`, `serviceAreaNotificationSync.test.mjs` |
| 알림·권한·방문 인증 | `nativePermissionSync.test.mjs`, `routeArrivalNotificationStart.test.mjs`, `visitPhotoVerification.test.mjs` | `notificationArrivalSync.test.mjs`, `notificationPushDeviceLifecycle.test.mjs`, `placeVerificationPolicy.test.mjs` |

타입 검사는 웹 `pnpm --filter web exec tsc -b --noEmit`, API `pnpm --filter api exec tsc --noEmit`, 네이티브 `pnpm native:typecheck` 중 변경에 해당하는 것을 실행한다. 화면 동작은 해당 탭과 연결 화면만 확인한다. 테스트 계정·데이터를 사용하고 결과에 인증 정보나 사용자 좌표를 넣지 않는다.
