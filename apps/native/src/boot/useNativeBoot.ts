import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import type { NativeAuthPayload } from "../auth/nativeAuth";
import {
  readStoredNativeAuthToken,
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
      const storedAuthToken = await readStoredNativeAuthToken();

      if (!isMounted) {
        return;
      }

      if (storedLanguage) {
        setAppLanguage(storedLanguage);
      }

      if (storedAuthToken) {
        setNativeAuthToken(storedAuthToken);
        setBootStep("webview");
        return;
      }

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

  const skipLocationPermission = useCallback(async () => {
    if (isRequestingLocationPermission) {
      return;
    }

    await goToNotificationOrLogin();
  }, [goToNotificationOrLogin, isRequestingLocationPermission]);

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

  const skipNotificationPermission = useCallback(() => {
    if (isRequestingNotificationPermission) {
      return;
    }

    setBootStep("login");
  }, [isRequestingNotificationPermission]);

  const completeNativeLogin = useCallback(async (payload: NativeAuthPayload) => {
    setNativeAuthToken(payload.token);
    await storeNativeAuthToken(payload.token);
    await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
    setBootStep("webview");
  }, []);

  return {
    bootStep,
    completeNativeLogin,
    appLanguage,
    isRequestingLocationPermission,
    isRequestingNotificationPermission,
    nativeAuthToken,
    requestLocationPermission,
    requestNotificationPermission,
    selectAppLanguage,
    skipLocationPermission,
    skipNotificationPermission
  };
}
