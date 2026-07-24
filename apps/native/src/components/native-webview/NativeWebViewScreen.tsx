import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  BackHandler,
  StatusBar,
  StyleSheet,
  Text,
  View
} from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { isFatalWebBundleInstallError } from "../../webBundle/webBundleErrors";
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
  appLanguage: AppLanguage;
  nativeAuthToken: string | null;
};

type AppLanguage = "ko" | "en";

type WebViewNavigationRequest = {
  url: string;
  isTopFrame?: boolean;
};

const AUTH_TOKEN_STORAGE_KEY = "routeone.authToken";
const APP_LANGUAGE_STORAGE_KEY = "routeone-app-language";

const WEB_VIEW_TEXT = {
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
    restoringPrevious: "이전 버전으로 복구하고 있어요.",
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
    restoringPrevious: "Restoring the previous version.",
    waitingReadySignal: "Waiting for the web screen to be ready."
  }
} as const;

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

function readDisplayBundleProgress(
  progress: WebBundleProgress | null | undefined,
  text: (typeof WEB_VIEW_TEXT)[AppLanguage]
): WebBundleProgress {
  const normalizedProgress = readBundleProgress(progress);
  const loadingMessages: readonly string[] = [
    text.loadingRouteOne,
    text.reloadingRouteOne,
    text.waitingReadySignal
  ];

  if (
    normalizedProgress.stage === "loading" &&
    loadingMessages.includes(normalizedProgress.message)
  ) {
    return normalizedProgress;
  }

  return {
    ...normalizedProgress,
    message:
      text.progressMessages[normalizedProgress.stage] ??
      normalizedProgress.message
  };
}

function getLoadErrorMessage(
  error: unknown,
  text: (typeof WEB_VIEW_TEXT)[AppLanguage]
) {
  if (isFatalWebBundleInstallError(error)) {
    return text.fatalInstallMessages[error.reason];
  }

  return error instanceof Error ? error.message : text.prepareFailed;
}

function readRuntimeErrorMessage(
  value: unknown,
  text: (typeof WEB_VIEW_TEXT)[AppLanguage]
) {
  if (!value || typeof value !== "object") {
    return text.loadErrorTitle;
  }

  const message = (value as { message?: unknown }).message;

  return typeof message === "string" && message.trim()
    ? message.trim()
    : text.loadErrorTitle;
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

function readHttpOrigin(urlValue: string) {
  try {
    const url = new URL(urlValue);

    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.origin;
    }
  } catch {
    return null;
  }

  return null;
}

function readWebBundleAllowedOrigins(bundle: ResolvedWebBundle | null) {
  if (!bundle) {
    return [];
  }

  const sourceUrl =
    "uri" in bundle.source ? bundle.source.uri : bundle.source.baseUrl;
  const origin = readHttpOrigin(sourceUrl);

  return origin ? [origin] : [];
}

export default function NativeWebViewScreen({
  appLanguage,
  nativeAuthToken
}: NativeWebViewScreenProps) {
  const text = WEB_VIEW_TEXT[appLanguage];
  const webViewRef = useRef<WebView>(null);
  const pendingNavigationPathRef = useRef<string | null>(null);
  const fatalExitAlertShownRef = useRef(false);
  const rollbackInProgressRef = useRef(false);
  const [resolvedBundle, setResolvedBundle] =
    useState<ResolvedWebBundle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [bundleProgress, setBundleProgress] = useState<WebBundleProgress>(
    INITIAL_WEB_BUNDLE_PROGRESS
  );
  const allowedWebBundleOrigins = useMemo(
    () => readWebBundleAllowedOrigins(resolvedBundle),
    [resolvedBundle]
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

  const requestFatalAppExit = useCallback(
    (message: string) => {
      if (fatalExitAlertShownRef.current) {
        return;
      }

      fatalExitAlertShownRef.current = true;
      Alert.alert(
        text.fatalAlertTitle,
        `${message}\n\n${text.fatalAlertDescription}`,
        [
          {
            text: text.fatalAlertConfirm,
            onPress: () => {
              BackHandler.exitApp();
            }
          }
        ],
        { cancelable: false }
      );
    },
    [text]
  );

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
            message: text.ready
          });
          setLoadError(null);
          setIsLoading(false);
          void markResolvedWebBundleReady(resolvedBundle).catch((error) => {
            console.warn("[web-bundle] failed to confirm ready bundle", error);
          });
        }

        if (message.type === "routeone:web-runtime-error") {
          setLoadError(readRuntimeErrorMessage(message, text));
          setIsLoading(false);
        }
      } catch {
        // Other bridge handlers perform their own message validation.
      }

      void handleNativeBridgeMessage(event, webViewRef, {
        webBundleVersion: resolvedBundle?.version ?? null,
        webBundleKind: resolvedBundle?.kind ?? "embedded"
      });
    },
    [resolvedBundle, text]
  );

  const handleWebViewProcessTerminated = useCallback(() => {
    console.warn("[web-bundle] webview content process terminated; reloading");
    setLoadError(null);
    setIsLoading(true);
    setBundleProgress({
      stage: "loading",
      progress: 0.94,
      message: text.reloadingRouteOne
    });
    webViewRef.current?.reload();
  }, [text]);

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
      if (
        request.isTopFrame === false ||
        shouldKeepUrlInWebView(request.url, allowedWebBundleOrigins)
      ) {
        return true;
      }

      void openNativeExternalUrl(request.url, allowedWebBundleOrigins);
      return false;
    },
    [allowedWebBundleOrigins]
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
            message: text.loadingRouteOne
          });
          setResolvedBundle(bundle);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          const errorMessage = getLoadErrorMessage(error, text);

          setLoadError(errorMessage);
          setIsLoading(false);

          if (isFatalWebBundleInstallError(error)) {
            requestFatalAppExit(errorMessage);
          }
        }
      });

    return () => {
      cancelled = true;
    };
  }, [requestFatalAppExit, text]);

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
        message: text.restoringPrevious
      });
      void rollbackResolvedWebBundle(resolvedBundle)
        .then((fallbackBundle) => {
          setLoadError(null);
          setIsLoading(true);
          setBundleProgress({
            stage: "loading",
            progress: 0.94,
            message: text.reloadingRouteOne
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
    [resolvedBundle, text]
  );

  const displayBundleProgress = readDisplayBundleProgress(
    bundleProgress,
    text
  );

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
              message: text.loadingRouteOne
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
                message: text.loadingRouteOne
              };
            });
          }}
          onLoadEnd={() => {
            if (resolvedBundle.readySignalRequired) {
              setBundleProgress({
                stage: "loading",
                progress: 0.98,
                message: text.waitingReadySignal
              });
              return;
            }

            setBundleProgress({
              stage: "ready",
              progress: 1,
              message: text.ready
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
          onContentProcessDidTerminate={handleWebViewProcessTerminated}
          onRenderProcessGone={handleWebViewProcessTerminated}
          onMessage={handleMessage}
        />
      ) : null}
      {isLoading || !resolvedBundle ? (
        <View style={styles.overlay}>
          <RouteOneLaunchScreen
            message={displayBundleProgress.message}
            progress={displayBundleProgress.progress}
            tagline={text.launchTagline}
          />
        </View>
      ) : null}
      {loadError ? (
        <View style={styles.errorPanel}>
          <Text style={styles.errorTitle}>{text.loadErrorTitle}</Text>
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
    backgroundColor: "#0f766e"
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
