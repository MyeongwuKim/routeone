# RouteOne Native

React Native WebView로 `apps/web` 빌드 산출물을 감싸는 하이브리드 앱이에요.

## 구조

- `src/App.tsx`: WebView 컨테이너
- `src/generated/webBundle.ts`: `apps/web/dist`를 단일 HTML 문자열로 인라인한 결과
- `src/webview/nativeFetchBridge.ts`: WebView 안의 `/tour-api`, `/map-direction` 요청을 네이티브 fetch로 프록시
- `scripts/sync-web-build.mjs`: 웹 빌드 후 native 번들 생성

## 실행

```bash
cd apps/native
npm install
npm run start
```

웹앱까지 다시 빌드해서 번들을 갱신하려면 아래 명령을 사용해요.

```bash
npm run build:webview
```

## 환경변수

`/map-direction` 요청은 기존 Vite dev proxy 대신 native bridge에서 직접 호출해요.

```bash
EXPO_PUBLIC_NCP_MAPS_KEY_ID=...
EXPO_PUBLIC_NCP_MAPS_KEY=...
```

클라이언트 앱에 API secret이 들어가는 구조라, 실제 배포에서는 별도 백엔드 프록시로 옮기는 게 좋아요.
