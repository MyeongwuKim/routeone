import { useCallback, useEffect, useRef, useState } from "react";
import * as Location from "expo-location";
import {
  ActivityIndicator,
  Alert,
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

export default function App() {
  const webViewRef = useRef<WebView>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const prepareLocationPermission = async () => {
      const permission = await Location.getForegroundPermissionsAsync();

      if (
        !isMounted ||
        permission.status === "granted" ||
        !permission.canAskAgain
      ) {
        return;
      }

      Alert.alert(
        "위치 권한을 허용할까요?",
        "장소 근처에 도착했는지 확인하고 방문 인증을 도와드릴게요.",
        [
          {
            text: "나중에",
            style: "cancel"
          },
          {
            text: "허용",
            onPress: () => {
              void Location.requestForegroundPermissionsAsync();
            }
          }
        ]
      );
    };

    void prepareLocationPermission();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    void handleNativeFetchMessage(event, webViewRef);
  }, []);

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
  }
});
