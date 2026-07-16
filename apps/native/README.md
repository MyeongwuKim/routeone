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

클라이언트 앱에 API secret이 들어가는 구조라, 실제 배포에서는 별도 백엔드 프록시로 옮기는 게 좋아요.
