# 마실 프로젝트 맥락

## 코드 진입점

| 영역 | 먼저 볼 코드 |
| --- | --- |
| 웹 라우팅과 탭 | `apps/web/src/router/AppRouter.tsx`, `apps/web/src/layouts/BottomTabLayout.tsx` |
| `/home` 추천 코스 | `apps/web/src/pages/HomeRecommendationPage.tsx`, `apps/web/src/features/home/recommendations/` |
| `/home/map` 장소 탐색 | `apps/web/src/pages/HomePage.tsx`, `apps/web/src/features/home/map/`, `apps/web/src/features/home/components/HomePlaceList.tsx` |
| `/home/language` 언어 선택 | `apps/web/src/pages/LanguageSettingsPage.tsx`, `apps/web/src/stores/appLanguageStore.ts` |
| 일정 만들기·`/my-route`·`/shared-route`·루트 기록과 찜 | [일정과 루트](route-flows.md) |
| `/me` 내 정보, `/login`, `/notifications`, 계정과 지역 설정 | [계정과 앱 공통 기능](account-platform-flows.md#인증과-내-정보) |
| 방문 사진, 사용자 차단, 콘텐츠 신고 | [계정과 앱 공통 기능](account-platform-flows.md#사진-신고-차단) |
| API 서버와 추천 코스 | `apps/api/src/server.ts`, `apps/api/src/modules/home-tour-courses/` |
| 네이티브 앱과 WebView | `apps/native/src/App.tsx`, `apps/native/src/components/native-webview/NativeWebViewScreen.tsx`, `apps/native/src/webview/bridge/fetchBridge.ts`, [WebView와 배포](account-platform-flows.md#webview와-배포) |
| 이미지 분석 서비스 | `apps/image-analyzer/src/main.py` |

웹 기능은 대체로 `pages` → `features`·`stores` → `api`·`graphql`로 이어진다. 서버 요청의 공통 처리는 `apps/web/src/lib/graphqlClient.ts`, Fastify 진입은 `apps/api/src/app.ts`, GraphQL 계약과 로그인 사용자 연결은 `apps/api/src/schema.ts`와 `apps/api/src/context.ts`에서 확인한다. 영속 모델은 `apps/api/prisma/schema.prisma`의 MongoDB 모델이 기준이다. 도메인 규칙은 `apps/api/src/modules/`에서 해당 resolver가 위임하는 서비스를 찾는다.

## 추천 코스와 지도

- `useHomeRecommendations.ts`는 선택 지역의 코스 목록을 API의 `homeTourCourses` GraphQL 쿼리로 받는다. API의 `tourCourseSource.ts`는 관광공사 코스 원본을 조회할 때 `VISITKOREA_SERVICE_KEY` 또는 `TOUR_API_SERVICE_KEY`를 사용한다.
- 웹의 `visitKoreaTourApi.ts`는 TourAPI의 `detailInfo2`에서 방문 순서와 방문지별 설명, `detailCommon2`에서 전체 소개와 개별 장소 상세, `detailIntro2`에서 거리·시간·테마를 조회한다. `homeRecommendations.ts`는 방문지 전체를 지도에 연결할 수 있는 코스만 표시한다. 코스가 안 보이면 목록 응답, 방문지 ID와 상세 응답, 조회 오류를 따로 확인한다.
- 언어 선택은 홈에서 로그인 없이 가능하다. 코스 제목·소개와 방문지별 설명은 `apps/web/src/hooks/useTourCourseLocalization.ts`를, 방문지 이름·주소는 `apps/web/src/lib/placeLocalization.ts`와 API의 `apps/api/src/modules/places/placeLocalization.service.ts`를 먼저 확인한다.
- 지원 지역 판정은 `apps/web/src/features/home/map/serviceRegionSelection.ts`를 확인한다. 경계 JSON은 웹 `apps/web/public/service-region-boundary.json`과 API `apps/api/src/assets/service-region-boundary.json`에 각각 있다. API의 빌드 단계는 API 소스 내부 파일을 `dist/assets`로 복사한다. `apps/api`만 빌드 소스로 사용할 때도 이 파일을 읽을 수 있어야 한다.
- 장소 상세 길찾기는 `apps/web/src/features/place-sheet/hooks/usePlaceSheetData.ts`에서 자동차와 도보로 분기한다. 도보 범위와 경로 계산은 `apps/web/src/features/walking/`에서 확인한다. GPS 좌표를 얻는 동작, 서비스 지역 판정, 도보 데이터 지원 범위는 서로 다른 조건이다.

## 실행 환경

| 루트 명령 | 적용 범위 |
| --- | --- |
| `pnpm dev:web` | 웹 개발 서버를 실행한다. |
| `pnpm api:local` | API에 `apps/api/.env`를 적용한다. |
| `pnpm api:dev` | API에 `apps/api/.env.development`를 우선 적용하고 없는 값은 `apps/api/.env`에서 채운다. 이미 설정된 프로세스 환경변수는 유지한다. |
| `pnpm native:ios:local` | `apps/native/.env`를 사용해 iOS 로컬 설정과 WebView 번들을 준비하고 Expo로 실행한다. |
| `pnpm native:ios:dev` | `apps/native/.env.development`를 사용해 개발용 iOS 네이티브 프로젝트와 번들을 준비한다. |

API 환경 선택은 `apps/api/src/lib/serverEnv.ts`에서 확인한다. iOS 환경과 번들 생성은 `apps/native/scripts/run-ios-local.mjs`, `apps/native/scripts/prebuild-ios.mjs`, `apps/native/scripts/sync-web-build.mjs`에서 확인한다. 시뮬레이터 화면이 웹 개발 서버와 다르면 앱이 실행 중인 WebView 번들과 브릿지가 가리키는 API를 각각 확인한다. 네이티브 앱의 `EXPO_PUBLIC_API_URL`은 `fetchBridge.ts`에서 사용한다.

## 커밋 전 검사

새로 클론한 저장소에서는 `git config --local core.hooksPath .githooks`로 한 번 연결한다. 이후 터미널과 Fork에서 커밋할 때 임시 폴더에 스테이징한 내용만 복원해 검사한다. 실패하면 커밋이 만들어지지 않고 `[pre-commit]` 로그가 검사 이름과 원인을 보여준다. Fork에서는 Activity Manager에서 실행 출력을 확인한다.

- 변경 영역의 TypeScript 타입 검사와 변경한 웹 TS·TSX 파일의 ESLint를 실행한다. 네이티브 타입 검사에는 로컬에서 생성한 WebView 번들이 필요하다.
- `scripts/related-tests.mjs`가 테스트의 import, 웹 SSR 모듈 경로와 소스를 직접 읽는 경로 리터럴을 따라 관련 Node 테스트를 선택한다. 새로 추가·수정한 테스트도 포함하며 다른 앱의 소스를 참조하는 네이티브 테스트도 선택한다. 동적으로 조합한 경로는 추적하지 못하므로 관련 테스트 선택 결과를 확인한다.
- 앱의 의존성·컴파일 설정은 해당 앱 전체, 루트 의존성 변경은 전체 테스트로 넓힌다. API의 `schema.ts`·Prisma 스키마 변경은 웹·API 전체, 웹 `.graphql` 변경은 웹 전체로 넓힌다. iOS 도착 알림 모듈 변경에는 기존 Swift 테스트도 실행하므로 Swift 컴파일러가 필요하다.
- 선택한 테스트 파일과 연결된 자동 테스트가 없는 구현을 로그에 표시한다. 실제 DB에 쓰는 `.integration.test.*`는 제외하고 테스트 DB를 지정해 따로 실행한다. 현재 저장소에는 실행 가능한 Playwright 설정·테스트가 없으며 `.playwright-mcp`는 수동 확인 기록이다.

`node scripts/pre-commit.mjs --plan`으로 스테이징한 변경의 선택 결과만 확인하고, `node scripts/pre-commit.mjs --all`로 전체 타입·웹 lint·기존 자동 테스트를 실행할 수 있다. `--all --plan`은 전체 검사 목록만 보여준다. 선택 규칙과 실제 Git 훅의 차단·통과 동작은 `node --test scripts/related-tests.test.mjs scripts/pre-commit.test.mjs`로 검증한다.
