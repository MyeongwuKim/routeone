# RouteOne Native

React Native WebView로 `apps/web` 빌드 산출물을 감싸는 하이브리드 앱이에요.

## 구조

- `src/App.tsx`: WebView 컨테이너
- `src/generated/webBundle.ts`: `apps/web/dist`의 HTML, CSS, 분리된 JS 모듈을 WebView용 HTML 문자열로 변환한 결과
- `src/webview/bridge`: WebView와 네이티브 기능을 연결하는 목적별 브릿지
  - `fetchBridge.ts`: `/graphql`, `/tour-api`, `/map-direction` 요청 프록시
  - `locationBridge.ts`: 현재 위치 요청 처리
  - `visitPhotoBridge.ts`: 방문 사진 촬영 및 업로드 처리
  - `injectedScript.ts`: WebView에 주입되는 브릿지 스크립트
- `scripts/sync-web-build.mjs`: 웹 빌드 후 분리 모듈 import map을 포함한 native 번들 생성

## 실행

이 앱은 Expo Go가 아니라 native WebView 앱으로 확인하는 흐름을 기본으로 잡아요.

시뮬레이터에 네이티브 앱을 빌드하고 실행하려면 루트에서 아래 명령을 사용해요.

```bash
pnpm native:ios
```

이미 앱이 설치되어 있고 Metro만 다시 띄울 때는 dev client 모드로 실행해요.

```bash
pnpm native:start
```

Expo Go로 열어야 하는 경우에만 아래 명령을 사용해요.

```bash
pnpm native:start:go
```

웹앱까지 다시 빌드해서 번들을 갱신하려면 아래 명령을 사용해요.

```bash
pnpm native:build:webview
```

## TestFlight

TestFlight에 올릴 때는 실제 App Store Connect에 제출되는 store 배포 빌드를 사용해요.

프로덕션 앱은 `APP_VARIANT=prod`로 빌드하고, iOS 번들 ID는 `com.routeone.app`을 사용해요.

```bash
cd apps/native
pnpm run eas:build:ios
pnpm run eas:submit:ios
```

테스트용 앱은 `APP_VARIANT=dev`와 `testflight-dev` 프로필을 사용해요. 이때 iOS 번들 ID는 `com.routeone.app.dev`, 앱 이름은 `RouteOne(T)`예요.

```bash
cd apps/native
pnpm run eas:build:ios:dev
pnpm run eas:submit:ios:dev
```

두 앱은 App Store Connect에서도 각각 별도 앱 레코드와 번들 ID가 필요해요. 제출 자동화를 쓰려면 `apps/native/eas.json`의 submit 프로필에 각 앱의 `ascAppId`를 채우면 돼요.

실기기 TestFlight 빌드에서는 로컬 API 주소를 사용할 수 없으니, 빌드 전에 배포용 GraphQL 주소를 환경변수로 넣어야 해요.

```bash
EXPO_PUBLIC_GRAPHQL_ENDPOINT=https://api.example.com/graphql pnpm run eas:build:ios:dev
```

## 환경변수

WebView 안의 `/graphql`, `/tour-api`, `/map-direction` 요청은 기존 Vite dev proxy 대신 native bridge에서 직접 호출해요.

```bash
APP_VARIANT=dev
EXPO_PUBLIC_GRAPHQL_ENDPOINT=http://192.168.0.144:4000/graphql
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=...
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=...
EXPO_PUBLIC_NCP_MAPS_KEY_ID=...
EXPO_PUBLIC_NCP_MAPS_KEY=...
```

`EXPO_PUBLIC_GRAPHQL_ENDPOINT`는 현재 Mac의 LAN IP로 맞춰야 실기기에서도 로컬 API에 붙을 수 있어요. iOS 시뮬레이터만 쓸 때는 `http://127.0.0.1:4000/graphql`도 사용할 수 있어요.

`APP_VARIANT=dev`는 테스트 앱 식별자 `com.routeone.app.dev`와 앱 이름 `RouteOne(T)`를 사용해요. `APP_VARIANT=prod`는 운영 앱 식별자 `com.routeone.app`과 앱 이름 `RouteOne`을 사용해요. Google OAuth iOS 클라이언트의 번들 ID도 이 값과 정확히 맞아야 해요.

네이티브 버전 비교에 쓰는 값은 아래 환경변수로 고정할 수 있어요. 값을 넣지 않으면 앱 버전은 `0.1.0`, iOS build number와 Android version code는 `1`로 잡혀요.

```bash
ROUTEONE_APP_VERSION=0.1.0
ROUTEONE_IOS_BUILD_NUMBER=1
ROUTEONE_ANDROID_VERSION_CODE=1
```

원격 웹 번들 manifest 주소는 앱 variant에 따라 나뉘어요. 아래처럼 base URL만 넣으면 `dev` 앱은 `routeone-web-bundles/dev/manifest.json`, `prod` 앱은 `routeone-web-bundles/prod/manifest.json`을 봐요.

```bash
EXPO_PUBLIC_WEB_BUNDLE_BASE_URL=https://cdn.example.com
EXPO_PUBLIC_WEB_BUNDLE_PREFIX=routeone-web-bundles
```

채널별 주소를 직접 지정해야 하면 아래 값을 사용할 수 있어요.

```bash
EXPO_PUBLIC_WEB_BUNDLE_MANIFEST_URL_DEV=https://cdn.example.com/routeone-web-bundles/dev/manifest.json
EXPO_PUBLIC_WEB_BUNDLE_MANIFEST_URL_PROD=https://cdn.example.com/routeone-web-bundles/prod/manifest.json
```

## 웹 번들 R2 배포

`main` 브랜치에 push하면 `prod`, `develop` 브랜치에 push하면 `dev` 채널 웹 번들을 GitHub Actions에서 빌드하고 R2에 업로드해요.

업로드 경로는 기본적으로 아래처럼 나뉘어요.

```text
routeone-web-bundles/dev/bundles/web-dev-123-abcdef0.zip
routeone-web-bundles/dev/manifest.json
routeone-web-bundles/dev/versions.json

routeone-web-bundles/prod/bundles/web-prod-123-abcdef0.zip
routeone-web-bundles/prod/manifest.json
routeone-web-bundles/prod/versions.json
```

`manifest.json`은 최신 번들만 가리키고, `versions.json`은 최근 5개 번들 이력을 보관해요. 스크립트가 채널별 zip 파일도 최대 5개까지만 남기고 오래된 파일을 삭제해요.

GitHub에는 아래 값을 등록해야 해요.

- Secrets: `CLOUDFLARE_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`
- Variables: `R2_PUBLIC_BASE_URL`, `ROUTEONE_APP_VERSION`, `ROUTEONE_IOS_BUILD_NUMBER`, `ROUTEONE_ANDROID_VERSION_CODE`, `ROUTEONE_WEB_BUNDLE_PREFIX`

`R2_PUBLIC_BASE_URL`은 네이티브 앱이 zip을 내려받을 공개 URL이 필요할 때 넣어요. 비워두면 JSON에는 `bundleKey`만 들어가고 `bundleUrl`은 `null`로 남아요.

클라이언트 앱에 API secret이 들어가는 구조라, 실제 배포에서는 별도 백엔드 프록시로 옮기는 게 좋아요.
