import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  StatusBar,
  StyleSheet,
  Text,
  View
} from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { INITIAL_WEB_BUNDLE_PROGRESS } from "../../webBundle/webBundleProgress";
import {
  markResolvedWebBundleReady,
  resolveWebBundle,
  rollbackResolvedWebBundle,
  type ResolvedWebBundle
} from "../../webBundle/webBundleLoader";
import type { WebBundleProgress } from "../../webBundle/webBundleTypes";
import {
  handleNativeBridgeMessage,
  ROUTEONE_WEBVIEW_BRIDGE_SCRIPT
} from "../../webview/bridge";
import {
  openNativeExternalUrl,
  shouldKeepUrlInWebView
} from "../../webview/bridge/externalLinkBridge";
import RouteOneLaunchScreen from "./RouteOneLaunchScreen";

type NativeWebViewScreenProps = {
  appLanguage: "ko" | "en";
  nativeAuthToken: string | null;
};

type WebViewNavigationRequest = {
  url: string;
  isTopFrame?: boolean;
};

const AUTH_TOKEN_STORAGE_KEY = "routeone.authToken";
const APP_LANGUAGE_STORAGE_KEY = "routeone-app-language";

function readProgressNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : fallback;
}

function readBundleProgress(
  progress: WebBundleProgress | null | undefined
): WebBundleProgress {
  if (!progress) {
    return INITIAL_WEB_BUNDLE_PROGRESS;
  }

  return {
    ...progress,
    progress: readProgressNumber(
      progress.progress,
      INITIAL_WEB_BUNDLE_PROGRESS.progress
    )
  };
}

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
  appLanguage,
  nativeAuthToken
}: NativeWebViewScreenProps) {
  const webViewRef = useRef<WebView>(null);
  const pendingNavigationPathRef = useRef<string | null>(null);
  const rollbackInProgressRef = useRef(false);
  const [resolvedBundle, setResolvedBundle] =
    useState<ResolvedWebBundle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [bundleProgress, setBundleProgress] = useState<WebBundleProgress>(
    INITIAL_WEB_BUNDLE_PROGRESS
  );
  const injectedScript = useMemo(() => {
    const authScript = nativeAuthToken
      ? `try { window.localStorage.setItem(${JSON.stringify(
          AUTH_TOKEN_STORAGE_KEY
        )}, ${JSON.stringify(nativeAuthToken)}); } catch (error) {}`
      : "";
    const languageScript = `
      try {
        window.localStorage.setItem(${JSON.stringify(
          APP_LANGUAGE_STORAGE_KEY
        )}, ${JSON.stringify(appLanguage)});
        if (window.document && window.document.documentElement) {
          window.document.documentElement.lang = ${JSON.stringify(appLanguage)};
        }
      } catch (error) {}
    `;

    return `${authScript}\n${languageScript}\n${ROUTEONE_WEBVIEW_BRIDGE_SCRIPT}`;
  }, [appLanguage, nativeAuthToken]);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const message = JSON.parse(event.nativeEvent.data) as {
          type?: unknown;
        };

        if (message.type === "routeone:web-bundle-ready" && resolvedBundle) {
          setBundleProgress({
            stage: "ready",
            progress: 1,
            message: "준비가 끝났어요."
          });
          setLoadError(null);
          setIsLoading(false);
          void markResolvedWebBundleReady(resolvedBundle).catch((error) => {
            console.warn("[web-bundle] failed to confirm ready bundle", error);
          });
        }
      } catch {
        // Other bridge handlers perform their own message validation.
      }

      void handleNativeBridgeMessage(event, webViewRef, {
        webBundleVersion: resolvedBundle?.version ?? null,
        webBundleKind: resolvedBundle?.kind ?? "embedded"
      });
    },
    [resolvedBundle]
  );

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

  useEffect(() => {
    let cancelled = false;

    void resolveWebBundle((progress) => {
      if (!cancelled) {
        setBundleProgress(progress);
      }
    })
      .then((bundle) => {
        if (!cancelled) {
          setBundleProgress({
            stage: "loading",
            progress: 0.93,
            message: "RouteOne을 불러오고 있어요."
          });
          setResolvedBundle(bundle);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(
            error instanceof Error ? error.message : "웹 번들을 준비하지 못했어요."
          );
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleLoadError = useCallback(
    (description: string) => {
      if (
        !resolvedBundle ||
        resolvedBundle.kind !== "installed" ||
        rollbackInProgressRef.current
      ) {
        setLoadError(description);
        setIsLoading(false);
        return;
      }

      rollbackInProgressRef.current = true;
      setBundleProgress({
        stage: "rollback",
        progress: 0.92,
        message: "이전 버전으로 복구하고 있어요."
      });
      void rollbackResolvedWebBundle(resolvedBundle)
        .then((fallbackBundle) => {
          setLoadError(null);
          setIsLoading(true);
          setBundleProgress({
            stage: "loading",
            progress: 0.94,
            message: "RouteOne을 다시 불러오고 있어요."
          });
          setResolvedBundle(fallbackBundle);
        })
        .catch((error) => {
          setLoadError(
            error instanceof Error ? error.message : description
          );
          setIsLoading(false);
        })
        .finally(() => {
          rollbackInProgressRef.current = false;
        });
    },
    [resolvedBundle]
  );

  const displayBundleProgress = readBundleProgress(bundleProgress);

  return (
    <View style={styles.webViewContainer}>
      <StatusBar barStyle="dark-content" />
      {resolvedBundle ? (
        <WebView
          key={resolvedBundle.key}
          ref={webViewRef}
          source={resolvedBundle.source}
          allowingReadAccessToURL={resolvedBundle.allowingReadAccessToUrl}
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
            setBundleProgress({
              stage: "loading",
              progress: 0.95,
              message: "RouteOne을 불러오고 있어요."
            });
          }}
          onLoadProgress={(event) => {
            const webViewProgress = readProgressNumber(
              event.nativeEvent?.progress,
              0
            );
            setBundleProgress((current) => {
              const currentProgress = readBundleProgress(current);

              if (currentProgress.stage === "ready") {
                return currentProgress;
              }

              return {
                stage: "loading",
                progress: Math.max(
                  currentProgress.progress,
                  0.95 + webViewProgress * 0.03
                ),
                message: "RouteOne을 불러오고 있어요."
              };
            });
          }}
          onLoadEnd={() => {
            if (resolvedBundle.readySignalRequired) {
            setBundleProgress({
              stage: "loading",
              progress: 0.98,
              message: "웹 화면 준비 신호를 기다리고 있어요."
            });
              return;
            }

            setBundleProgress({
              stage: "ready",
              progress: 1,
              message: "준비가 끝났어요."
            });
            setIsLoading(false);
            void markResolvedWebBundleReady(resolvedBundle).catch((error) => {
              console.warn(
                "[web-bundle] failed to confirm loaded bundle",
                error
              );
            });
          }}
          onError={(event) => {
            handleLoadError(event.nativeEvent.description);
          }}
          onMessage={handleMessage}
        />
      ) : null}
      {isLoading || !resolvedBundle ? (
        <View style={styles.overlay}>
          <RouteOneLaunchScreen
            message={displayBundleProgress.message}
            progress={displayBundleProgress.progress}
          />
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
    backgroundColor: "#f7faf9"
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
