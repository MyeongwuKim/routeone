/** 웹 번들을 선택해 실행하고 WebView와 네이티브 브릿지를 연결하는 메인 화면. */
import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  AppState,
  BackHandler,
  StatusBar,
  StyleSheet,
  Text,
  View
} from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import {
  APP_ACTIVE_EVENT_SCRIPT,
  APP_LANGUAGE_STORAGE_KEY,
  AUTH_SESSION_EXPIRES_AT_STORAGE_KEY,
  AUTH_TOKEN_STORAGE_KEY,
  REQUEST_WEB_BUNDLE_READY_SCRIPT,
  WEB_VIEW_TEXT
} from "@/constants/nativeWebView";
import { isFatalWebBundleInstallError } from "@/webBundle/webBundleErrors";
import { INITIAL_WEB_BUNDLE_PROGRESS } from "@/webBundle/webBundleProgress";
import {
  markResolvedWebBundleReady,
  resolveWebBundle,
  rollbackResolvedWebBundle,
  type ResolvedWebBundle
} from "@/webBundle/webBundleLoader";
import type { WebBundleProgress } from "@/webBundle/webBundleTypes";
import {
  handleNativeBridgeMessage,
  ROUTEONE_WEBVIEW_BRIDGE_SCRIPT
} from "@/webview/bridge";
import type { NativeAuthRole } from "@/auth/nativeAuthStorage";
import { isNativeTestFeatureEnabled } from "@/auth/testFeatureAccess";
import { WEB_BUNDLE_UPDATE_CONFIG } from "@/config/webBundleUpdateConfig";
import {
  openNativeExternalUrl,
  shouldKeepUrlInWebView
} from "@/webview/bridge/externalLinkBridge";
import {
  reconcileStoredRouteArrivalNotifications,
  recordDeliveredRouteArrivalNotification
} from "@/webview/bridge/routeArrivalNotificationBridge";
import NativeDevBuildBadge from "./NativeDevBuildBadge";
import RouteOneLaunchScreen from "./RouteOneLaunchScreen";

type NativeWebViewScreenProps = {
  appLanguage: AppLanguage;
  nativeAuthExpiresAt: number | null;
  nativeAuthRole: NativeAuthRole | null;
  nativeAuthSessionId: string | null;
  nativeAuthToken: string | null;
  onAppLanguageChange: (language: AppLanguage) => Promise<void> | void;
  onAuthSessionChange: (session: {
    token: string | null;
    expiresAt: number | null;
    sessionId: string | null;
    reason: "logout" | "expired" | null;
  }) => void;
};

type AppLanguage = "ko" | "en";

type WebViewNavigationRequest = {
  url: string;
  isTopFrame?: boolean;
};

const WEB_BUNDLE_DISPLAY_PROGRESS_START = 0.32;

function createNotificationReceivedEventScript(
  notification: Notifications.Notification
) {
  const data = notification.request.content.data ?? {};
  const detail = {
    notificationId:
      typeof data.notificationId === "string"
        ? data.notificationId
        : null,
    type: typeof data.type === "string" ? data.type : null
  };

  return `
    window.dispatchEvent(
      new CustomEvent(
        "routeone:native-notification-received",
        { detail: ${JSON.stringify(detail)} }
      )
    );
    true;
  `;
}

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
  const displayProgress =
    WEB_BUNDLE_DISPLAY_PROGRESS_START +
    normalizedProgress.progress * (1 - WEB_BUNDLE_DISPLAY_PROGRESS_START);
  const loadingMessages: readonly string[] = [
    text.loadingRouteOne,
    text.reloadingRouteOne,
    text.waitingReadySignal
  ];

  if (
    normalizedProgress.stage === "loading" &&
    loadingMessages.includes(normalizedProgress.message)
  ) {
    return {
      ...normalizedProgress,
      progress: displayProgress
    };
  }

  return {
    ...normalizedProgress,
    progress: displayProgress,
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

function getNotificationWebPath(
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

  if (type === "festival-summary") {
    const notificationId =
      typeof data.notificationId === "string" ? data.notificationId : null;
    const regionCode =
      typeof data.regionCode === "string" ? data.regionCode : null;
    const dateKey = typeof data.dateKey === "string" ? data.dateKey : null;

    if (notificationId) {
      return `/notifications?${new URLSearchParams({
        notificationId,
        source: "festival-notification"
      }).toString()}`;
    }

    if (!regionCode || !dateKey) {
      return null;
    }

    return `/home?${new URLSearchParams({
      festivalRegion: regionCode,
      festivalDate: dateKey,
      source: "festival-notification"
    }).toString()}`;
  }

  if (type === "route-review" && routeId && dayId) {
    return `/me/routes?${new URLSearchParams({
      routeId,
      dayId,
      source: "route-review"
    }).toString()}`;
  }

  if (type === "route-start" && routeId && dayId) {
    return `/my-route?${new URLSearchParams({
      routeId,
      dayId,
      source: "route-start"
    }).toString()}`;
  }

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
  nativeAuthExpiresAt,
  nativeAuthRole,
  nativeAuthSessionId,
  nativeAuthToken,
  onAppLanguageChange,
  onAuthSessionChange
}: NativeWebViewScreenProps) {
  const text = WEB_VIEW_TEXT[appLanguage];
  const testAccountMode = isNativeTestFeatureEnabled(
    nativeAuthRole,
    WEB_BUNDLE_UPDATE_CONFIG.appVariant
  );
  const reviewerVerificationBypass =
    nativeAuthRole === "OWNER" || nativeAuthRole === "REVIEWER";
  const webViewRef = useRef<WebView>(null);
  const pendingNavigationPathRef = useRef<string | null>("/home");
  const fatalExitAlertShownRef = useRef(false);
  const rollbackInProgressRef = useRef(false);
  const readyBundleKeyRef = useRef<string | null>(null);
  const [resolvedBundle, setResolvedBundle] =
    useState<ResolvedWebBundle | null>(null);
  const resolvedBundleRef = useRef<ResolvedWebBundle | null>(resolvedBundle);
  resolvedBundleRef.current = resolvedBundle;
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
      ? `window.__ROUTEONE_NATIVE_AUTH_SESSION_ID__ = ${JSON.stringify(
          nativeAuthSessionId
        )};
        try {
          window.localStorage.setItem(${JSON.stringify(
            AUTH_TOKEN_STORAGE_KEY
          )}, ${JSON.stringify(nativeAuthToken)});
          window.localStorage.setItem(${JSON.stringify(
            AUTH_SESSION_EXPIRES_AT_STORAGE_KEY
          )}, ${JSON.stringify(String(nativeAuthExpiresAt))});
        } catch (error) {}`
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
    const runtimeConfigScript = `
      window.RouteOneRuntimeConfig = Object.assign(
        {},
        window.RouteOneRuntimeConfig || {},
        {
          testAccountMode: ${JSON.stringify(testAccountMode)},
          reviewerVerificationBypass: ${JSON.stringify(
            reviewerVerificationBypass
          )}
        }
      );
    `;

    return `${authScript}\n${languageScript}\n${runtimeConfigScript}\n${ROUTEONE_WEBVIEW_BRIDGE_SCRIPT}`;
  }, [
    appLanguage,
    nativeAuthExpiresAt,
    nativeAuthSessionId,
    nativeAuthToken,
    reviewerVerificationBypass,
    testAccountMode
  ]);

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

  const completeWebBundleLoad = useCallback(
    (bundle: ResolvedWebBundle) => {
      if (readyBundleKeyRef.current === bundle.key) {
        return;
      }

      readyBundleKeyRef.current = bundle.key;
      setBundleProgress({
        stage: "ready",
        progress: 1,
        message: text.ready
      });
      setLoadError(null);
      setIsLoading(false);
      void markResolvedWebBundleReady(bundle).catch((error) => {
        console.warn("[web-bundle] failed to confirm ready bundle", error);
      });
    },
    [text]
  );

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      const currentBundle = resolvedBundleRef.current;

      try {
        const message = JSON.parse(event.nativeEvent.data) as {
          type?: unknown;
        };

        if (message.type === "routeone:web-bundle-ready" && currentBundle) {
          completeWebBundleLoad(currentBundle);
        }

        if (message.type === "routeone:web-runtime-error") {
          setLoadError(readRuntimeErrorMessage(message, text));
          setIsLoading(false);
        }
      } catch {
        // Other bridge handlers perform their own message validation.
      }

      void handleNativeBridgeMessage(
        event,
        webViewRef,
        {
          webBundleVersion: currentBundle?.version ?? null,
          webBundleKind: currentBundle?.kind ?? "embedded"
        },
        {
          locationTestModeEnabled: testAccountMode,
          onAppLanguageChange,
          onAuthSessionChange
        }
      );
    },
    [
      completeWebBundleLoad,
      onAppLanguageChange,
      onAuthSessionChange,
      testAccountMode,
      text
    ]
  );

  const handleWebViewProcessTerminated = useCallback(() => {
    console.warn("[web-bundle] webview content process terminated; reloading");
    readyBundleKeyRef.current = null;
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
    let previousAppState = AppState.currentState;
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      const isReturningToActive =
        nextAppState === "active" &&
        (previousAppState === "background" ||
          previousAppState === "inactive");

      previousAppState = nextAppState;

      if (isReturningToActive) {
        void reconcileStoredRouteArrivalNotifications().catch(
          () => undefined
        );
        webViewRef.current?.injectJavaScript(APP_ACTIVE_EVENT_SCRIPT);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    void reconcileStoredRouteArrivalNotifications().catch(() => undefined);
  }, []);

  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener(
      (notification) => {
        void recordDeliveredRouteArrivalNotification(notification).catch(
          () => undefined
        );
        webViewRef.current?.injectJavaScript(
          createNotificationReceivedEventScript(notification)
        );
      }
    );

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    const handleNotificationResponse = (
      response: Notifications.NotificationResponse | null
    ) => {
      if (response?.notification) {
        void recordDeliveredRouteArrivalNotification(
          response.notification
        ).catch(() => undefined);
      }

      const webPath = getNotificationWebPath(response);

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
          if (resolvedBundleRef.current?.key !== bundle.key) {
            readyBundleKeyRef.current = null;
          }
          resolvedBundleRef.current = bundle;
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
          readyBundleKeyRef.current = null;
          resolvedBundleRef.current = fallbackBundle;
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
          key={`${resolvedBundle.key}:${nativeAuthSessionId ?? "no-session"}`}
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
            if (readyBundleKeyRef.current === resolvedBundle.key) {
              return;
            }

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
            if (readyBundleKeyRef.current === resolvedBundle.key) {
              return;
            }

            if (resolvedBundle.readySignalRequired) {
              setBundleProgress({
                stage: "loading",
                progress: 0.98,
                message: text.waitingReadySignal
              });
              webViewRef.current?.injectJavaScript(
                REQUEST_WEB_BUNDLE_READY_SCRIPT
              );
              return;
            }

            completeWebBundleLoad(resolvedBundle);
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
      <NativeDevBuildBadge />
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
