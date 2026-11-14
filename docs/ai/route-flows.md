# 일정과 루트

## 일정 만들기와 편집

- 담은 장소는 `apps/web/src/stores/placeCartStore.ts`, 일정 입력과 결과 편집은 `apps/web/src/features/route-checkout/`에서 찾는다. `useRouteCheckout.ts`에서 흐름을 보고, `useRouteResultEditor.ts`에서 날짜·방문 순서 편집, `routePlanBuilder.ts`에서 일정 계산을 추적한다.
- `useRouteCheckoutSave.ts`가 새 일정 저장과 기존 루트에 일정 추가를 나눈다. `apps/web/src/api/routeCheckoutApi.ts`가 날짜별 출발지, 장소 스냅샷, 방문 순서를 API 입력으로 바꾸고 `apps/web/src/api/routeApi.ts`로 요청한다. 비어 있는 날짜 제거와 날짜 번호 재계산도 이 입력 변환에서 확인한다.
- 저장 과정에서 로그인이 필요하면 `AppRouter.tsx`가 로그인 뒤 돌아갈 경로와 배경 화면을 유지한다. 로그인 흐름을 바꾸면 저장 전 편집 상태가 유지되는지도 확인한다.
- API의 `apps/api/src/modules/routes/route.resolver.ts`에서 `routeCommand.service.ts`로 이어진다. 생성 재시도의 중복 방지와 루트·DAY·방문지가 함께 쓰이는 트랜잭션은 이 서비스가 사용하는 기존 경로를 따라간다. 편집은 저장된 방문 기록과 순서를 보존하는지 확인한다.

## 내 루트와 방문 기록

- `/my-route`는 `apps/web/src/pages/MyRoutePage.tsx`에서 `routeApi.myRoutes()`를 조회한다. 편집 상태는 `apps/web/src/stores/routeEditFlowStore.ts`, 이전 루트 목록은 `apps/web/src/features/my-route/pages/MyRouteHistoryPage.tsx`에서 찾는다.
- Prisma의 루트 진행 상태 `DRAFT`·`ACTIVE`·`COMPLETED`, 공유 범위 `PRIVATE`·`PUBLIC`, 방문지 상태 `PENDING`·`VISITED`·`SKIPPED`는 별개다. 시작·날짜 편집·삭제는 `routeCommand.service.ts`, 조회는 `routeQuery.service.ts`, 방문 진행은 `routeVisit.service.ts`를 먼저 확인한다.
- 일정 시작이 끊기거나 재시도되는 경우 `apps/web/src/features/my-route/components/RouteStartAttemptRecoveryCoordinator.tsx`를 함께 본다. 도착 알림은 `RouteArrivalNotificationCoordinator.tsx`, 사진과 위치 인증은 [사진·신고·차단](account-platform-flows.md#사진-신고-차단)과 연결된다.
- 일정이나 방문 상태가 바뀌면 현재 목록과 상세에 더해 완료 기록, 장소 통계, 알림 중 해당 데이터를 쓰는 화면의 갱신을 확인한다. 포스터 출력은 `apps/web/src/features/my-route/hooks/useRoutePosterPreview.ts`와 `apps/web/src/features/my-route/utils/poster/`에서 찾는다.

## 공유 루트와 찜

- `/shared-route`는 비로그인 상태에서도 진입한다. `apps/web/src/pages/SharedRoutePage.tsx`가 지역·필터 조건에 따라 목록 페이지와 상세를 가져온다. 필터와 찜 상태는 `apps/web/src/features/shared-route/`, 내 정보의 찜한 목록은 `apps/web/src/features/shared-route/pages/LikedSharedRoutePage.tsx`에서 찾는다.
- 서버 목록과 상세의 공개 범위 및 사용자 차단 조건은 `apps/api/src/modules/routes/routeQuery.service.ts`, 공유 공개와 찜·저장 처리는 `apps/api/src/modules/routes/routeSocial.service.ts`에서 확인한다. 공개 설정이나 차단 조건을 바꾸면 목록뿐 아니라 ID를 통한 상세와 찜한 목록에도 같은 규칙이 적용되는지 확인한다.
- `useSharedRouteLike.ts`는 찜 요청 전에 목록·상세 캐시를 갱신한다. 수정 시 공유 목록, 상세, 내 정보의 찜 목록에 표시가 일치하는지와 요청 실패 시 원복을 확인한다. 공유 루트로 일정 만들기를 선택하면 `SharedRoutePage.tsx`가 원본을 바탕으로 편집용 일정을 만들어 `RouteCheckoutModal`에 넘긴다. 이 흐름을 바꾸면 저장할 때 원본 루트가 변경되지 않는지 확인한다.

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
