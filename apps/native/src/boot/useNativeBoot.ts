/**
 * 용도:
 * 네이티브 앱의 초기 권한·로그인 상태를 확인하고 WebView 진입 단계를 관리한다.
 *
 * 동작 방식:
 * 저장된 인증 세션이 만료됐거나 새 로그인을 시작할 때 이전 세션의 장소 감시를
 * 먼저 해제한 뒤 새 인증 정보와 위치 준비 상태를 반영한다.
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
  | "login"
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

  const goToNotificationOrLogin = useCallback(async () => {
    const permission = await Notifications.getPermissionsAsync();

    setBootStep(
      !permission.granted && permission.canAskAgain ? "notification" : "login"
    );
  }, []);

  const goToLocationOrNotificationOrLogin = useCallback(async () => {
    const locationPermission = await Location.getForegroundPermissionsAsync();

    if (
      locationPermission.status !== "granted" &&
      locationPermission.canAskAgain
    ) {
      setBootStep("location");
      return;
    }

    await prepareLocationBeforeWebView();
    await goToNotificationOrLogin();
  }, [goToNotificationOrLogin, prepareLocationBeforeWebView]);

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
        setBootStep("login");
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

      setBootStep(
        !notificationPermission.granted && notificationPermission.canAskAgain
          ? "notification"
          : "login"
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
  }, [prepareLocationBeforeWebView]);

  const selectAppLanguage = useCallback(
    async (language: AppLanguage) => {
      setAppLanguage(language);
      await AsyncStorage.setItem(APP_LANGUAGE_STORAGE_KEY, language);
      await goToLocationOrNotificationOrLogin();
    },
    [goToLocationOrNotificationOrLogin]
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

      await goToNotificationOrLogin();
    } finally {
      setIsRequestingLocationPermission(false);
    }
  }, [goToNotificationOrLogin, prepareLocationBeforeWebView]);

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
      setBootStep("login");
    } finally {
      setIsRequestingNotificationPermission(false);
    }
  }, []);

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
      await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
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
      setBootStep(session.token ? "webview" : "login");
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
