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

원격 웹 번들 manifest 주소는 앱 variant별 R2 버킷의 공개 URL을 기준으로 정해져요. base URL을 넣으면 앱은 해당 버킷의 `latest/manifest.json`을 봐요.

```bash
EXPO_PUBLIC_WEB_BUNDLE_BASE_URL=https://cdn.example.com
```

variant별 주소를 직접 지정해야 하면 아래 값을 사용할 수 있어요.

```bash
EXPO_PUBLIC_WEB_BUNDLE_MANIFEST_URL_DEV=https://dev-cdn.example.com/latest/manifest.json
EXPO_PUBLIC_WEB_BUNDLE_MANIFEST_URL_PROD=https://cdn.example.com/latest/manifest.json
```

## 앱 버전 브릿지

WebView에서는 `window.RouteOneNative.getAppInfo()`로 현재 네이티브 앱과 웹 번들 정보를 조회할 수 있어요.

```ts
const appInfo = await window.RouteOneNative?.getAppInfo?.();
```

응답에는 `platform`, `osVersion`, `appVersion`, `buildNumber`, `runtimeVersion`, `bundleIdentifier`, `webBundleVersion`, `webBundleKind`, `webBundleChannel`, `appVariant`가 포함돼요. 원격으로 설치한 웹 번들은 manifest의 `version`을 반환하고, 앱 내장 번들은 `webBundleVersion`이 `null`이며 `webBundleKind`가 `embedded`로 반환돼요.

## 웹 번들 R2 배포

`main` 브랜치에 push하면 `prod`, `develop` 브랜치에 push하면 `dev` 채널 웹 번들을 GitHub Actions에서 빌드하고 각각의 R2 버킷에 업로드해요.

dev와 prod는 서로 다른 R2 버킷을 사용하고, 각 버킷 안에는 아래 구조로 업로드해요.

```text
latest/
└── manifest.json

releases/
├── 1.0.31/
│   ├── manifest.json
│   └── web-ui.zip
└── 1.0.32/
    ├── manifest.json
    └── web-ui.zip
```

`latest/manifest.json`은 최신 release의 manifest와 같은 내용을 담고, 네이티브 앱이 최신 웹 버전과 다운로드 주소를 확인할 때 사용해요. release manifest에는 `version`, `bundleUrl`, `entryPath`, `sha256`, `createdAt`, `runtimeReadySignal`, `minimumNativeVersion`이 들어가요.

앱은 시작할 때 manifest 버전과 최소 네이티브 버전을 확인하고, 새 ZIP의 SHA-256을 검증한 뒤 앱 문서 디렉터리에 압축을 풀어요. 새 번들이 처음 로드되지 않으면 직전 로컬 번들로 되돌아가고, 저장된 번들이 없으면 앱에 내장된 웹 번들을 사용해요.

버전 폴더명은 기본적으로 `1.0.{GitHub Actions 실행번호}` 형식이에요. Repository variable `ROUTEONE_WEB_VERSION_PREFIX`를 바꾸면 `1.1.{실행번호}`처럼 앞자리를 변경할 수 있고, Actions에서 수동 실행할 때는 `version` 입력값으로 정확한 버전을 지정할 수 있어요.

`releases`에는 최신 버전 폴더 5개만 유지하고, 오래된 버전은 폴더 안의 `manifest.json`과 `web-ui.zip`을 함께 삭제해요.

GitHub 저장소의 `Settings > Secrets and variables > Actions`에서 아래 Repository secrets를 등록해야 해요.

- 공통: `CLOUDFLARE_ACCOUNT_ID`
- dev: `CLOUDFLARE_R2_ACCESS_KEY_ID_DEV`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY_DEV`, `R2_BUCKET_NAME_DEV`, `R2_PUBLIC_BASE_URL_DEV`
- prod: `CLOUDFLARE_R2_ACCESS_KEY_ID_PROD`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY_PROD`, `R2_BUCKET_NAME_PROD`, `R2_PUBLIC_BASE_URL_PROD`

Repository variables에는 `ROUTEONE_APP_VERSION`, `ROUTEONE_IOS_BUILD_NUMBER`, `ROUTEONE_ANDROID_VERSION_CODE`를 등록해요. `ROUTEONE_WEB_VERSION_PREFIX`는 선택값이며 기본값은 `1.0`이에요.

R2 버킷과 API Token도 dev/prod용으로 각각 만들고, 각 Token의 `Object Read & Write` 권한을 해당 버킷 하나로 제한해요. 워크플로는 `develop`에서 `_DEV`, `main`에서 `_PROD` 시크릿을 선택해요.

`R2_PUBLIC_BASE_URL_DEV`, `R2_PUBLIC_BASE_URL_PROD`에는 각 버킷의 공개 URL을 넣어요. R2 Access Key는 GitHub Actions에서만 사용하고 네이티브 앱에는 포함하지 않아요.
