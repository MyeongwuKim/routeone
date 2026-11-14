# 일정과 루트

## 일정 만들기와 편집

- 담은 장소는 `apps/web/src/stores/placeCartStore.ts`, 일정 입력과 결과 편집은 `apps/web/src/features/route-checkout/`에서 찾는다. `useRouteCheckout.ts`에서 흐름을 보고, `useRouteResultEditor.ts`에서 날짜·방문 순서 편집, `routePlanBuilder.ts`에서 일정 계산을 추적한다.
- 결과 편집의 상태 소유·저장 중 변경 차단·이동시간 조회 연결은 `useRouteResultEditor.ts`에 둔다. `models/routeResultEditorState.ts`는 초기화·적용/취소 reducer와 초안·적용본에 공통인 일정 계산을 담당하며, `routeResultEditorModel.test.mjs`와 `routeResultEditor.test.mjs`로 규칙과 Hook 연결을 나눠 확인한다.
- 자동 배치는 장소가 충분하면 선택한 모든 DAY에 최소 한 곳을 남기고 방문 수·이동거리·식사와 카페 시간대를 비교한다. 장소보다 일수가 많으면 앞 날짜부터 배치하며, 시간이 부족해도 장소를 버리지 않고 일정 초과로 표시한다. 편집 후 재계산은 수동 방문 순서와 DAY별 출발지를 유지한다. `apps/web/tests/routePlanBuilder.test.mjs`에서 날짜 분배·근접 장소 묶음·장소 보존·저장 일수와 편집 재계산을 확인한다.
- `useRouteCheckoutSave.ts`가 새 일정 저장과 기존 루트에 일정 추가를 나눈다. `apps/web/src/api/routeCheckoutApi.ts`가 날짜별 출발지, 장소 스냅샷, 방문 순서를 API 입력으로 바꾸고 `apps/web/src/api/routeApi.ts`로 요청한다. 비어 있는 날짜 제거와 날짜 번호 재계산도 이 입력 변환에서 확인한다.
- 저장 과정에서 로그인이 필요하면 `AppRouter.tsx`가 로그인 뒤 돌아갈 경로와 배경 화면을 유지한다. 로그인 흐름을 바꾸면 저장 전 편집 상태가 유지되는지도 확인한다.
- 작성 중인 일정 한 개는 `apps/web/src/stores/routeCheckoutDraftStore.ts`가 이 기기의 localStorage에 보관한다. `useRouteCheckoutDraftSession.ts`가 새 일정·공유 복사·기존 루트 DAY 추가의 문맥을 구분하고, `RouteCheckoutProvider`가 단계·날짜·템포·출발지·장소와 적용 전후 결과 편집을 저장한다. 홈의 이어서 만들기로 재개하며, 담은 장소가 바뀌면 날짜·템포는 유지하고 이전 장소의 편집과 저장 시도 ID는 초기화한다. 지난 날짜는 날짜 선택부터 다시 확인한다.
- 저장 성공과 명시적 초안 삭제는 해당 초안을 제거하고 실패·로그인 안내·세션 만료는 유지한다. 생성 시 최초 전송 본문 JSON(`createAttempt.inputKey`)과 요청 ID를 함께 보관한다. `routeCheckoutApi.ts`의 `restoreRouteCreateRequestInput`이 이동 시간만 자동 갱신된 재시도를 구분하고 최초 본문을 복원해 같은 ID로 전송한다. 이미 저장된 자기 일정의 날짜 중복 검사에 막히지 않고 서버 결과를 확인한 뒤 장바구니·초안을 정리하며, 날짜·장소·체류시간 등을 직접 바꿨으면 현재 입력을 별도 저장으로 처리한다. 비로그인 초안은 로그인 계정에 승계하며, 명시적 로그아웃·계정 전환·탈퇴와 다른 계정 로그인에서는 제거한다. `routeCheckoutDraftStore.test.mjs`, `routeCheckoutDraftSession.test.mjs`, `routeCheckoutDraftLifecycle.test.mjs`, `routeCheckoutApi.test.mjs`, `routeResultEditor.test.mjs`에서 복원·계정 분리·정리·응답 유실과 이동 시간 변경 후 재시도를 확인한다.
- API의 `apps/api/src/modules/routes/route.resolver.ts`에서 `routeCommand.service.ts`로 이어진다. 생성 재시도의 중복 방지와 루트·DAY·방문지가 함께 쓰이는 트랜잭션은 이 서비스가 사용하는 기존 경로를 따라간다. 편집은 저장된 방문 기록과 순서를 보존하는지 확인한다.

## 내 루트와 방문 기록

- `/my-route`는 `apps/web/src/pages/MyRoutePage.tsx`에서 `routeApi.myRoutes()`를 조회한다. 편집 상태는 `apps/web/src/stores/routeEditFlowStore.ts`, 이전 루트 목록은 `apps/web/src/features/my-route/pages/MyRouteHistoryPage.tsx`에서 찾는다.
- Prisma의 루트 진행 상태 `DRAFT`·`ACTIVE`·`COMPLETED`, 공유 범위 `PRIVATE`·`PUBLIC`, 방문지 상태 `PENDING`·`VISITED`·`SKIPPED`는 별개다. 시작·날짜 편집·삭제는 `routeCommand.service.ts`, 조회는 `routeQuery.service.ts`, 방문 진행은 `routeVisit.service.ts`를 먼저 확인한다.
- 서버 내부의 `RouteStop.visitRevision`은 방문 기록 저장마다 증가한다. `routeStopVisitVersion.ts`가 조회했던 상태·번호를 저장 조건에 포함해 `PENDING → SKIPPED → PENDING` 뒤 늦게 끝난 요청도 거절한다. 기존 MongoDB 문서의 누락·null은 0으로 처리하고 첫 저장에서 번호를 남긴다. 방문·도착·사진·시간 수정, 건너뜀·취소, DAY 마무리와 전체 완료가 같은 비교 규칙을 사용한다. 여러 장소는 같은 상태·번호끼리 묶고 일부라도 충돌하면 트랜잭션을 원복한다. 재시도도 처음 읽은 번호를 유지한다.
- 방문 기록 충돌은 HTTP 409와 `USER_FACING_ERROR`로 전달한다. 웹은 해당 Mutation을 재전송하거나 성공으로 처리하지 않고 목록·상세·기록 등의 캐시를 무효화한다. 방문·건너뜀의 알림 복구도 이전 대상 대신 서버에서 재조회한 최신 대상을 사용하며, 재조회 실패에는 journal을 남긴다. GraphQL의 입력·출력 필드는 유지하므로 변경 번호는 클라이언트에 노출하지 않는다.
- 사진 삭제의 원본 정리는 조건부 기록 저장과 사진 숨김이 확정된 뒤 실행한다. 충돌로 거절되면 원본 삭제 요청도 보내지 않는다. 저장 후 원본 정리 실패는 사진 교체와 같은 방식으로 로그를 남기며 확정된 기록 삭제를 되돌리지 않는다.
- 장소의 건너뛰기·취소는 `setRouteStopSkipped`, 선택 DAY 마무리는 `finishRouteDay`로 처리한다. 소유자가 시작한 일정에서 날짜·수정 기한을 검사하고, 마무리는 선택한 DAY의 `PENDING`만 `SKIPPED`로 바꾼다. 건너뜀은 실제 방문 수·체류 통계에 넣지 않으며, 모든 장소가 방문 또는 건너뜀이면 루트를 완료한다. 완료 루트의 건너뜀을 취소하면 진행 중·비공개로 돌아간다.
- `route.shared.ts`의 `refreshRouteProgress`는 루트 진행 상태·사진의 루트 공개 범위·미완료 루트의 후기 알림 정리를 같은 트랜잭션에서 처리한다. 방문 취소도 방문 기록·통계·사진 변경부터 이 정리까지 함께 저장한다. 이미 비공개인 루트도 재시도 때 정리해 과거의 부분 실패를 복구하며, 사진별 명시적 공개 동의는 유지한다. `routeProgressPrivacy.test.mjs`에서 실패 시 원복·재시도·기존 불일치 복구와 실제 장소 사진 조회 범위를 확인한다.
- 웹의 `useRouteSkippingMutation.ts`는 API 확정 전후의 도착 알림 전환과 캐시 갱신을 담당한다. 결과를 확인하지 못하면 방문 상태를 추측하지 않고 전환 journal을 남겨 재조회한다. `routeDisplay.ts`의 `isVisitedStop`·`isSkippedStop`·`isResolvedStop`으로 방문 수와 일정 진행률을 구분하며, 다음 목적지·도착 알림·이동 구간은 건너뛴 장소를 제외한다. 내 기록·공유·포스터도 방문과 건너뜀을 구분한다.
- 건너뛰기·취소·DAY 마무리는 Mutation의 `pendingOperation`으로 `RouteSkippingProgressDialog.tsx`를 표시한다. 경로 점이 다음 지점으로 넘어가고 취소에서는 반대 방향으로 움직이며, 동작 줄이기 설정과 숨겨진 화면에서는 각각 정지·일시정지한다. 실제 저장·알림 처리가 끝날 때까지 배경 조작·닫기·Escape를 막고 성공/실패 시 해제한다. 앱 내부 뒤로가기는 `main.tsx`에서 라우터보다 먼저 설치한 `lib/historyNavigationGuard.ts`가 잠금 기간에만 되돌린다.
- 건너뛰기의 사전 알림 준비·저장 성공 후 반영·실패 복구는 시작 당시 설정을 재사용하지 않고 QueryClient의 최신 도착 알림 설정을 읽는다. `routeArrivalNotificationService.ts`는 설정/기기 준비 대기 뒤에도 확인하고, 기기 등록 완료를 기다리던 중 OFF로 바뀌었다면 마지막에 빈 대상을 다시 전송해 해제한다. OFF에서는 위치 확인과 권한 요청도 하지 않는다.
- 방문 완료·취소의 알림 전환은 `services/routeVisitArrivalTransition.ts`가 요청별 원본 목록·journal·진행 잠금·사전 등록·실패 복구를 소유한다. `useRouteStopVisitMutation.ts`는 낙관적 목록·캐시·입력창·토스트를 처리하고, Mutation 실행 시점과 성공 콜백 시점의 언어 문맥을 각각 전달한다. 결과 불명이나 최종 알림 실패에는 journal을 남긴다. `routeStopVisitMutation.test.mjs`에서 실제 QueryClient·MutationObserver와 복구 모듈을 연결해 검증한다.
- 방문·사진·체류시간 요청은 `authToken.ts`의 `createAuthSessionRequest`로 시작한 세션을 기억한다. 세션이 바뀌면 이어지는 위치·업로드·API 요청과 캐시·입력창·토스트·알림 반영을 중단하며, 도착 알림 서비스 내부의 설정·앱 정보 조회 뒤에도 확인한다. 작업 잠금은 계정 정리 세대가 그대로일 때만 해제해 새 세션의 잠금을 건드리지 않고, 토큰 갱신 때는 자신의 진행 표시와 잠금을 정리한다. 같은 토큰의 재로그인·늦은 성공/실패·업로드 및 알림 대기 중 전환도 `routeStopVisitMutation.test.mjs`에서 확인한다.
- DAY 선택·펼침·팝업 대상과 확인된 장소 표시는 controller와 `useDayRoutePopupState.ts`, 편집 여부·장소/출발지 draft·삭제 DAY·배치 비교 기준은 `useDayRouteLayoutEditor.ts`가 소유한다. 편집 세션이 기존 드래그·출발지·배치 저장 Hook을 연결하고 저장 성공 또는 취소 때 초안을 초기화한다. `dayRouteControllerSync.test.mjs`는 날짜 전환·서버 재조회·이동/삭제/체류시간/출발지·드래그·저장 실패와 재시도를 함께 확인한다.
- DAY 상세의 GPS 테스트 대상·적용 좌표·진행 상태와 네이티브 위치 적용/해제는 `useDayRouteGpsTest.ts`가 소유한다. controller는 해당 값을 화면에 연결하고, 지도 팝업 안의 좌표 조작·자동 걷기는 기존 `useGpsTestLocation.ts`가 담당한다. `dayRouteGpsTest.test.mjs`와 `dayRouteControllerSync.test.mjs`에서 세션 조건·기기 응답·중복 명령·화면 연결을 확인한다.
- 건너뛰기 검증은 API의 `routeSkipping.test.mjs`·`notificationArrivalSync.test.mjs`, 웹의 `routeSkippingProjection.test.mjs`·`routeSkippingUi.test.mjs`·`routeSkippingMutation.test.mjs`·`dayRouteControllerSync.test.mjs`·`historyNavigationGuard.test.mjs`와 기존 도착 알림 테스트를 사용한다. 1→2→3 중 2를 건너뛴 경우, 1·3 방문 후 남은 2를 포함해 마무리하는 경우, 취소·재요청·권한·실패·계정 전환·저장 중 DAY 전환과 복구 재조회를 확인한다. 알림 설정의 대기 중 ON/OFF 변경, 즉시 중복·닫기 차단, 잠금 해제 뒤 이동도 확인한다. 진행 대화상자의 실제 터치·Escape·BrowserRouter/HashRouter 뒤로가기·동작 줄이기·좁은 화면·다크 모드는 브라우저에서 별도로 확인한다.
- `apps/api/tests/routeVisitConcurrency.test.mjs`는 실제 서비스 호출에서 한 요청의 조회 결과만 보류해 건너뛰기·취소 후 늦은 저장, DAY 부분 갱신 원복, 재시도와 HTTP 409 전달을 확인한다. `ROUTEONE_TEST_LOCAL_MONGO=1`로 `routeVisitVersion.integration.test.mjs`를 명시 실행하면 로컬 MongoDB의 임시 DB에서 누락·null·0·기존 번호의 조건부 저장을 검사하며, 모든 fixture를 롤백하고 테스트 DB도 정리한다. 웹의 `routeStopVisitMutation.test.mjs`·`routeSkippingMutation.test.mjs`·`graphqlClient.test.mjs`에서 재전송 차단·최신 대상 복구·캐시 재조회와 계정 전환을 확인한다.
- 일정 시작이 끊기거나 재시도되는 경우 `apps/web/src/features/my-route/components/RouteStartAttemptRecoveryCoordinator.tsx`를 함께 본다. 도착 알림은 `RouteArrivalNotificationCoordinator.tsx`, 사진과 위치 인증은 [사진·신고·차단](account-platform-flows.md#사진-신고-차단)과 연결된다.
- 일정이나 방문 상태가 바뀌면 현재 목록과 상세에 더해 완료 기록, 장소 통계, 알림 중 해당 데이터를 쓰는 화면의 갱신을 확인한다. 포스터 출력은 `apps/web/src/features/my-route/hooks/useRoutePosterPreview.ts`와 `apps/web/src/features/my-route/utils/poster/`에서 찾는다.

## 여행 대표 카드

- 내 정보 → 다녀온 루트 목록의 `카드 만들기`는 `MyRouteHistoryPage.tsx`에서 `useTravelCardEditor.ts`로 연결한다. `MyRouteCard.tsx`는 하단 액션 슬롯만 표시하며 생성 조건과 편집 상태는 소유하지 않는다. 기존 DAY 상세의 기록 카드와 `useRoutePosterPreview.ts`는 유지한다.
- `models/travelCard.ts`는 기존 완료 DAY 판정을 재사용해 실제 방문의 인증 사진 후보를 정렬·중복 제거한다. `services/travelCardRenderer.ts`의 초안 준비는 사용 가능한 사진 최대 네 장을 고르고, 앞 사진이 실패하면 뒤 후보를 읽는다. 전부 건너뛴 DAY와 미완료 DAY는 후보에서 제외하며 사진 없는 방문 기록은 앨범 선택으로 시작한다.
- `useTravelCardEditor.ts` 한 곳이 제목·선택 문장·사진 순서·초점 위치의 임시 편집본을 소유한다. 계정·루트·닫기 변경은 세션 번호로, 연속 편집은 생성 번호로 오래된 결과를 제외한다. 편집하지 않은 기본 제목·날짜는 앱 언어를 따르고 직접 쓴 제목·문장은 유지한다. 초안 영구 저장과 기기 간 동기화는 하지 않는다.
- `TravelCardEditor.tsx`는 미리보기·문구·내보내기를, `TravelCardPhotoEditor.tsx`는 사진 선택·순서·위치 조정을 표시한다. 모바일에서는 상단 `사진 편집`으로 제어 영역에 바로 이동할 수 있다. 사진별 실패 표시는 실제 PNG의 대표 사진·포함 사진과 구분하며 실패한 후보를 다시 시도할 수 있다.
- 대표 카드는 1080×1350 PNG 한 장이다. 렌더러는 사진 수별 배치와 초점 비율을 캔버스에 적용하고 실제 출력 글꼴로 제목·한 줄 너비를 검사한다. 같은 PNG를 미리보기와 저장·공유에 사용한다. `routeCompletionPoster.ts`의 기존 이미지 읽기와 저장·공유를 재사용하고, 웹 공유의 파일 준비 뒤에도 편집 세션을 확인해 닫힌 카드의 공유·저장이 새로 시작되지 않게 한다.
- 앨범 선택은 기존 네이티브 사진 브리지에 `library`만 전달하며 업로드 대상을 보내지 않는다. 웹 파일도 로컬에서만 읽고 최대 1920px로 줄인다. 카드 편집은 루트·방문·GPS·인증 사진·공개 동의를 변경하지 않는다. iOS 저장·공유는 시스템 시트에 전달하는 동작이며 취소를 저장·SNS 게시 완료로 안내하지 않는다.
- 자동 테스트는 `apps/web/tests/travelCard.test.mjs`와 기존 `routePosterThemes.test.mjs`를 사용한다. 실제 PNG·크롭·입력 오류·사진 실패·후속 후보는 `apps/web/tests/fixtures/travelCardRendering.html`에서 확인한다. 실제 목록·편집 화면과 읽기 응답을 연결한 `travelCardEditor.html`·`travelCardEditor.tsx`는 Playwright의 `browser_run_code_unsafe`에 `travelCardFlow.mjs`를 전달해 확인한다. 각 검증은 별도 브라우저 컨텍스트와 테스트 사진을 쓰며 네이티브 경계 대체 검증과 실제 iOS 시트 검증을 구분한다.

## 공유 루트와 찜

- `/shared-route`는 비로그인 상태에서도 진입한다. `apps/web/src/pages/SharedRoutePage.tsx`가 지역·필터 조건에 따라 목록 페이지와 상세를 가져온다. 필터와 찜 상태는 `apps/web/src/features/shared-route/`, 내 정보의 찜한 목록은 `apps/web/src/features/shared-route/pages/LikedSharedRoutePage.tsx`에서 찾는다.
- 서버 목록과 상세의 공개 범위 및 사용자 차단 조건은 `apps/api/src/modules/routes/routeQuery.service.ts`, 공유 공개와 찜·저장 처리는 `apps/api/src/modules/routes/routeSocial.service.ts`에서 확인한다. 공개 설정이나 차단 조건을 바꾸면 목록뿐 아니라 ID를 통한 상세와 찜한 목록에도 같은 규칙이 적용되는지 확인한다.
- `useSharedRouteLike.ts`는 찜 요청 전에 목록·상세 캐시를 갱신한다. 수정 시 공유 목록, 상세, 내 정보의 찜 목록에 표시가 일치하는지와 요청 실패 시 원복을 확인한다. 공유 루트로 일정 만들기를 선택하면 `SharedRoutePage.tsx`가 원본을 바탕으로 편집용 일정을 만들어 `RouteCheckoutModal`에 넘긴다. 이 흐름을 바꾸면 저장할 때 원본 루트가 변경되지 않는지 확인한다.
