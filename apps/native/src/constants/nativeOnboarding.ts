export const LOGIN_THEME = {
  light: {
    background: "#0f766e",
    brandText: "#ffffff",
    mutedText: "rgba(255, 255, 255, 0.76)",
    buttonBorder: "rgba(255, 255, 255, 0.38)",
    googleBackground: "#ffffff",
    googlePressed: "#edf7f4",
    googleText: "#111827",
    appleBackground: "#111827",
    applePressed: "#030712",
    appleText: "#ffffff",
    divider: "rgba(255, 255, 255, 0.26)",
    inputBackground: "rgba(255, 255, 255, 0.94)",
    inputBorder: "rgba(255, 255, 255, 0.28)",
    inputText: "#0f172a",
    placeholder: "#8ba19c",
    passwordBackground: "#ffffff",
    passwordPressed: "#def2ed",
    passwordText: "#0f766e",
    errorBackground: "#fff1f2",
    errorBorder: "#fecdd3",
    errorText: "#be123c"
  },
  dark: {
    background: "#061918",
    brandText: "#f8fafc",
    mutedText: "rgba(226, 245, 241, 0.72)",
    buttonBorder: "rgba(148, 216, 204, 0.18)",
    googleBackground: "#eef7f4",
    googlePressed: "#d7ebe5",
    googleText: "#0f172a",
    appleBackground: "#f8fafc",
    applePressed: "#dbe4e1",
    appleText: "#020617",
    divider: "rgba(226, 245, 241, 0.2)",
    inputBackground: "rgba(13, 36, 34, 0.9)",
    inputBorder: "rgba(148, 216, 204, 0.22)",
    inputText: "#f8fafc",
    placeholder: "#78948f",
    passwordBackground: "#14b8a6",
    passwordPressed: "#0f9488",
    passwordText: "#042f2e",
    errorBackground: "#3a121b",
    errorBorder: "#7f1d1d",
    errorText: "#fecdd3"
  }
} as const;

export const LOGIN_TEXT = {
  ko: {
    appleChecking: "Apple 확인 중",
    appleContinue: "Apple로 계속",
    appleIosOnly: "iOS에서 사용 가능",
    applePermissionError: "Apple 로그인 권한을 켠 뒤 앱을 다시 설치해 주세요.",
    applePreparing: "Apple 준비 중",
    checking: "확인 중",
    displayNamePlaceholder: "닉네임(선택)",
    errorTitle: "계속 진행하지 못했어요",
    googleChecking: "Google 확인 중",
    googleConfigurationError:
      "Google 로그인 설정이 앱에 아직 반영되지 않았어요. 앱을 다시 설치한 뒤 시도해 주세요.",
    googleContinue: "Google로 계속",
    passwordPlaceholder: "비밀번호",
    reviewerAccount: "심사 전용 계정",
    reviewerAccountContinue: "심사 계정으로 계속",
    testAccount: "테스트 계정",
    testAccountContinue: "테스트 계정으로 계속",
    accountIdPlaceholder: "아이디"
  },
  en: {
    appleChecking: "Checking Apple",
    appleContinue: "Continue with Apple",
    appleIosOnly: "Available on iOS",
    applePermissionError:
      "Turn on Sign in with Apple, then reinstall the app.",
    applePreparing: "Preparing Apple",
    checking: "Checking",
    displayNamePlaceholder: "Nickname (optional)",
    errorTitle: "Could not continue",
    googleChecking: "Checking Google",
    googleConfigurationError:
      "Google sign-in configuration has not been applied to this app yet. Reinstall the app and try again.",
    googleContinue: "Continue with Google",
    passwordPlaceholder: "Password",
    reviewerAccount: "Reviewer account",
    reviewerAccountContinue: "Continue with reviewer account",
    testAccount: "Test account",
    testAccountContinue: "Continue with test account",
    accountIdPlaceholder: "ID"
  }
} as const;

export const ONBOARDING_TEXT = {
  ko: {
    locationTitle: "위치 권한 허용",
    locationDescription:
      "장소 근처에 도착했는지 확인하고 사진 인증을 도와드릴게요.",
    notificationTitle: "알림 권한 허용",
    notificationDescription:
      "오늘 방문할 장소 근처에 도착하면 알림으로 알려드릴게요.",
    requestPermission: "권한 요청하기",
    checking: "확인 중",
    sessionExpired: "7일 동안 접속하지 않아 로그아웃되었어요.",
    launchPreparing: "앱을 준비하고 있어요.",
    launchTagline: "여행의 시작부터 도착까지"
  },
  en: {
    locationTitle: "Allow Location",
    locationDescription:
      "RouteOne uses your location to help confirm arrivals and visit photos.",
    notificationTitle: "Allow Notifications",
    notificationDescription:
      "RouteOne can notify you when you are near a place on today's route.",
    requestPermission: "Request Permission",
    checking: "Checking",
    sessionExpired: "You were signed out after 7 days of inactivity.",
    launchPreparing: "Preparing the app.",
    launchTagline: "From first plan to final stop"
  }
} as const;

export const ONBOARDING_THEME = {
  light: {
    background: "#f8fafc",
    brandText: "#0f766e",
    mutedText: "#64748b",
    cardBackground: "#ffffff",
    cardBorder: "#e2e8f0",
    title: "#0f172a",
    description: "#475569",
    primaryBackground: "#0f766e",
    primaryPressed: "#115e59",
    primaryText: "#ffffff",
    secondaryBackground: "#ffffff",
    secondaryPressed: "#edf7f4",
    secondaryBorder: "#d5e7e1",
    secondaryText: "#0f766e"
  },
  dark: {
    background: "#061918",
    brandText: "#f8fafc",
    mutedText: "rgba(226, 245, 241, 0.76)",
    cardBackground: "rgba(13, 36, 34, 0.92)",
    cardBorder: "rgba(148, 216, 204, 0.18)",
    title: "#f8fafc",
    description: "rgba(226, 245, 241, 0.76)",
    primaryBackground: "#14b8a6",
    primaryPressed: "#0f9488",
    primaryText: "#042f2e",
    secondaryBackground: "rgba(13, 36, 34, 0.88)",
    secondaryPressed: "rgba(20, 184, 166, 0.18)",
    secondaryBorder: "rgba(148, 216, 204, 0.22)",
    secondaryText: "#e2f5f1"
  }
} as const;
