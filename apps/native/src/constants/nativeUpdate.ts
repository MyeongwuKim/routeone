export const UPDATE_TEXT = {
  ko: {
    title: "앱 업데이트가 필요해요",
    description:
      "안정적인 사용을 위해 RouteOne을 최신 버전으로\n업데이트해 주세요.",
    currentVersion: "현재 버전",
    minimumVersion: "필요 버전",
    openStore: "스토어에서 업데이트",
    refresh: "업데이트 확인",
    refreshing: "확인 중",
    storeError: "스토어를 열지 못했어요. 잠시 후 다시 시도해 주세요."
  },
  en: {
    title: "App update required",
    description:
      "Update RouteOne to the latest version to continue using the app.",
    currentVersion: "Current version",
    minimumVersion: "Required version",
    openStore: "Update in store",
    refresh: "Check update",
    refreshing: "Checking",
    storeError: "Could not open the store. Please try again."
  }
} as const;

export const UPDATE_THEME = {
  dark: {
    background: "#061918",
    card: "#0d2422",
    border: "rgba(148, 216, 204, 0.22)",
    title: "#f8fafc",
    description: "rgba(226, 245, 241, 0.76)",
    versionBackground: "rgba(20, 184, 166, 0.12)",
    versionLabel: "rgba(226, 245, 241, 0.68)",
    versionValue: "#f8fafc",
    primary: "#14b8a6",
    primaryPressed: "#0f9488",
    primaryText: "#042f2e",
    secondary: "rgba(13, 36, 34, 0.88)",
    secondaryPressed: "rgba(20, 184, 166, 0.18)",
    secondaryText: "#e2f5f1",
    error: "#fda4af"
  },
  light: {
    background: "#f8fafc",
    card: "#ffffff",
    border: "#d5e7e1",
    title: "#0f172a",
    description: "#475569",
    versionBackground: "#edf7f4",
    versionLabel: "#64748b",
    versionValue: "#0f172a",
    primary: "#0f766e",
    primaryPressed: "#115e59",
    primaryText: "#ffffff",
    secondary: "#ffffff",
    secondaryPressed: "#edf7f4",
    secondaryText: "#0f766e",
    error: "#be123c"
  }
} as const;
