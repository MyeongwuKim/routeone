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
