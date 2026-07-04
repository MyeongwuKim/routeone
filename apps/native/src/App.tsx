import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import {
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View
} from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { WEB_BUNDLE_HTML } from "./generated/webBundle";
import {
  handleNativeFetchMessage,
  ROUTEONE_WEBVIEW_BRIDGE_SCRIPT
} from "./webview/nativeFetchBridge";
import NativeOnboardingStep, {
  NativeOnboardingLoading
} from "./components/native-onboarding/NativeOnboardingStep";

type NativeBootStep = "checking" | "location" | "login" | "webview";

const ONBOARDING_STORAGE_KEY = "routeone:native-onboarding-completed:v1";

export default function App() {
  const webViewRef = useRef<WebView>(null);
  const [bootStep, setBootStep] = useState<NativeBootStep>("checking");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRequestingLocationPermission, setIsRequestingLocationPermission] =
    useState(false);
  const [isCompletingNativeLogin, setIsCompletingNativeLogin] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const prepareNativeBoot = async () => {
      const hasCompletedOnboarding = await AsyncStorage.getItem(
        ONBOARDING_STORAGE_KEY
      );

      if (!isMounted) {
        return;
      }

      if (hasCompletedOnboarding === "true") {
        setBootStep("webview");
        return;
      }

      const permission = await Location.getForegroundPermissionsAsync();

      if (!isMounted) {
        return;
      }

      setBootStep(
        permission.status === "granted" || !permission.canAskAgain
          ? "login"
          : "location"
      );
    };

    void prepareNativeBoot().catch(() => {
      if (isMounted) {
        setBootStep("location");
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const requestLocationPermission = useCallback(async () => {
    setIsRequestingLocationPermission(true);

    try {
      await Location.requestForegroundPermissionsAsync();
      setBootStep("login");
    } finally {
      setIsRequestingLocationPermission(false);
    }
  }, []);

  const skipLocationPermission = useCallback(() => {
    if (isRequestingLocationPermission) {
      return;
    }

    setBootStep("login");
  }, [isRequestingLocationPermission]);

  const completeNativeLogin = useCallback(async () => {
    setIsCompletingNativeLogin(true);

    try {
      await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
      setBootStep("webview");
    } finally {
      setIsCompletingNativeLogin(false);
    }
  }, []);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    void handleNativeFetchMessage(event, webViewRef);
  }, []);

  if (bootStep === "checking") {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <NativeOnboardingLoading />
      </SafeAreaView>
    );
  }

  if (bootStep === "location") {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <NativeOnboardingStep
          description="장소 근처에 도착했는지 확인하고 방문 인증을 도와드릴게요."
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
        <NativeOnboardingStep
          description="OAuth 연결 전까지는 이 단계에서 바로 RouteOne으로 이동할게요."
          primaryAction={{
            disabled: isCompletingNativeLogin,
            label: "RouteOne 시작하기",
            loadingLabel: "이동 중",
            onPress: () => {
              void completeNativeLogin();
            },
            variant: "primary"
          }}
          title="네이티브 로그인"
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <WebView
        ref={webViewRef}
        source={{
          html: WEB_BUNDLE_HTML,
          baseUrl: "https://routeone.native/"
        }}
        style={styles.webView}
        originWhitelist={["*"]}
        injectedJavaScriptBeforeContentLoaded={ROUTEONE_WEBVIEW_BRIDGE_SCRIPT}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        allowFileAccess
        allowUniversalAccessFromFileURLs
        mixedContentMode="always"
        setSupportMultipleWindows={false}
        onLoadStart={() => {
          setIsLoading(true);
          setLoadError(null);
        }}
        onLoadEnd={() => setIsLoading(false)}
        onError={(event) => {
          setLoadError(event.nativeEvent.description);
          setIsLoading(false);
        }}
        onMessage={handleMessage}
      />
      {isLoading ? (
        <View style={styles.overlay}>
          <ActivityIndicator color="#0f766e" />
          <Text style={styles.overlayText}>RouteOne을 불러오는 중이에요.</Text>
        </View>
      ) : null}
      {loadError ? (
        <View style={styles.errorPanel}>
          <Text style={styles.errorTitle}>웹앱을 불러오지 못했어요.</Text>
          <Text style={styles.errorMessage}>{loadError}</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff"
  },
  webView: {
    flex: 1,
    backgroundColor: "#ffffff"
  },
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#ffffff"
  },
  overlayText: {
    color: "#0f766e",
    fontSize: 14,
    fontWeight: "700"
  },
  errorPanel: {
    position: "absolute",
    left: 20,
    right: 20,
    top: 80,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fff1f2",
    padding: 16
  },
  errorTitle: {
    color: "#9f1239",
    fontSize: 15,
    fontWeight: "800"
  },
  errorMessage: {
    marginTop: 6,
    color: "#be123c",
    fontSize: 12,
    lineHeight: 18
  },
});
