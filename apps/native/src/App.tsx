import { SafeAreaView, StatusBar, StyleSheet, View } from "react-native";
import NativeLoginStep from "./components/native-onboarding/NativeLoginStep";
import NativeOnboardingStep from "./components/native-onboarding/NativeOnboardingStep";
import NativeWebViewScreen from "./components/native-webview/NativeWebViewScreen";
import RouteOneLaunchScreen from "./components/native-webview/RouteOneLaunchScreen";
import { useNativeBoot } from "./boot/useNativeBoot";
import { useNativeLogin } from "./auth/useNativeLogin";

export default function App() {
  const {
    bootStep,
    completeNativeLogin,
    isRequestingLocationPermission,
    nativeAuthToken,
    requestLocationPermission,
    skipLocationPermission
  } = useNativeBoot();
  const nativeLogin = useNativeLogin({
    onComplete: completeNativeLogin
  });

  if (bootStep === "checking") {
    return (
      <View style={styles.launchContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#f7faf9" />
        <RouteOneLaunchScreen
          message="앱을 준비하고 있어요."
          progress={0.06}
        />
      </View>
    );
  }

  if (bootStep === "location") {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <NativeOnboardingStep
          description="장소 근처에 도착했는지 확인하고 사진 인증을 도와드릴게요."
          primaryAction={{
            disabled: isRequestingLocationPermission,
            label: "허용",
            loadingLabel: "확인 중",
            onPress: () => {
              void requestLocationPermission();
            },
            variant: "primary"
          }}
          secondaryAction={{
            disabled: isRequestingLocationPermission,
            label: "나중에",
            onPress: skipLocationPermission,
            variant: "secondary"
          }}
          title="위치 권한 허용"
        />
      </SafeAreaView>
    );
  }

  if (bootStep === "login") {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <NativeLoginStep
          accountId={nativeLogin.accountId}
          activeProvider={nativeLogin.activeProvider}
          appleAvailable={nativeLogin.appleAvailable}
          displayName={nativeLogin.displayName}
          errorMessage={nativeLogin.errorMessage}
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
        />
      </SafeAreaView>
    );
  }

  return <NativeWebViewScreen nativeAuthToken={nativeAuthToken} />;
}

const styles = StyleSheet.create({
  launchContainer: {
    flex: 1,
    backgroundColor: "#f7faf9"
  },
  container: {
    flex: 1,
    backgroundColor: "#ffffff"
  }
});
