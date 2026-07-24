import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import type { NativeAuthPayload } from "../auth/nativeAuth";
import {
  NATIVE_AUTH_SESSION_DURATION_MS,
  readStoredNativeAuthSession,
  storeNativeAuthToken
} from "../auth/nativeAuthStorage";

export type NativeBootStep =
  | "checking"
  | "language"
  | "location"
  | "notification"
  | "login"
  | "webview";
export type AppLanguage = "ko" | "en";

const APP_LANGUAGE_STORAGE_KEY = "routeone-app-language";
const ONBOARDING_STORAGE_KEY = "routeone:native-onboarding-completed:v1";

function normalizeAppLanguage(value: string | null): AppLanguage | null {
  return value === "ko" || value === "en" ? value : null;
}

export function useNativeBoot() {
  const [bootStep, setBootStep] = useState<NativeBootStep>("checking");
  const [appLanguage, setAppLanguage] = useState<AppLanguage>("ko");
  const [nativeAuthToken, setNativeAuthToken] = useState<string | null>(null);
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

    await goToNotificationOrLogin();
  }, [goToNotificationOrLogin]);

  useEffect(() => {
    let isMounted = true;

    const prepareNativeBoot = async () => {
      const hasCompletedOnboarding = await AsyncStorage.getItem(
        ONBOARDING_STORAGE_KEY
      );
      const storedLanguage = normalizeAppLanguage(
        await AsyncStorage.getItem(APP_LANGUAGE_STORAGE_KEY)
      );
      const storedAuthSession = await readStoredNativeAuthSession();

      if (!isMounted) {
        return;
      }

      if (storedLanguage) {
        setAppLanguage(storedLanguage);
      }

      if (storedAuthSession.token) {
        setNativeAuthToken(storedAuthSession.token);
        setNativeAuthExpiresAt(storedAuthSession.expiresAt);
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
  }, []);

  const selectAppLanguage = useCallback(
    async (language: AppLanguage) => {
      setAppLanguage(language);
      await AsyncStorage.setItem(APP_LANGUAGE_STORAGE_KEY, language);
      await goToLocationOrNotificationOrLogin();
    },
    [goToLocationOrNotificationOrLogin]
  );

  const requestLocationPermission = useCallback(async () => {
    setIsRequestingLocationPermission(true);

    try {
      await Location.requestForegroundPermissionsAsync();
      await goToNotificationOrLogin();
    } finally {
      setIsRequestingLocationPermission(false);
    }
  }, [goToNotificationOrLogin]);

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

  const completeNativeLogin = useCallback(async (payload: NativeAuthPayload) => {
    const expiresAt = Date.now() + NATIVE_AUTH_SESSION_DURATION_MS;

    setNativeAuthToken(payload.token);
    setNativeAuthExpiresAt(expiresAt);
    setIsAuthSessionExpired(false);
    await storeNativeAuthToken(payload.token, expiresAt);
    await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
    setBootStep("webview");
  }, []);

  const handleNativeAuthSessionChange = useCallback(
    (session: {
      token: string | null;
      expiresAt: number | null;
      reason: "logout" | "expired" | null;
    }) => {
      setNativeAuthToken(session.token);
      setNativeAuthExpiresAt(session.expiresAt);
      setIsAuthSessionExpired(session.reason === "expired");
      setBootStep(session.token ? "webview" : "login");
    },
    []
  );

  return {
    bootStep,
    completeNativeLogin,
    handleNativeAuthSessionChange,
    appLanguage,
    isAuthSessionExpired,
    isRequestingLocationPermission,
    isRequestingNotificationPermission,
    nativeAuthExpiresAt,
    nativeAuthToken,
    requestLocationPermission,
    requestNotificationPermission,
    selectAppLanguage,
  };
}
