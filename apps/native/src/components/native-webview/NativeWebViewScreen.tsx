import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  StatusBar,
  StyleSheet,
  Text,
  View
} from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { WEB_BUNDLE_HTML } from "../../generated/webBundle";
import {
  handleNativeBridgeMessage,
  ROUTEONE_WEBVIEW_BRIDGE_SCRIPT
} from "../../webview/bridge";
import {
  openNativeExternalUrl,
  shouldKeepUrlInWebView
} from "../../webview/bridge/externalLinkBridge";

type NativeWebViewScreenProps = {
  nativeAuthToken: string | null;
};

type WebViewNavigationRequest = {
  url: string;
  isTopFrame?: boolean;
};

const AUTH_TOKEN_STORAGE_KEY = "routeone.authToken";

function getRouteArrivalNotificationWebPath(
  response: Notifications.NotificationResponse | null
) {
  if (
    !response ||
    response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER
  ) {
    return null;
  }

  const data = response.notification.request.content.data ?? {};
  const routeId = typeof data.routeId === "string" ? data.routeId : null;
  const dayId = typeof data.dayId === "string" ? data.dayId : null;
  const stopId = typeof data.stopId === "string" ? data.stopId : null;
  const type = typeof data.type === "string" ? data.type : null;

  if (type !== "route-arrival" || !routeId || !dayId) {
    return null;
  }

  const searchParams = new URLSearchParams({
    routeId,
    dayId,
    source: "route-arrival"
  });

  if (stopId) {
    searchParams.set("stopId", stopId);
  }

  return `/my-route?${searchParams.toString()}`;
}

function createWebViewNavigationScript(path: string) {
  return `
    (function () {
      var path = ${JSON.stringify(path)};
      var routerMode = window.RouteOneRuntimeConfig && window.RouteOneRuntimeConfig.routerMode;

      if (routerMode === "hash") {
        window.location.hash = path;
        return;
      }

      window.history.pushState({}, "", path);
      window.dispatchEvent(new PopStateEvent("popstate"));
    })();
    true;
  `;
}

export default function NativeWebViewScreen({
  nativeAuthToken
}: NativeWebViewScreenProps) {
  const webViewRef = useRef<WebView>(null);
  const pendingNavigationPathRef = useRef<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const injectedScript = useMemo(() => {
    const authScript = nativeAuthToken
      ? `try { window.localStorage.setItem(${JSON.stringify(
          AUTH_TOKEN_STORAGE_KEY
        )}, ${JSON.stringify(nativeAuthToken)}); } catch (error) {}`
      : "";

    return `${authScript}\n${ROUTEONE_WEBVIEW_BRIDGE_SCRIPT}`;
  }, [nativeAuthToken]);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    void handleNativeBridgeMessage(event, webViewRef);
  }, []);

  const injectNavigationPath = useCallback((path: string) => {
    webViewRef.current?.injectJavaScript(createWebViewNavigationScript(path));
  }, []);

  const navigateWebViewToPath = useCallback(
    (path: string) => {
      pendingNavigationPathRef.current = path;

      if (!isLoading) {
        pendingNavigationPathRef.current = null;
        injectNavigationPath(path);
      }
    },
    [injectNavigationPath, isLoading]
  );

  useEffect(() => {
    if (isLoading || !pendingNavigationPathRef.current) {
      return;
    }

    const path = pendingNavigationPathRef.current;
    pendingNavigationPathRef.current = null;
    injectNavigationPath(path);
  }, [injectNavigationPath, isLoading]);

  useEffect(() => {
    const handleNotificationResponse = (
      response: Notifications.NotificationResponse | null
    ) => {
      const webPath = getRouteArrivalNotificationWebPath(response);

      if (webPath) {
        navigateWebViewToPath(webPath);
      }
    };

    const subscription = Notifications.addNotificationResponseReceivedListener(
      handleNotificationResponse
    );
    handleNotificationResponse(Notifications.getLastNotificationResponse());
    Notifications.clearLastNotificationResponse();

    return () => {
      subscription.remove();
    };
  }, [navigateWebViewToPath]);

  const handleShouldStartLoadWithRequest = useCallback(
    (request: WebViewNavigationRequest) => {
      if (request.isTopFrame === false || shouldKeepUrlInWebView(request.url)) {
        return true;
      }

      void openNativeExternalUrl(request.url);
      return false;
    },
    []
  );

  return (
    <View style={styles.webViewContainer}>
      <StatusBar barStyle="dark-content" />
      <WebView
        ref={webViewRef}
        source={{
          html: WEB_BUNDLE_HTML,
          baseUrl: "https://routeone.native/"
        }}
        style={styles.webView}
        originWhitelist={["*"]}
        injectedJavaScriptBeforeContentLoaded={injectedScript}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        allowFileAccess
        allowUniversalAccessFromFileURLs
        mixedContentMode="always"
        setSupportMultipleWindows={false}
        bounces={false}
        overScrollMode="never"
        onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
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
          <Text style={styles.overlayText}>RouteOne 준비 중이에요.</Text>
        </View>
      ) : null}
      {loadError ? (
        <View style={styles.errorPanel}>
          <Text style={styles.errorTitle}>웹앱을 불러오지 못했어요.</Text>
          <Text style={styles.errorMessage}>{loadError}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  webViewContainer: {
    flex: 1,
    backgroundColor: "#071718"
  },
  webView: {
    flex: 1,
    backgroundColor: "transparent"
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
