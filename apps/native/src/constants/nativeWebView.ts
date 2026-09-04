export const AUTH_TOKEN_STORAGE_KEY = "routeone.authToken";
export const AUTH_SESSION_EXPIRES_AT_STORAGE_KEY =
  "routeone.authSessionExpiresAt";
export const APP_LANGUAGE_STORAGE_KEY = "routeone-app-language";
export const DEV_BUILD_BADGE_LABEL = "DEV";

export const APP_ACTIVE_EVENT_SCRIPT = `
  window.dispatchEvent(new Event("routeone:native-app-active"));
  true;
`;

export const REQUEST_WEB_BUNDLE_READY_SCRIPT = `
  window.dispatchEvent(
    new Event("routeone:native-request-web-bundle-ready")
  );
  true;
`;

export const WEB_VIEW_TEXT = {
  ko: {
    fatalAlertConfirm: "예",
    fatalAlertDescription: "앱을 종료한 뒤 다시 실행해 주세요.",
    fatalAlertTitle: "업데이트를 적용하지 못했어요",
    fatalInstallMessages: {
      download: "업데이트 파일을 3번 시도했지만 내려받지 못했어요.",
      extract: "업데이트 압축을 3번 시도했지만 풀지 못했어요.",
      verify: "업데이트 파일을 3번 시도했지만 확인하지 못했어요."
    },
    launchTagline: "여행의 시작부터 도착까지",
    loadErrorTitle: "웹앱을 불러오지 못했어요.",
    loadingRouteOne: "RouteOne을 불러오고 있어요.",
    prepareFailed: "웹 번들을 준비하지 못했어요.",
    progressMessages: {
      applying: "새 버전을 적용하고 있어요.",
      checking: "최신 버전을 확인하고 있어요.",
      downloading: "업데이트를 내려받고 있어요.",
      extracting: "업데이트 압축을 풀고 있어요.",
      loading: "RouteOne을 불러오고 있어요.",
      preparing: "저장된 버전을 확인하고 있어요.",
      ready: "준비가 끝났어요.",
      rollback: "이전 버전으로 복구하고 있어요.",
      verifying: "업데이트 파일을 확인하고 있어요."
    },
    ready: "준비가 끝났어요.",
    reloadingRouteOne: "RouteOne을 다시 불러오고 있어요.",
    retry: "다시 시도",
    restoringPrevious: "이전 버전으로 복구하고 있어요.",
    webViewReadyTimeout:
      "웹 화면이 응답하지 않아 자동 복구하지 못했어요. 다시 시도해 주세요.",
    waitingReadySignal: "웹 화면 준비 신호를 기다리고 있어요."
  },
  en: {
    fatalAlertConfirm: "Yes",
    fatalAlertDescription: "The app will close. Please open it again.",
    fatalAlertTitle: "Could not apply the update",
    fatalInstallMessages: {
      download: "The update file could not be downloaded after 3 attempts.",
      extract: "The update archive could not be extracted after 3 attempts.",
      verify: "The update file could not be verified after 3 attempts."
    },
    launchTagline: "From first plan to final stop",
    loadErrorTitle: "Could not load the web app.",
    loadingRouteOne: "Loading RouteOne.",
    prepareFailed: "Could not prepare the web bundle.",
    progressMessages: {
      applying: "Applying the new version.",
      checking: "Checking for updates.",
      downloading: "Downloading the update.",
      extracting: "Extracting the update.",
      loading: "Loading RouteOne.",
      preparing: "Checking the saved version.",
      ready: "Ready.",
      rollback: "Restoring the previous version.",
      verifying: "Verifying the update file."
    },
    ready: "Ready.",
    reloadingRouteOne: "Loading RouteOne again.",
    retry: "Try again",
    restoringPrevious: "Restoring the previous version.",
    webViewReadyTimeout:
      "The web screen did not respond after automatic recovery. Please try again.",
    waitingReadySignal: "Waiting for the web screen to be ready."
  }
} as const;
