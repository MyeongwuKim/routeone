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
import NativeForceUpdateScreen from "./components/native-update/NativeForceUpdateScreen";
import NativeWebViewScreen from "./components/native-webview/NativeWebViewScreen";
import RouteOneLaunchScreen from "./components/native-webview/RouteOneLaunchScreen";
import { useNativeBoot } from "./boot/useNativeBoot";
import { useNativeLogin } from "./auth/useNativeLogin";
import { useNativeUpdate } from "./nativeUpdate/useNativeUpdate";
import { ONBOARDING_TEXT } from "@/constants/nativeOnboarding";
import { WEB_BUNDLE_UPDATE_CONFIG } from "@/config/webBundleUpdateConfig";

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
    updateAppLanguage,
  } = useNativeBoot();
  const nativeLogin = useNativeLogin({
    onComplete: completeNativeLogin
  });
  const nativeUpdate = useNativeUpdate();
  const text = ONBOARDING_TEXT[appLanguage];

  if (nativeUpdate.status === "checking") {
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
          showProgress={false}
          tagline={text.launchTagline}
        />
      </View>
    );
  }

  if (nativeUpdate.status === "required" && nativeUpdate.requirement) {
    return (
      <NativeForceUpdateScreen
        isRefreshing={nativeUpdate.isRefreshing}
        language={appLanguage}
        onRefresh={() => nativeUpdate.checkForNativeUpdate()}
        requirement={nativeUpdate.requirement}
      />
    );
  }

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
            label: text.requestPermission,
            loadingLabel: text.checking,
            onPress: () => {
              void requestLocationPermission();
            },
            variant: "primary"
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
            label: text.requestPermission,
            loadingLabel: text.checking,
            onPress: () => {
              void requestNotificationPermission();
            },
            variant: "primary"
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
          showTestAccountLogin={
            WEB_BUNDLE_UPDATE_CONFIG.appVariant !== "prod"
          }
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
      onAppLanguageChange={updateAppLanguage}
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
