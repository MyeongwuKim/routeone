# RouteOne Native

React Native WebView로 `apps/web` 빌드 산출물을 감싸는 하이브리드 앱입니다.

## 명령어 빠른 선택

루트에서 실행하는 명령어를 우선 사용합니다.

| 상황 | 명령어 | 설명 |
| --- | --- | --- |
| iOS 시뮬레이터 빌드 테스트 | `pnpm native:ios:local` | `EXPO_PUBLIC_GRAPHQL_ENDPOINT`에 현재 실행 중인 API 주소를 넣고, `APP_VARIANT=none` 앱을 빌드해 시뮬레이터에서 실행합니다. |
| iPhone 실기기 빌드 테스트 | `pnpm native:ios:device` | 연결된 iPhone을 선택하고 Metro에 연결되는 `APP_VARIANT=none` 로컬 개발 앱을 빌드해 설치합니다. |
| dev TestFlight용 Xcode 프로젝트 생성 | `pnpm native:ios:dev` | `APP_VARIANT=dev`로 `ios/`의 `.xcodeproj`와 `.xcworkspace`를 생성 또는 갱신합니다. |
| 로컬 Android 실행 | `pnpm native:android` | `APP_VARIANT=none`으로 Android 앱을 빌드하고 실행합니다. |
| 이미 설치된 dev client 실행 | `pnpm native:start` | 웹 번들을 다시 빌드하지 않고 Metro dev server를 실행합니다. |
| Expo Go 실행 | `pnpm native:start:go` | Expo Go로 확인해야 할 때만 사용합니다. |
| 테스트 중 웹 UI 동기화 | `pnpm native:sync:web` | `apps/web`을 다시 빌드하고 Native WebView 번들을 갱신합니다. |
| 웹뷰 번들 갱신 | `pnpm native:build:webview` | `apps/web/dist`를 native WebView용 번들로 변환합니다. |
| 타입 체크 | `pnpm native:typecheck` | native TypeScript 타입 검사를 실행합니다. |

`pnpm native:ios`는 로컬 실행인지 Xcode 파일 생성인지 헷갈리기 때문에 사용하지 않습니다. 로컬 시뮬레이터 실행은 `native:ios:local`, dev Xcode 파일 생성은 `native:ios:dev`로 구분합니다.

## 빌드 테스트 순서

Native 변경사항은 아래 순서로 확인합니다.

1. `local`: `pnpm native:ios:local`로 iOS 시뮬레이터 빌드 테스트
2. `device`: `pnpm native:ios:device`로 연결된 iPhone 실기기 빌드 테스트
3. `dev`: `pnpm native:ios:dev`로 dev용 Xcode 프로젝트 생성 후 dev TestFlight 빌드 테스트
4. `prod`: dev 검증 완료 후 Expo/EAS에 운영 빌드를 올려 App Store Connect 업로드와 TestFlight 테스트

`local → device → dev → prod` 순서로 진행하며, 앞 단계에서 확인된 빌드만 다음 단계로 넘깁니다.

## 로컬 빌드 테스트 방법

이 앱은 Expo Go보다 native WebView 앱을 직접 빌드해 확인하는 흐름을 기본으로 사용합니다. 테스트할 API는 먼저 별도 터미널에서 실행해 둡니다.

```bash
pnpm dev:api
```

로컬 시뮬레이터와 연결된 iPhone의 Metro 개발 앱을 테스트할 때는 `APP_VARIANT`를 비활성 상태인 `none` 또는 미설정으로 두는 것을 권장합니다. 이 상태에서는 `EXPO_PUBLIC_WEB_BUNDLE_BASE_URL`이 있거나 이전에 원격 번들을 설치했어도 이를 무시하고 앱에 내장된 로컬 번들을 사용합니다. `dev`나 `prod`를 사용하면 variant별 앱 식별자와 R2 원격 웹 번들 채널이 적용되어, `native:sync:web`으로 갱신한 로컬 UI 대신 저장되어 있던 번들이나 원격 번들이 열릴 수 있습니다. 이 경우 현재 수정한 화면을 테스트하는지 구분하기 어려워집니다.

루트 명령어인 `pnpm native:ios:local`과 `pnpm native:ios:device`는 `APP_VARIANT=none`을 자동으로 적용하므로 별도로 설정할 필요가 없습니다. Native 패키지 안에서 하위 명령어를 직접 실행할 때만 `APP_VARIANT` 값을 확인합니다.

### iOS 시뮬레이터 빌드 테스트

로컬 iOS 시뮬레이터에서 테스트할 때는 `EXPO_PUBLIC_GRAPHQL_ENDPOINT`에 현재 실행 중인 API의 GraphQL 주소를 넣고 실행합니다. API를 기본 포트로 실행 중이라면 아래처럼 사용할 수 있습니다.

```bash
EXPO_PUBLIC_GRAPHQL_ENDPOINT=http://127.0.0.1:4000/graphql pnpm native:ios:local
```

시뮬레이터에서는 `127.0.0.1`이 현재 Mac을 가리키므로 로컬 API에 바로 연결할 수 있습니다. 다른 포트나 배포 API를 사용하고 있다면 `EXPO_PUBLIC_GRAPHQL_ENDPOINT`를 해당 API 주소로 바꿉니다.

`native:ios:local`은 내부적으로 아래 일을 실행합니다.

- `APP_VARIANT=none` 설정
- `apps/web/dist`를 native WebView 번들로 동기화
- `expo prebuild --platform ios` 실행
- iOS 권한 문구 동기화
- `expo run:ios`로 시뮬레이터 실행

### iPhone 실기기 빌드 테스트

USB로 연결된 iPhone에서 테스트할 때는 `EXPO_PUBLIC_GRAPHQL_ENDPOINT`에 현재 Mac에서 실행 중인 로컬 API 주소를 넣고 아래 명령어를 사용합니다.

```bash
EXPO_PUBLIC_GRAPHQL_ENDPOINT=http://192.168.0.144:4000/graphql pnpm native:ios:device
```

`192.168.0.144` 부분은 현재 Mac의 LAN IP로 바꿉니다. 실기기에서 `127.0.0.1`은 Mac이 아니라 iPhone 자신을 가리키므로 로컬 API에 연결할 수 없습니다. Mac과 iPhone은 같은 네트워크에 있어야 합니다.

명령 실행 후 표시되는 기기 목록에서 현재 연결된 iPhone을 선택합니다. 그러면 Metro 개발 서버에 연결되는 네이티브 개발 앱을 새로 빌드해 선택한 iPhone에 설치하고 실행합니다. 기존 앱이 설치되어 있으면 같은 앱 식별자의 새 빌드로 교체하며, `APP_VARIANT=none`을 사용하므로 R2 원격 웹 번들을 확인하지 않습니다.

### 테스트 중 웹 UI 수정 사항 반영

`native:ios:local` 또는 `native:ios:device`로 앱을 실행한 상태에서 `apps/web`의 UI를 수정했다면 아래 명령어로 웹 화면을 갱신합니다.

```bash
pnpm native:sync:web
```

이 명령어는 `apps/web`을 다시 빌드하고 결과물을 `apps/native/src/generated/webBundle.ts`에 동기화합니다. 실행 중인 Metro가 변경된 번들을 감지하면 시뮬레이터나 iPhone에서 수정한 웹 화면을 다시 확인할 수 있습니다. 화면이 자동으로 바뀌지 않으면 앱을 한 번 새로고침합니다.

웹 UI만 수정했다면 Xcode 프로젝트를 다시 만들 필요는 없습니다. 네이티브 코드, 권한 또는 네이티브 의존성을 변경한 경우에는 `native:ios:local` 또는 `native:ios:device` 빌드를 다시 실행합니다.

### 설치된 개발 앱 다시 실행

이미 앱이 설치되어 있고 Metro만 다시 띄우면 되는 상황에서는 아래 명령어를 사용합니다.

```bash
pnpm native:start
```

## dev TestFlight용 Xcode 프로젝트 생성

시뮬레이터와 연결된 iPhone 테스트를 마친 뒤 dev TestFlight 빌드를 준비할 때 아래 명령어를 사용합니다.

```bash
pnpm native:ios:dev
```

이 명령어는 `APP_VARIANT=dev`로 `expo prebuild --platform ios`를 실행하고, `apps/native/ios/`에 Xcode용 `.xcodeproj`와 `.xcworkspace`를 생성 또는 갱신합니다. 생성된 Xcode 프로젝트는 dev 앱의 네이티브 설정과 빌드를 확인하고 TestFlight 업로드를 준비할 때 사용합니다.

`native:ios:dev`는 Xcode 프로젝트 생성까지만 수행하며 TestFlight에 직접 업로드하지 않습니다. 실제 dev TestFlight 빌드와 업로드는 아래 `TestFlight` 카테고리의 `eas:build:ios:dev`, `eas:submit:ios:dev` 명령어로 진행합니다.

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

운영 앱은 `APP_VARIANT=prod`와 `production` 프로필을 사용합니다. iOS 번들 ID는 `com.routeone.app`, 앱 이름은 `RouteOne`입니다. 운영 빌드는 Expo/EAS 클라우드에 소스를 올려 생성하고, 완성된 빌드를 App Store Connect에 업로드하는 방식입니다.

```bash
cd apps/native
pnpm run eas:build:ios
pnpm run eas:submit:ios
```

EAS 빌드는 Expo/EAS 프로젝트에 등록된 환경변수를 사용합니다. `prod` 빌드에서는 `EXPO_PUBLIC_GRAPHQL_ENDPOINT`를 명령어 앞에 붙이거나 로컬 `.env`에 별도로 설정할 필요가 없습니다. API 주소를 변경해야 할 때는 로컬 명령어가 아니라 Expo/EAS에 등록된 운영 환경변수를 수정합니다.

내부 테스터에게 새 빌드 업데이트가 뜨려면 App Store Connect에서 아래 상태까지 끝나야 합니다.

- 빌드 업로드 및 Processing 완료
- 수출 규정/암호화 질문 완료
- 내부 테스트 그룹에 새 빌드 추가
- 그룹의 자동 배포 설정 또는 수동 배포 완료

iOS 수출 규정 질문을 줄이기 위해 `app.config.ts`의 `ios.infoPlist`에 `ITSAppUsesNonExemptEncryption: false`를 명시합니다. 자체 암호화 알고리즘이나 문서 제출이 필요한 암호화 기능을 추가하면 이 값은 다시 검토해야 합니다.

## 네이티브 앱의 역할과 제공 기능

RouteOne Native는 `apps/web`을 실행하는 앱 컨테이너이면서, 웹만으로 처리하기 어려운 인증, 기기 권한, 알림, 외부 앱 연동과 배포 흐름을 담당합니다. 웹과 네이티브는 `window.RouteOneNative` 브릿지를 통해 기능을 주고받습니다.

| 카테고리 | 네이티브에서 담당하는 일 | 제공 기능 |
| --- | --- | --- |
| 앱 실행과 WebView | 웹 빌드 결과를 네이티브 앱 안에서 실행하고 웹·네이티브 메시지를 연결 | 내장 웹 번들 로드, 실행 준비 상태 확인, 앱 언어 동기화, 런타임 오류 처리 |
| 로그인과 세션 | 앱 진입 전 인증과 로그인 세션을 네이티브 저장소에서 관리 | 아이디·비밀번호, Google, Apple 로그인, 로그인 토큰 저장과 WebView 전달, 로그아웃·만료 처리 |
| 네트워크 브릿지 | WebView 요청을 실제 외부 API로 전달 | `/graphql`, `/tour-api`, `/map-direction` 요청 프록시, 인증 헤더 전달, 요청 타임아웃과 일부 응답 캐시 |
| 위치와 방문 인증 | 위치 권한과 방문 인증에 필요한 기기 기능 관리 | 현재 GPS 조회, 도착 반경 판정용 위치 전달, 카메라·사진 보관함 선택, 방문 사진 업로드, GPS 테스트 위치 적용 |
| 알림 | 웹의 일정 데이터를 네이티브 로컬·푸시 알림과 동기화 | Expo Push Token 발급, 루트 도착 알림, 축제 알림, 루트 후기 알림, 전달된 알림 기록 조회 |
| 외부 앱과 미디어 | WebView 밖에서 처리해야 하는 링크와 파일 작업 수행 | 네이버 지도 앱 길찾기, 앱 미설치 시 웹 길찾기 fallback, 앱 설정 열기, 포토카드 이미지 저장·공유 |
| 웹 번들 업데이트 | 앱에 내장된 웹과 R2 원격 웹 번들의 설치 상태 관리 | manifest 확인, ZIP 다운로드, SHA-256 검증, 버전·채널·최소 네이티브 버전 검사, 설치 실패 재시도와 롤백 |
| 네이티브 앱 업데이트 | 앱 진입 전에 플랫폼별 최소 버전을 확인하고 오래된 앱의 실행을 차단 | dev/prod R2 정책 조회, iOS·Android 개별 버전 비교, App Store·Play Store 이동 |
| 빌드와 배포 | 실행 환경에 따라 앱 식별자와 웹 번들 채널을 구분 | `none`·`dev`·`prod` variant, 시뮬레이터·실기기 빌드, dev/prod TestFlight, Expo/EAS 환경변수 사용 |

웹은 화면과 서비스 흐름을 담당하고, Native는 WebView 실행 환경과 기기 기능을 제공합니다. 앱 버전, 빌드번호, 플랫폼, 현재 웹 번들 정보도 브릿지를 통해 웹에 전달합니다.

## 구조

- 앱 실행
  - `src/App.tsx`: 부팅, 로그인과 WebView 화면을 연결합니다.
  - `src/boot`: 인증 세션과 웹 번들 준비 상태를 확인합니다.
  - `src/components/native-onboarding`: 네이티브 온보딩과 로그인 화면입니다.
  - `src/components/native-webview`: 실행 화면, 로딩 화면과 WebView 컨테이너입니다.
- 인증과 웹 번들
  - `src/auth`: 아이디·비밀번호, Google, Apple 로그인과 네이티브 세션 저장을 처리합니다.
  - `src/webBundle`: R2 manifest 조회, 웹 번들 다운로드·검증·설치·롤백을 처리합니다.
  - `src/generated/webBundle.ts`: `apps/web/dist`를 WebView용 HTML 문자열로 변환한 결과입니다.
- 네이티브 앱 업데이트
  - `src/nativeUpdate`: R2 정책 조회, 캐시 fallback과 플랫폼별 최소 버전 비교를 처리합니다.
  - `src/components/native-update`: WebView 진입 전에 표시하는 강제 업데이트 화면입니다.
- WebView 브릿지
  - `src/webview/bridge/injectedScript.ts`: `window.RouteOneNative` API를 WebView에 주입합니다.
  - `src/webview/bridge/fetchBridge.ts`, `authTokenBridge.ts`: API 요청과 인증 토큰을 연결합니다.
  - `src/webview/bridge/locationBridge.ts`, `visitPhotoBridge.ts`, `saveImageBridge.ts`: 위치, 방문 사진과 이미지 저장·공유를 처리합니다.
  - `src/webview/bridge/pushTokenBridge.ts`, `routeArrivalNotificationBridge.ts`, `festivalNotificationBridge.ts`, `routeReviewNotificationBridge.ts`: 푸시 토큰과 목적별 알림을 처리합니다.
  - `src/webview/bridge/appInfoBridge.ts`, `externalLinkBridge.ts`: 앱 정보와 외부 링크를 처리합니다.
- 빌드
  - `src/config/webBundleUpdateConfig.ts`: variant별 웹 번들 채널과 업데이트 설정입니다.
  - `scripts/sync-web-build.mjs`: 웹 빌드 후 분리 모듈 import map을 포함한 Native 번들을 생성합니다.

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

`EXPO_PUBLIC_ROUTEONE_DEV_VERIFICATION_BYPASS=1`이면 WebView가 현재 GPS를 요청하지 않고 장소 좌표로 방문 인증 위치를 만듭니다. API 서버도 같은 테스트를 허용하려면 서버에 `ROUTEONE_DEV_VERIFICATION_BYPASS=1`이 켜져 있어야 합니다. 도착 알림 테스트 모드가 함께 켜진 경우에는 장소별로 선택한 테스트 위치가 우선되어 다른 장소의 GPS 인증 실패 케이스도 확인할 수 있습니다.

`EXPO_PUBLIC_ROUTEONE_ARRIVAL_NOTIFICATION_TEST_MODE=1`이면 DAY 상세의 각 장소에 GPS 테스트 버튼이 표시됩니다. 버튼을 누르면 장소의 100m 도착 반경과 드래그 가능한 테스트 위치 마커가 있는 지도가 열립니다. 마커를 끌거나 지도를 눌러 좌표를 정한 뒤 적용하면 WebView에서 조회하는 현재 위치가 해당 좌표로 바뀝니다. 장소 반경 안이면 같은 도착 알림 생성 경로로 로컬 알림을 발송하고, 반경 밖이면 위치만 적용해 GPS 실패 케이스를 확인할 수 있습니다. `실제 GPS로 복귀`를 누르거나 앱 프로세스를 다시 시작하면 위치 덮어쓰기가 해제됩니다. 운영 빌드에는 이 플래그를 설정하지 않습니다.

이 버튼으로 알림 내용, 포그라운드 표시, 알림함 동기화, 알림 탭 이동과 GPS 방문 인증을 확인할 수 있습니다. OS의 백그라운드 지오펜스 진입 이벤트 자체는 iOS 시뮬레이터의 위치 시뮬레이션이나 Android 모의 위치로 별도 확인해야 합니다.

## 앱 버전

사용자에게 표시되는 앱 버전은 `apps/native/app-versions.json`에서 앱 종류와 플랫폼별로 관리합니다.

```json
{
  "dev": { "ios": "1.0.0", "android": "1.0.0" },
  "prod": { "ios": "1.0.0", "android": "1.0.0" }
}
```

iOS만 수정 배포할 때는 `prod.ios`만 올리고, Android만 수정 배포할 때는 `prod.android`만 올립니다. EAS 설정은 `appVersionSource: "remote"`와 `autoIncrement: true`를 사용하므로 iOS build number와 Android version code는 EAS remote version에서 자동 증가합니다.

dev/prod Xcode 프로젝트 생성과 EAS 빌드를 시작하면 대상 variant와 플랫폼의 앱 버전을 확인합니다. 표시된 버전이 맞으면 `y` 또는 `yes`를 입력해 계속 진행하고, 다른 입력을 하면 빌드를 중단합니다.

```text
[prod/ios] iOS 앱 버전 1.0.1이 맞나요? (y/N)
```

CI처럼 입력할 수 없는 환경에서는 `CI=1`일 때 확인을 자동 통과합니다. 로컬 자동화에서만 확인을 생략해야 한다면 `ROUTEONE_SKIP_APP_VERSION_CONFIRM=1`을 명시합니다.

## 네이티브 강제 업데이트 정책

`apps/native/minimum-app-versions.json`은 dev/prod와 iOS/Android별 최소 허용 버전과 스토어 URL을 관리하는 원본입니다. 앱은 자신의 variant에 맞는 R2의 `native/latest.json`을 시작 시 조회하며, 현재 앱 버전이 활성화된 `minimumVersion`보다 낮으면 WebView와 로그인 화면에 진입하지 않고 네이티브 업데이트 화면을 표시합니다.

정책은 처음에는 모두 `enabled: false`로 두며, 실제 스토어 또는 테스트 트랙 URL을 등록한 뒤 필요한 플랫폼만 활성화합니다.

```json
{
  "prod": {
    "ios": {
      "enabled": true,
      "minimumVersion": "1.0.1",
      "storeUrl": "https://apps.apple.com/app/id..."
    },
    "android": {
      "enabled": false,
      "minimumVersion": "1.0.0",
      "storeUrl": null
    }
  }
}
```

`develop`에 정책 변경을 push하면 dev R2에 자동 배포합니다. `main`의 prod 정책은 검증만 수행하며, 새 앱 버전이 실제 스토어에서 설치 가능한 상태인지 확인한 뒤 GitHub Actions의 `Publish native update policy to R2`를 `channel=prod`로 수동 실행합니다. 워크플로는 정책을 `native/releases/{커밋 SHA}-{실행 번호}.json`에 보관하고 앱이 조회하는 `native/latest.json`을 갱신합니다.

원격 정책 조회에 실패하면 마지막으로 정상 조회한 정책을 사용하고, 저장된 정책도 없으면 네트워크 장애만으로 앱이 차단되지 않도록 실행을 허용합니다. 로컬 `APP_VARIANT=none` 빌드에서는 강제 업데이트 확인을 사용하지 않습니다.

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

Repository variable `ROUTEONE_WEB_VERSION_PREFIX`는 선택값이며 기본값은 `1.0`입니다. R2 웹 번들 manifest의 플랫폼별 최소 네이티브 버전은 `apps/native/web-bundle-compatibility.json`에서 읽습니다. 이 값은 웹 번들이 새 네이티브 브릿지를 요구할 때만 올리며, 실제 앱 빌드 버전이나 강제 업데이트 최소 버전과 별도로 관리합니다.

R2 버킷과 API Token은 dev/prod용으로 각각 만들고, 각 Token의 `Object Read & Write` 권한을 해당 버킷 하나로 제한합니다. 워크플로는 `develop`에서 `_DEV`, `main`에서 `_PROD` 시크릿을 선택합니다.

`R2_PUBLIC_BASE_URL_DEV`, `R2_PUBLIC_BASE_URL_PROD`에는 각 버킷의 공개 URL을 넣습니다. 이 URL의 origin을 네이버 지도 Web 서비스 URL에도 등록합니다. R2 Access Key는 GitHub Actions에서만 사용하고 네이티브 앱에는 포함하지 않습니다.

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
