/**
 * 용도:
 * 네이티브 앱의 초기 설정·권한·인증 상태를 확인하고 WebView 진입 단계를 관리한다.
 *
 * 동작 방식:
 * 온보딩을 마치면 인증 여부와 관계없이 지도로 진입하고, 이후 로그인·로그아웃은
 * WebView를 유지한 채 세션 정보만 교체한다.
 */
import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import type { NativeAuthPayload } from "@/auth/nativeAuth";
import {
  createNativeAuthSessionId,
  enqueueNativeAuthSessionOperation,
  NATIVE_AUTH_SESSION_DURATION_MS,
  readStoredNativeAuthSession,
  storeNativeAuthToken,
  type NativeAuthRole
} from "@/auth/nativeAuthStorage";
import {
  clearNativeSessionForAccountChange,
  reconcileNativeSessionCleanup
} from "@/auth/nativeSessionCleanup";
import { prepareNativeCurrentPosition } from "@/location/nativeCurrentPosition";

export type NativeBootStep =
  | "checking"
  | "language"
  | "location"
  | "notification"
  | "webview";
export type NativeBootProgressStage = "storage" | "location";
export type AppLanguage = "ko" | "en";

const APP_LANGUAGE_STORAGE_KEY = "routeone-app-language";
const ONBOARDING_STORAGE_KEY = "routeone:native-onboarding-completed:v1";
const STARTUP_LOCATION_WAIT_TIMEOUT_MS = 3_000;

function normalizeAppLanguage(value: string | null): AppLanguage | null {
  return value === "ko" || value === "en" ? value : null;
}

export function useNativeBoot() {
  const [bootStep, setBootStep] = useState<NativeBootStep>("checking");
  const [bootProgressStage, setBootProgressStage] =
    useState<NativeBootProgressStage>("storage");
  const [appLanguage, setAppLanguage] = useState<AppLanguage>("ko");
  const [nativeAuthToken, setNativeAuthToken] = useState<string | null>(null);
  const [nativeAuthRole, setNativeAuthRole] =
    useState<NativeAuthRole | null>(null);
  const [nativeAuthSessionId, setNativeAuthSessionId] = useState<
    string | null
  >(null);
  const [nativeAuthExpiresAt, setNativeAuthExpiresAt] = useState<number | null>(
    null
  );
  const [isAuthSessionExpired, setIsAuthSessionExpired] = useState(false);
  const [isRequestingLocationPermission, setIsRequestingLocationPermission] =
    useState(false);
  const [
    isRequestingNotificationPermission,
    setIsRequestingNotificationPermission
  ] = useState(false);

  const prepareLocationBeforeWebView = useCallback(async () => {
    const permission = await Location.getForegroundPermissionsAsync();

    if (permission.status !== "granted") {
      return;
    }

    const locationServicesEnabled = await Location.hasServicesEnabledAsync()
      .catch(() => true);

    if (!locationServicesEnabled) {
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const positionRequest = prepareNativeCurrentPosition({
      requestPermission: false
    })
      .then(() => undefined)
      .catch(() => undefined);

    try {
      await Promise.race([
        positionRequest,
        new Promise<void>((resolve) => {
          timeoutId = setTimeout(resolve, STARTUP_LOCATION_WAIT_TIMEOUT_MS);
        })
      ]);
    } finally {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    }
  }, []);

  const enterWebView = useCallback(async () => {
    await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
    setBootStep("webview");
  }, []);

  const goToNotificationOrWebView = useCallback(async () => {
    const permission = await Notifications.getPermissionsAsync();

    if (!permission.granted && permission.canAskAgain) {
      setBootStep("notification");
      return;
    }

    await enterWebView();
  }, [enterWebView]);

  const goToLocationOrNotificationOrWebView = useCallback(async () => {
    const locationPermission = await Location.getForegroundPermissionsAsync();

    if (
      locationPermission.status !== "granted" &&
      locationPermission.canAskAgain
    ) {
      setBootStep("location");
      return;
    }

    await prepareLocationBeforeWebView();
    await goToNotificationOrWebView();
  }, [goToNotificationOrWebView, prepareLocationBeforeWebView]);

  useEffect(() => {
    let isMounted = true;

    const prepareNativeBoot = async () => {
      const hasCompletedOnboarding = await AsyncStorage.getItem(
        ONBOARDING_STORAGE_KEY
      );
      const storedLanguage = normalizeAppLanguage(
        await AsyncStorage.getItem(APP_LANGUAGE_STORAGE_KEY)
      );
      const { didClearStoredSession, storedAuthSession } =
        await enqueueNativeAuthSessionOperation(async () => {
          const nextStoredAuthSession =
            await readStoredNativeAuthSession();
          const didClearSession = await reconcileNativeSessionCleanup(
            Boolean(nextStoredAuthSession.token)
          );

          return {
            didClearStoredSession: didClearSession,
            storedAuthSession: nextStoredAuthSession
          };
        });

      if (!isMounted) {
        return;
      }

      if (storedLanguage) {
        setAppLanguage(storedLanguage);
      }

      if (storedAuthSession.token && !didClearStoredSession) {
        setNativeAuthToken(storedAuthSession.token);
        setNativeAuthRole(storedAuthSession.role);
        setNativeAuthExpiresAt(storedAuthSession.expiresAt);
        setNativeAuthSessionId(storedAuthSession.sessionId);
        setBootProgressStage("location");
        await prepareLocationBeforeWebView();

        if (!isMounted) {
          return;
        }

        setBootStep("webview");
        return;
      }

      setIsAuthSessionExpired(storedAuthSession.expired);

      if (!storedLanguage) {
        setBootStep("language");
        return;
      }

      if (hasCompletedOnboarding === "true") {
        setBootProgressStage("location");
        await prepareLocationBeforeWebView();

        if (!isMounted) {
          return;
        }

        setBootStep("webview");
        return;
      }

      const locationPermission = await Location.getForegroundPermissionsAsync();

      if (!isMounted) {
        return;
      }

      if (
        locationPermission.status !== "granted" &&
        locationPermission.canAskAgain
      ) {
        setBootStep("location");
        return;
      }

      const notificationPermission = await Notifications.getPermissionsAsync();

      if (!isMounted) {
        return;
      }

      if (!notificationPermission.granted && notificationPermission.canAskAgain) {
        setBootStep("notification");
        return;
      }

      await enterWebView();
    };

    void prepareNativeBoot().catch(() => {
      if (isMounted) {
        setBootStep("location");
      }
    });

    return () => {
      isMounted = false;
    };
  }, [enterWebView, prepareLocationBeforeWebView]);

  const selectAppLanguage = useCallback(
    async (language: AppLanguage) => {
      setAppLanguage(language);
      await AsyncStorage.setItem(APP_LANGUAGE_STORAGE_KEY, language);
      await goToLocationOrNotificationOrWebView();
    },
    [goToLocationOrNotificationOrWebView]
  );

  const updateAppLanguage = useCallback(async (language: AppLanguage) => {
    setAppLanguage(language);
    await AsyncStorage.setItem(APP_LANGUAGE_STORAGE_KEY, language);
  }, []);

  const requestLocationPermission = useCallback(async () => {
    setIsRequestingLocationPermission(true);

    try {
      const permission = await Location.requestForegroundPermissionsAsync();

      if (permission.status === "granted") {
        await prepareLocationBeforeWebView();
      }

      await goToNotificationOrWebView();
    } finally {
      setIsRequestingLocationPermission(false);
    }
  }, [goToNotificationOrWebView, prepareLocationBeforeWebView]);

  const requestNotificationPermission = useCallback(async () => {
    setIsRequestingNotificationPermission(true);

    try {
      await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: false,
          allowSound: true
        }
      });
      await enterWebView();
    } finally {
      setIsRequestingNotificationPermission(false);
    }
  }, [enterWebView]);

  const completeNativeLogin = useCallback(
    async (payload: NativeAuthPayload) => {
      const expiresAt = Date.now() + NATIVE_AUTH_SESSION_DURATION_MS;
      const sessionId = createNativeAuthSessionId();

      await enqueueNativeAuthSessionOperation(async () => {
        await clearNativeSessionForAccountChange();
        await storeNativeAuthToken(
          payload.token,
          expiresAt,
          payload.user.role,
          sessionId
        );
      });
      setNativeAuthToken(payload.token);
      setNativeAuthRole(payload.user.role);
      setNativeAuthExpiresAt(expiresAt);
      setNativeAuthSessionId(sessionId);
      setIsAuthSessionExpired(false);
      await prepareLocationBeforeWebView();
      setBootStep("webview");
    },
    [prepareLocationBeforeWebView]
  );

  const handleNativeAuthSessionChange = useCallback(
    (session: {
      token: string | null;
      expiresAt: number | null;
      sessionId: string | null;
      reason: "logout" | "expired" | null;
    }) => {
      setNativeAuthToken(session.token);
      if (!session.token) {
        setNativeAuthRole(null);
      }
      setNativeAuthExpiresAt(session.expiresAt);
      setNativeAuthSessionId(session.sessionId);
      setIsAuthSessionExpired(session.reason === "expired");
      setBootStep("webview");
    },
    []
  );

  return {
    bootStep,
    bootProgressStage,
    completeNativeLogin,
    handleNativeAuthSessionChange,
    appLanguage,
    isAuthSessionExpired,
    isRequestingLocationPermission,
    isRequestingNotificationPermission,
    nativeAuthExpiresAt,
    nativeAuthRole,
    nativeAuthSessionId,
    nativeAuthToken,
    requestLocationPermission,
    requestNotificationPermission,
    selectAppLanguage,
    updateAppLanguage,
  };
}
