import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  useColorScheme,
  View
} from "react-native";
import NativeLoginStep from "./components/native-onboarding/NativeLoginStep";
import NativeOnboardingStep, {
  useNativeOnboardingTheme
} from "./components/native-onboarding/NativeOnboardingStep";
import NativeWebViewScreen from "./components/native-webview/NativeWebViewScreen";
import RouteOneLaunchScreen from "./components/native-webview/RouteOneLaunchScreen";
import { useNativeBoot } from "./boot/useNativeBoot";
import { useNativeLogin } from "./auth/useNativeLogin";

const onboardingText = {
  ko: {
    locationTitle: "위치 권한 허용",
    locationDescription:
      "장소 근처에 도착했는지 확인하고 사진 인증을 도와드릴게요.",
    notificationTitle: "알림 권한 허용",
    notificationDescription:
      "오늘 방문할 장소 근처에 도착하면 알림으로 알려드릴게요.",
    allow: "허용",
    checking: "확인 중",
    later: "나중에",
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
    allow: "Allow",
    checking: "Checking",
    later: "Later",
    sessionExpired: "You were signed out after 7 days of inactivity.",
    launchPreparing: "Preparing the app.",
    launchTagline: "From first plan to final stop"
  }
} as const;

export default function App() {
  const colorScheme = useColorScheme();
  const brandBackgroundColor =
    colorScheme === "dark" ? "#061918" : "#0f766e";
  const onboardingTheme = useNativeOnboardingTheme();
  const {
    appLanguage,
    bootStep,
    completeNativeLogin,
    handleNativeAuthSessionChange,
    isAuthSessionExpired,
    isRequestingLocationPermission,
    isRequestingNotificationPermission,
    nativeAuthExpiresAt,
    nativeAuthToken,
    requestLocationPermission,
    requestNotificationPermission,
    selectAppLanguage,
    skipLocationPermission,
    skipNotificationPermission
  } = useNativeBoot();
  const nativeLogin = useNativeLogin({
    onComplete: completeNativeLogin
  });
  const text = onboardingText[appLanguage];

  if (bootStep === "checking") {
    return (
      <View
        style={[
          styles.launchContainer,
          { backgroundColor: brandBackgroundColor }
        ]}
      >
        <StatusBar
          barStyle="light-content"
          backgroundColor={brandBackgroundColor}
        />
        <RouteOneLaunchScreen
          message={text.launchPreparing}
          progress={0.06}
          tagline={text.launchTagline}
        />
      </View>
    );
  }

  if (bootStep === "language") {
    return (
      <SafeAreaView
        style={[
          styles.container,
          { backgroundColor: onboardingTheme.background }
        ]}
      >
        <StatusBar
          barStyle={colorScheme === "dark" ? "light-content" : "dark-content"}
          backgroundColor={onboardingTheme.background}
        />
        <NativeOnboardingStep
          description="RouteOne에서 사용할 언어를 선택해 주세요. Choose the language to use in RouteOne."
          primaryAction={{
            label: "English",
            onPress: () => {
              void selectAppLanguage("en");
            },
            variant: "primary"
          }}
          secondaryAction={{
            label: "한국어",
            onPress: () => {
              void selectAppLanguage("ko");
            },
            variant: "secondary"
          }}
          title="사용 언어 / Language"
        />
      </SafeAreaView>
    );
  }

  if (bootStep === "location") {
    return (
      <SafeAreaView
        style={[
          styles.container,
          { backgroundColor: onboardingTheme.background }
        ]}
      >
        <StatusBar
          barStyle={colorScheme === "dark" ? "light-content" : "dark-content"}
          backgroundColor={onboardingTheme.background}
        />
        <NativeOnboardingStep
          description={text.locationDescription}
          primaryAction={{
            disabled: isRequestingLocationPermission,
            label: text.allow,
            loadingLabel: text.checking,
            onPress: () => {
              void requestLocationPermission();
            },
            variant: "primary"
          }}
          secondaryAction={{
            disabled: isRequestingLocationPermission,
            label: text.later,
            onPress: () => {
              void skipLocationPermission();
            },
            variant: "secondary"
          }}
          title={text.locationTitle}
        />
      </SafeAreaView>
    );
  }

  if (bootStep === "notification") {
    return (
      <SafeAreaView
        style={[
          styles.container,
          { backgroundColor: onboardingTheme.background }
        ]}
      >
        <StatusBar
          barStyle={colorScheme === "dark" ? "light-content" : "dark-content"}
          backgroundColor={onboardingTheme.background}
        />
        <NativeOnboardingStep
          description={text.notificationDescription}
          primaryAction={{
            disabled: isRequestingNotificationPermission,
            label: text.allow,
            loadingLabel: text.checking,
            onPress: () => {
              void requestNotificationPermission();
            },
            variant: "primary"
          }}
          secondaryAction={{
            disabled: isRequestingNotificationPermission,
            label: text.later,
            onPress: skipNotificationPermission,
            variant: "secondary"
          }}
          title={text.notificationTitle}
        />
      </SafeAreaView>
    );
  }

  if (bootStep === "login") {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: brandBackgroundColor }]}
      >
        <StatusBar
          barStyle="light-content"
          backgroundColor={brandBackgroundColor}
        />
        <NativeLoginStep
          accountId={nativeLogin.accountId}
          activeProvider={nativeLogin.activeProvider}
          appleAvailable={nativeLogin.appleAvailable}
          displayName={nativeLogin.displayName}
          errorMessage={nativeLogin.errorMessage}
          language={appLanguage}
          onAppleLogin={() => {
            void nativeLogin.handleAppleLogin();
          }}
          onChangeAccountId={nativeLogin.setAccountId}
          onChangeDisplayName={nativeLogin.setDisplayName}
          onChangePassword={nativeLogin.setPassword}
          onGoogleLogin={() => {
            void nativeLogin.handleGoogleLogin();
          }}
          onPasswordLogin={() => {
            void nativeLogin.handlePasswordLogin();
          }}
          password={nativeLogin.password}
          toastMessage={isAuthSessionExpired ? text.sessionExpired : null}
        />
      </SafeAreaView>
    );
  }

  return (
    <NativeWebViewScreen
      appLanguage={appLanguage}
      nativeAuthExpiresAt={nativeAuthExpiresAt}
      nativeAuthToken={nativeAuthToken}
      onAuthSessionChange={handleNativeAuthSessionChange}
    />
  );
}

const styles = StyleSheet.create({
  launchContainer: {
    flex: 1
  },
  container: {
    flex: 1,
    backgroundColor: "#ffffff"
  }
});
