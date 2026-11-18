# 계정과 앱 공통 기능

## 인증과 내 정보

- `apps/web/src/router/AppRouter.tsx`의 `RequireAuth`가 `/my-route`, `/me` 하위 화면, `/notifications`를 감싼다. 비로그인 상태는 `apps/web/src/components/auth/LoginRequiredCard.tsx`로 안내한다. `/home/language`와 `/shared-route` 진입은 공개다. API 권한은 UI와 별도로 `apps/api/src/context.ts` 및 각 resolver에서 확인한다.
- 웹 로그인과 세션은 `apps/web/src/pages/LoginPage.tsx`, `apps/web/src/api/authApi.ts`, `apps/web/src/lib/authSession.ts`, `apps/web/src/stores/authUserStore.ts`에서 찾는다. 네이티브 로그인과 WebView 토큰 전달은 `apps/native/src/auth/`와 `apps/native/src/webview/bridge/authTokenBridge.ts`에서 확인한다. 세션 갱신이나 로그아웃을 바꾸면 이전 요청이 늦게 끝나 새 계정 상태를 덮지 않는지 확인한다.
- 같은 계정은 마지막 로그인 세션만 서버 인증을 통과한다. `user.resolver.ts`의 비밀번호·네이티브 OAuth 로그인은 `User.activeSessionId`를 교체하고 기존 서버 푸시 등록을 같은 트랜잭션에서 비활성화한다. 토큰의 `sessionId`를 `context.ts`에서 사용자 저장값과 비교하며, 자동 갱신은 같은 식별자를 유지해 이전 기기가 갱신으로 세션을 되살리지 못한다. 이 값은 네이티브 WebView 메시지를 구분하는 로컬 `sessionId`와 별개다. 식별자가 없는 이전 토큰은 재로그인이 필요하다.
- 종료된 토큰으로 요청하면 `AuthSessionError`가 HTTP 401과 `UNAUTHENTICATED`를 반환한다. `graphqlClient.ts`는 요청 당시 토큰이 여전히 현재 토큰일 때만 로컬 세션을 종료하고 네이티브에 전달한다. `AppRouter.tsx`의 `AuthSessionTracker`는 인증 변경 이벤트에서 사용자·조회 캐시·진행 journal을 비우고 일정 초안은 유지한다. 서버 인증은 새 로그인 이후부터 거절되며, 이전 기기의 화면과 로컬 알림 정리는 다음 서버 요청에서 이를 확인한 뒤 실행된다. 이미 서버에 접수된 요청 자체를 취소하지는 않는다. 로그인 요청은 이전 토큰 없이 전송해 종료된 세션에 막히지 않는다.
- `apps/api/tests/authSingleSession.test.mjs`에서 로그인·갱신·동일 시각 발급·네이티브 OAuth·기존 토큰·푸시 정리 실패와 실제 HTTP 인증 응답을 확인한다. 웹의 `graphqlClient.test.mjs`·`authSession.test.mjs`, 네이티브의 `authTokenBridge.test.cjs`·`nativeSessionCleanup.test.cjs`에서 늦은 인증 거절과 세션·알림 정리를 확인한다.
- `apps/web/src/lib/authToken.ts`의 `createAuthSessionRequest`는 요청 시점의 토큰과 세션 변경 세대를 함께 검사한다. 같은 토큰으로 다시 로그인하거나 네이티브의 인증 변경 이벤트·다른 탭의 토큰 변경을 받아도 이전 요청을 구분한다. 현재 방문·사진 저장 흐름이 이 검사를 사용하며, 다른 요청 전체에 자동 적용되는 것은 아니다.
- `apps/web/src/pages/MyInfoPage.tsx`는 내 정보 메뉴의 진입점이다. 계정 화면과 로그아웃은 `apps/web/src/pages/MyAccountPage.tsx`, 서버 사용자 처리는 `apps/api/src/modules/user/user.resolver.ts`, 탈퇴 데이터 정리는 `apps/api/src/modules/user/userAccount.service.ts`를 먼저 본다. 기본 지역은 `apps/web/src/pages/ServiceAreaSettingsPage.tsx`와 `apps/web/src/stores/serviceAreaStore.ts`, 루트 기록과 찜은 [일정과 루트](route-flows.md)에 있다.
- 계정 전환을 바꿀 때는 웹 캐시, 로컬 토큰, 진행 중인 루트 상태, 네이티브 알림·푸시 등록의 정리를 같이 확인한다. 지역 설정을 바꾸면 저장된 기본 지역과 지도에서 현재 탐색 중인 지역을 구분한다. 기본 지역 변경과 축제 알림 연동은 `apps/web/src/features/service-area/`와 `apps/api/src/modules/notifications/notificationSettings.service.ts`에서 찾는다.
- 앱 정보와 문의는 `apps/web/src/pages/AppInfoPage.tsx`, `apps/web/src/pages/FeedbackPage.tsx`에서 시작한다. 앱 버전·플랫폼 정보는 `apps/web/src/stores/nativeAppInfoStore.ts`, 기기에서 열 수 있는 동작은 관련 브릿지 처리와 함께 확인한다.

## 알림

- 알림함과 읽음 처리는 `apps/web/src/pages/NotificationCenterPage.tsx`, 설정과 기기 등록은 `apps/web/src/pages/NotificationSettingsPage.tsx`, 요청과 조회 키는 `apps/web/src/api/notificationApi.ts`에 있다.
- API 설정과 알림함 저장, 스케줄 생성, 푸시 발송은 `apps/api/src/modules/notifications/` 안에서 책임이 나뉜다. 네이티브의 도착·후기·축제 알림은 `apps/native/src/webview/bridge/`, 네이티브 알림의 알림함 반영은 `apps/web/src/features/notifications/NativeNotificationInboxSync.tsx`를 먼저 확인한다.
- 알림이 없을 때는 사용자 설정, 운영체제 권한, 푸시 기기 등록, 알림함 저장, 실제 기기 도착을 구분한다. 읽음 상태나 계정 전환 수정은 목록과 미확인 표시, 기존 기기 등록에 영향을 주는지 확인한다. 스케줄러와 정리 작업은 `infra/cloud-scheduler/`와 `infra/cloud-run/`에 운영 절차가 있다.
- 앱 아이콘 배지는 알림함과 같은 최근 180일 미확인 총개수를 사용한다. API의 `notificationInbox.repository.ts`가 읽음 필드가 없는 이전 기록까지 세며, `pushDelivery.service.ts`는 증가분 대신 총개수를 `badge`에 담아 iOS가 앱 종료 중에도 반영하게 한다. 재전송은 같은 알림을 중복으로 세지 않는다. 개수 조회만 실패하면 배지 값을 생략해 푸시 전송을 유지한다.
- 앱 실행 중에는 `notificationBadgeSync.ts`가 모든 탭에서 알림함 첫 페이지 Query를 구독한다. 수신·앱 복귀 후 조회와 알림함 읽음 처리 결과를 `routeone:native-notification-badge`로 전달하며, 네이티브 `notificationBadgeBridge.ts`는 현재 로그인 세션의 메시지만 인증 변경 큐에서 처리한다. 알림함 읽음 처리 성공 시 진행 중인 첫 페이지 조회를 취소해 이전 응답이 배지를 되살리지 않게 한다. 로그아웃·만료·계정 전환 정리는 배지를 0으로 만들고 이전 계정의 조회·메시지를 무시한다. 네이티브 도착 알림은 서버 알림함에 반영된 뒤 이 총개수에 포함된다.
- iOS 권한 요청에는 `allowBadge: true`를 포함한다. 사용자가 OS 설정에서 배지를 끄면 표시되지 않으며 Android 숫자 표시는 런처 지원에 따른다. 배지 검증은 API `notificationBadge.test.mjs`, 웹 `notificationBadgeSync.test.mjs`, 네이티브 `notificationBadgeBridge.test.cjs`·`nativeSessionCleanup.test.cjs`를 사용한다. 실제 푸시·아이콘 확인에는 테스트 계정과 기기별 OS 배지 설정을 함께 확인한다.

## 사진 신고 차단

- 방문 인증은 `apps/web/src/features/my-route/hooks/useRouteVisitProgress.ts`에서 시작한다. API의 `apps/api/src/modules/routes/routeVisit.service.ts`와 `routeVisitPhoto.service.ts`, 네이티브의 `apps/native/src/webview/bridge/visitPhotoBridge.ts`에서 위치·사진 처리 경로를 나눠 찾는다. 이미지 분석 서비스 진입점은 `apps/image-analyzer/src/main.py`다.
- 사진 신고 관리와 차단 해제는 `apps/web/src/features/photo-report/pages/PhotoReportManagementPage.tsx`, `apps/web/src/features/user-block/pages/BlockedUsersPage.tsx`에서 찾는다. API 신고 처리는 `apps/api/src/modules/moderation/`, 차단은 `apps/api/src/modules/user/userBlock.service.ts`가 진입점이다.
- 사진 공개나 차단을 바꾸면 내 기록에서 보이는 사진과 다른 사용자에게 보이는 장소 사진을 구분한다. 차단의 영향을 받는 공유 목록과 상세도 같이 확인한다. 이미지 삭제와 신고 처리는 테스트 데이터에서만 실행한다.

- 미참조 이미지 정리는 `apps/api/src/modules/images/imageReference.repository.ts`에서 신고 스냅샷의 `photoImageId`·`photoImageUrl`·`photoThumbnailUrl`도 확인한다. 원본 사진 기록이 없어도 신고 처리 상태와 무관하게 참조가 남아 있으면 보존하고, 조회 실패에는 삭제를 중단한다. `orphanImageCleanup.test.mjs`에서 실제 참조 검사와 정리 흐름을 연결해 보존·삭제 직전 새 신고·조회 실패를 확인한다. 스키마 검사는 이미지 참조가 아닌 사진 레코드 ID와 제목을 구분하며, 차단·신고 제외 조건의 병행은 `userBlock.test.mjs`에서 확인한다.

## WebView와 배포

- 한국어 UI 문구는 기본 웹 번들에 포함한다. 영어 UI는 웹 빌드에서 해시가 붙은 팩으로 만들고 R2의 `language-packs/`에 따로 발행한다. 설치 앱의 첫 언어 선택은 네이티브에서 영어팩을 받고 검증한 뒤 WebView에 넘긴다. 웹 언어 설정은 해당 번들의 해시에 맞는 저장본을 재사용하고, 내려받기나 검증에 실패하면 한국어와 재시도 버튼을 유지한다.
- `pnpm native:ios:local`은 같은 빌드의 영어팩을 시뮬레이터 앱에 포함한다. 첫 언어 선택과 WebView 설정 모두 이 팩을 사용하고 영어팩 요청을 R2로 보내지 않는다.
- 영어 사용자로 재실행하면 웹이 영어팩 적용을 마친 뒤 첫 화면을 렌더링한다. 그동안 네이티브 시작 화면에 영어팩 준비 진행률을 전송하고, 앱 화면이 렌더링된 뒤에만 웹 번들 준비 신호를 보낸다. 다운로드 실패 시에는 안내와 함께 한국어로 시작한다.
- 앱 안에서 영어로 전환하는 동안은 전역 다운로드 모달로 화면 조작과 앱 내부 뒤로가기를 막는다. 받은 바이트의 진행률을 표시하고, 완료하거나 실패하면 모달을 닫아 전환 또는 재시도를 이어간다.
- `NativeWebViewScreen.tsx`의 번들 선택은 화면 진입 시 실행한다. 언어 변경으로 번들을 다시 조회하거나 준비 상태를 초기화하지 않으며, 비동기 준비 결과와 오류 안내는 현재 언어를 읽어 표시한다. `apps/native/tests/webViewLanguageChange.test.cjs`에서 실행 중 언어 전환과 시작 시 언어팩 진행 표시를 확인한다.
- WebView 화면이 보내는 메시지의 종류와 응답은 `apps/native/src/webview/bridge/types.ts`, `index.ts`, 각 브릿지 모듈을 따라간다. 변경 시 웹 브라우저에서의 동작과 네이티브 권한 승인·거절 후 동작을 나눠 확인한다.
- 도착 알림 메시지는 `injectedScript.ts`에서 요청 시점의 로컬 세션 번호를 읽는다. 같은 WebView의 로그인 전환은 `NativeWebViewScreen.tsx`가 새 번호를 전달하며, 이미 보낸 메시지에는 이전 번호가 남아 네이티브의 현재 세션 검사에서 거절된다. `routeArrivalNotificationInjectedBridge.test.cjs`에서 첫 로그인·세션 전환·기존 요청 번호 보존과 시간 초과·권한 옵션을 구분해 확인한다.
- 앱 바이너리 업데이트 정책은 `apps/native/src/nativeUpdate/`, 원격 웹 번들 선택은 `apps/native/src/config/webBundleUpdateConfig.ts`와 `apps/native/src/webBundle/`에 있다. 시뮬레이터에서 오래된 화면이 보이면 앱 바이너리, 선택된 번들의 버전·채널, API 연결 대상을 구분한다. 발행 흐름은 `.github/workflows/`에서 확인한다.
