# RouteOne Native

React Native WebView로 `apps/web` 빌드 산출물을 감싸는 하이브리드 앱입니다.

## 명령어 빠른 선택

루트에서 실행하는 명령어를 우선 사용합니다.

| 상황 | 명령어 | 설명 |
| --- | --- | --- |
| 로컬 iOS 시뮬레이터 실행 | `pnpm native:ios:local` | `APP_VARIANT=none`으로 웹 번들을 동기화하고 iOS 앱을 빌드한 뒤 시뮬레이터까지 실행합니다. |
| dev 앱 Xcode 파일만 생성 | `pnpm native:ios:dev` | `APP_VARIANT=dev`로 `ios/` 프로젝트만 생성 또는 갱신합니다. |
| 로컬 Android 실행 | `pnpm native:android` | `APP_VARIANT=none`으로 Android 앱을 빌드하고 실행합니다. |
| 이미 설치된 dev client 실행 | `pnpm native:start` | 웹 번들을 다시 빌드하지 않고 Metro dev server를 실행합니다. |
| Expo Go 실행 | `pnpm native:start:go` | Expo Go로 확인해야 할 때만 사용합니다. |
| 웹뷰 번들 갱신 | `pnpm native:build:webview` | `apps/web/dist`를 native WebView용 번들로 변환합니다. |
| 타입 체크 | `pnpm native:typecheck` | native TypeScript 타입 검사를 실행합니다. |

`pnpm native:ios`는 로컬 실행인지 Xcode 파일 생성인지 헷갈리기 때문에 사용하지 않습니다. 로컬 시뮬레이터 실행은 `native:ios:local`, dev Xcode 파일 생성은 `native:ios:dev`로 구분합니다.

## 로컬 실행

이 앱은 Expo Go보다 native WebView 앱으로 확인하는 흐름을 기본으로 사용합니다. 로컬 iOS 시뮬레이터에서 앱까지 바로 실행하려면 아래 명령어를 사용합니다.

```bash
pnpm native:ios:local
```

`native:ios:local`은 내부적으로 아래 일을 실행합니다.

- `APP_VARIANT=none` 설정
- `apps/web/dist`를 native WebView 번들로 동기화
- `expo prebuild --platform ios` 실행
- iOS 권한 문구 동기화
- `expo run:ios`로 시뮬레이터 실행

`APP_VARIANT=none`은 로컬 개발 모드입니다. dev 앱 식별자를 사용하지만, `EXPO_PUBLIC_WEB_BUNDLE_BASE_URL`이 있어도 R2 원격 웹 번들을 확인하지 않습니다. 이전에 설치된 원격 웹 번들도 무시하고 앱에 내장된 로컬 번들을 사용합니다.

이미 앱이 설치되어 있고 Metro만 다시 띄우면 되는 상황에서는 아래 명령어를 사용합니다.

```bash
pnpm native:start
```

웹앱을 다시 빌드해서 WebView 번들만 갱신하려면 아래 명령어를 사용합니다.

```bash
pnpm native:build:webview
```

## Xcode 프로젝트 생성

Xcode 파일만 만들고 시뮬레이터를 실행하지 않으려면 아래 명령어를 사용합니다.

```bash
pnpm native:ios:dev
```

이 명령어는 `APP_VARIANT=dev`로 `expo prebuild --platform ios`를 실행하고, `apps/native/ios/` 프로젝트를 생성 또는 갱신합니다. Expo/EAS 서버나 App Store Connect로 업로드하지 않습니다.

필요하면 native 패키지 안에서 더 직접적인 명령어를 사용할 수 있습니다.

```bash
cd apps/native
pnpm run prebuild:ios:local
pnpm run prebuild:ios:dev
pnpm run prebuild:ios:dev:clean
```

`--clean`이 붙은 명령어는 `ios/`를 다시 생성하는 흐름이라 Xcode에서 직접 수정한 네이티브 파일이 있으면 날아갈 수 있습니다.

## TestFlight

TestFlight에 올릴 때는 EAS store 배포 빌드를 만들고 App Store Connect로 submit해야 합니다. `eas build`는 빌드 생성이고, `eas submit`은 App Store Connect 업로드입니다.

dev TestFlight 앱은 `APP_VARIANT=dev`와 `testflight-dev` 프로필을 사용합니다. iOS 번들 ID는 `com.routeone.app.dev`, 앱 이름은 `RouteOne(T)`입니다.

```bash
cd apps/native
pnpm run eas:build:ios:dev
pnpm run eas:submit:ios:dev
```

운영 앱은 `APP_VARIANT=prod`와 `production` 프로필을 사용합니다. iOS 번들 ID는 `com.routeone.app`, 앱 이름은 `RouteOne`입니다.

```bash
cd apps/native
pnpm run eas:build:ios
pnpm run eas:submit:ios
```

실기기 TestFlight 빌드에서는 로컬 API 주소를 사용할 수 없으므로, 빌드 전에 배포용 GraphQL 주소를 환경변수로 넣어야 합니다.

```bash
EXPO_PUBLIC_GRAPHQL_ENDPOINT=https://api.example.com/graphql pnpm run eas:build:ios:dev
```

내부 테스터에게 새 빌드 업데이트가 뜨려면 App Store Connect에서 아래 상태까지 끝나야 합니다.

- 빌드 업로드 및 Processing 완료
- 수출 규정/암호화 질문 완료
- 내부 테스트 그룹에 새 빌드 추가
- 그룹의 자동 배포 설정 또는 수동 배포 완료

iOS 수출 규정 질문을 줄이기 위해 `app.config.ts`의 `ios.infoPlist`에 `ITSAppUsesNonExemptEncryption: false`를 명시합니다. 자체 암호화 알고리즘이나 문서 제출이 필요한 암호화 기능을 추가하면 이 값은 다시 검토해야 합니다.

## 네이티브 앱의 역할

RouteOne Native는 웹앱을 앱 안에서 실행하면서 웹만으로 처리하기 어려운 기기 기능과 배포 흐름을 담당합니다.

- WebView 컨테이너 제공: `apps/web` 빌드 결과를 네이티브 WebView 안에서 실행합니다.
- 네이티브 브릿지 제공: 웹앱이 `window.RouteOneNative`를 통해 위치, 카메라, 앱 정보, 알림 기능을 호출할 수 있게 합니다.
- 네트워크 프록시 제공: WebView 안의 `/graphql`, `/tour-api`, `/map-direction` 요청을 네이티브 브릿지에서 실제 API로 전달합니다.
- 위치 기능 제공: 현재 GPS 위치 조회와 장소 근처 도착 여부 확인에 필요한 네이티브 위치 권한을 관리합니다.
- 방문 인증 기능 제공: 방문 사진 촬영, 사진 업로드, GPS 기반 방문 인증 흐름을 네이티브 기능과 연결합니다.
- 도착 알림 기능 제공: 루트의 다음 방문지 정보를 받아 위치 기반 알림을 등록하고 테스트 알림을 발송합니다.
- 웹 번들 업데이트 제공: 앱에 내장된 웹 번들을 기본으로 사용하고, dev/prod 빌드에서는 R2의 최신 웹 번들을 확인해 설치합니다.
- 앱 variant 관리: `none`, `dev`, `prod` 값에 따라 로컬 실행, 테스트 앱, 운영 앱의 번들 ID와 원격 웹 번들 사용 여부를 나눕니다.
- 앱 정보 전달: 웹앱이 현재 앱 버전, 빌드번호, 플랫폼, 설치된 웹 번들 정보를 확인할 수 있게 합니다.

## 구조

- `src/App.tsx`: WebView 컨테이너입니다.
- `src/generated/webBundle.ts`: `apps/web/dist`의 HTML, CSS, 분리된 JS 모듈을 WebView용 HTML 문자열로 변환한 결과입니다.
- `src/webview/bridge`: WebView와 네이티브 기능을 연결하는 목적별 브릿지입니다.
  - `fetchBridge.ts`: `/graphql`, `/tour-api`, `/map-direction` 요청 프록시입니다.
  - `locationBridge.ts`: 현재 위치 요청을 처리합니다.
  - `visitPhotoBridge.ts`: 방문 사진 촬영 및 업로드를 처리합니다.
  - `injectedScript.ts`: WebView에 주입되는 브릿지 스크립트입니다.
- `scripts/sync-web-build.mjs`: 웹 빌드 후 분리 모듈 import map을 포함한 native 번들을 생성합니다.

## 환경변수

WebView 안의 `/graphql`, `/tour-api`, `/map-direction` 요청은 Vite dev proxy 대신 native bridge에서 직접 호출합니다.

```bash
APP_VARIANT=dev
EXPO_PUBLIC_GRAPHQL_ENDPOINT=http://192.168.0.144:4000/graphql
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=...
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=...
EXPO_PUBLIC_NCP_MAPS_KEY_ID=...
EXPO_PUBLIC_NCP_MAPS_KEY=...
```

`EXPO_PUBLIC_GRAPHQL_ENDPOINT`는 현재 Mac의 LAN IP로 맞춰야 실기기에서도 로컬 API에 붙을 수 있습니다. iOS 시뮬레이터만 쓸 때는 `http://127.0.0.1:4000/graphql`도 사용할 수 있습니다.

앱 variant는 아래처럼 나뉩니다.

| 값 | 용도 | 원격 웹 번들 |
| --- | --- | --- |
| `none` 또는 빈 값 | 로컬 시뮬레이터 개발 | 사용 안 함 |
| `dev` | dev/TestFlight 앱 | dev R2 manifest 사용 |
| `prod` | 운영 앱 | prod R2 manifest 사용 |

Google OAuth iOS 클라이언트의 번들 ID도 variant와 정확히 맞아야 합니다.

## 테스트 플래그

설치 앱에서 방문 인증과 도착 알림을 테스트할 때는 dev 계열 빌드에 아래 값을 켭니다.

```bash
EXPO_PUBLIC_ROUTEONE_DEV_VERIFICATION_BYPASS=1
EXPO_PUBLIC_ROUTEONE_ARRIVAL_NOTIFICATION_TEST_MODE=1
```

`EXPO_PUBLIC_ROUTEONE_DEV_VERIFICATION_BYPASS=1`이면 WebView가 현재 GPS를 요청하지 않고 장소 좌표로 방문 인증 위치를 만듭니다. API 서버도 같은 테스트를 허용하려면 서버에 `ROUTEONE_DEV_VERIFICATION_BYPASS=1`이 켜져 있어야 합니다.

`EXPO_PUBLIC_ROUTEONE_ARRIVAL_NOTIFICATION_TEST_MODE=1`이면 오늘 날짜의 다음 방문지를 동기화한 뒤 100m 근처에 온 것처럼 테스트 알림을 한 번 발송합니다.

## 앱 버전

사용자에게 표시되는 앱 버전은 `apps/native/app-versions.json`에서 앱 종류와 플랫폼별로 관리합니다.

```json
{
  "dev": { "ios": "1.0.0", "android": "1.0.0" },
  "prod": { "ios": "1.0.0", "android": "1.0.0" }
}
```

iOS만 수정 배포할 때는 `prod.ios`만 올리고, Android만 수정 배포할 때는 `prod.android`만 올립니다. EAS 설정은 `appVersionSource: "remote"`와 `autoIncrement: true`를 사용하므로 iOS build number와 Android version code는 EAS remote version에서 자동 증가합니다.

## 앱 정보 브릿지

WebView에서는 `window.RouteOneNative.getAppInfo()`로 현재 네이티브 앱과 웹 번들 정보를 조회할 수 있습니다.

```ts
const appInfo = await window.RouteOneNative?.getAppInfo?.();
```

응답에는 `platform`, `osVersion`, `appVersion`, `buildNumber`, `runtimeVersion`, `bundleIdentifier`, `webBundleVersion`, `webBundleKind`, `webBundleChannel`, `appVariant`가 포함됩니다. 원격으로 설치한 웹 번들은 manifest의 `version`을 반환하고, 앱 내장 번들은 `webBundleVersion`이 `null`이며 `webBundleKind`가 `embedded`로 반환됩니다.

## 웹 번들 R2 배포

`main` 브랜치에 push하면 `prod`, `develop` 브랜치에 push하면 `dev` 채널 웹 번들을 GitHub Actions에서 빌드하고 각각의 R2 버킷에 업로드합니다.

dev와 prod는 서로 다른 R2 버킷을 사용하고, 각 버킷 안에는 아래 구조로 업로드합니다.

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

`latest/manifest.json`은 최신 release의 manifest와 같은 내용을 담고, 네이티브 앱이 최신 웹 버전과 다운로드 주소를 확인할 때 사용합니다. release manifest에는 `version`, `channel`, `appVariant`, `bundleUrl`, `entryUrl`, `entryPath`, `sha256`, `createdAt`, `runtimeReadySignal`, `minimumNativeVersion`이 들어갑니다.

`EXPO_PUBLIC_WEB_BUNDLE_BASE_URL`은 manifest와 ZIP을 받아오는 공개 R2 주소이며, WebView가 실제 페이지 origin으로 사용하는 주소입니다. 네이버 지도 Web 서비스 URL에는 이 R2 origin을 등록합니다. manifest의 `bundleUrl`과 `entryUrl`도 같은 R2 origin 기준으로 생성됩니다.

`minimumNativeVersion`은 앱 업데이트 팝업용이 아니라 웹 번들 호환성 가드입니다. 현재 네이티브 앱 버전이 이 값보다 낮으면 새 웹 번들을 설치하지 않고 기존 번들이나 내장 번들을 사용합니다.

앱은 manifest의 `channel`이 현재 앱의 `dev` 또는 `prod` 채널과 맞는지 먼저 확인합니다. 채널이 다르면 버전 비교와 설치를 건너뛰고, 채널이 맞을 때만 manifest 버전과 최소 네이티브 버전을 확인합니다. 새 ZIP은 다운로드, SHA-256 검증, 압축 해제 단계를 각각 최대 3회 시도한 뒤 앱 문서 디렉터리에 적용합니다. 설치 준비가 3회 모두 실패하면 종료 안내 팝업을 띄우고, 새 번들이 설치된 뒤 처음 로드되지 않으면 직전 로컬 번들로 되돌아갑니다.

버전 폴더명은 기본적으로 `1.0.{GitHub Actions 실행번호}` 형식입니다. Repository variable `ROUTEONE_WEB_VERSION_PREFIX`를 바꾸면 `1.1.{실행번호}`처럼 앞자리를 변경할 수 있고, Actions에서 수동 실행할 때는 `version` 입력값으로 정확한 버전을 지정할 수 있습니다.

`releases`에는 최신 버전 폴더 5개만 유지하고, 오래된 버전은 폴더 안의 `manifest.json`과 `web-ui.zip`을 함께 삭제합니다.

GitHub 저장소의 `Settings > Secrets and variables > Actions`에서 아래 Repository secrets를 등록해야 합니다.

- 공통: `CLOUDFLARE_ACCOUNT_ID`
- dev: `CLOUDFLARE_R2_ACCESS_KEY_ID_DEV`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY_DEV`, `R2_BUCKET_NAME_DEV`, `R2_PUBLIC_BASE_URL_DEV`
- prod: `CLOUDFLARE_R2_ACCESS_KEY_ID_PROD`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY_PROD`, `R2_BUCKET_NAME_PROD`, `R2_PUBLIC_BASE_URL_PROD`

Repository variable `ROUTEONE_WEB_VERSION_PREFIX`는 선택값이며 기본값은 `1.0`입니다. R2 manifest의 플랫폼별 최소 네이티브 버전은 `apps/native/app-versions.json`에서 읽습니다.

R2 버킷과 API Token은 dev/prod용으로 각각 만들고, 각 Token의 `Object Read & Write` 권한을 해당 버킷 하나로 제한합니다. 워크플로는 `develop`에서 `_DEV`, `main`에서 `_PROD` 시크릿을 선택합니다.

`R2_PUBLIC_BASE_URL_DEV`, `R2_PUBLIC_BASE_URL_PROD`에는 각 버킷의 공개 URL을 넣습니다. 이 URL의 origin을 네이버 지도 Web 서비스 URL에도 등록합니다. R2 Access Key는 GitHub Actions에서만 사용하고 네이티브 앱에는 포함하지 않습니다.

## 추후 구현 대상

네이티브 앱 자체의 업데이트 팝업은 현재 웹 번들 manifest와 별개입니다. 마켓 URL이 생기면 R2에 `native/latest.json` 같은 별도 manifest를 두고 `latestVersion`, `minimumVersion`, `storeUrl`을 관리하는 방식으로 추가합니다.

## 문제 해결 체크

로컬 시뮬레이터에서 원격 웹 번들이 섞이는 것 같으면 `APP_VARIANT=none`으로 실행 중인지 먼저 확인합니다. 루트 명령어 `pnpm native:ios:local`은 이 값을 자동으로 넣고, R2 manifest와 저장된 원격 번들을 사용하지 않습니다.

WebView에서 `VITE_VISITKOREA_SERVICE_KEY is empty` 같은 메시지가 보이면 `apps/web/.env` 값을 확인한 뒤 웹 번들을 다시 동기화합니다.

```bash
pnpm native:build:webview
```

네이버 지도 인증 실패가 계속되면 네이버 콘솔 등록 URL뿐 아니라 WebView가 실제 원격 `entryUrl`로 실행 중인지 확인합니다. 네이버 지도 SDK는 `webBundlePublicOrigin`이나 `<base href>`가 아니라 `window.location.href`를 인증 URL로 사용하므로, 앱이 내장 HTML fallback으로 실행되면 R2 origin을 등록해도 인증이 실패할 수 있습니다. 앱 정보의 웹 번들 종류가 `remote` 또는 `installed`인지 확인하고, dev/prod 빌드 환경에 `EXPO_PUBLIC_WEB_BUNDLE_BASE_URL`이 들어간 상태로 다시 빌드합니다.

`app.config.ts`의 iOS 설정이 Xcode 프로젝트에 반영되지 않으면 prebuild를 다시 실행합니다.

```bash
pnpm native:ios:dev
```

TestFlight에서 새 빌드가 내부 테스터에게 업데이트로 보이지 않으면 App Store Connect에서 빌드 Processing 완료, 수출 규정 상태, 내부 테스트 그룹 연결 여부를 확인합니다.
