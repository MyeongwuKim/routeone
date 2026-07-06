import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import type { NativeAuthPayload } from "../auth/nativeAuth";
import {
  readStoredNativeAuthToken,
  storeNativeAuthToken
} from "../auth/nativeAuthStorage";

export type NativeBootStep = "checking" | "location" | "login" | "webview";

const ONBOARDING_STORAGE_KEY = "routeone:native-onboarding-completed:v1";

export function useNativeBoot() {
  const [bootStep, setBootStep] = useState<NativeBootStep>("checking");
  const [nativeAuthToken, setNativeAuthToken] = useState<string | null>(null);
  const [isRequestingLocationPermission, setIsRequestingLocationPermission] =
    useState(false);

  useEffect(() => {
    let isMounted = true;

    const prepareNativeBoot = async () => {
      const hasCompletedOnboarding = await AsyncStorage.getItem(
        ONBOARDING_STORAGE_KEY
      );
      const storedAuthToken = await readStoredNativeAuthToken();

      if (!isMounted) {
        return;
      }

      if (storedAuthToken) {
        setNativeAuthToken(storedAuthToken);
        setBootStep("webview");
        return;
      }

      const permission = await Location.getForegroundPermissionsAsync();

      if (!isMounted) {
        return;
      }

      setBootStep(
        hasCompletedOnboarding === "true" ||
          permission.status === "granted" ||
          !permission.canAskAgain
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

  const completeNativeLogin = useCallback(async (payload: NativeAuthPayload) => {
    setNativeAuthToken(payload.token);
    await storeNativeAuthToken(payload.token);
    await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
    setBootStep("webview");
  }, []);

  return {
    bootStep,
    completeNativeLogin,
    isRequestingLocationPermission,
    nativeAuthToken,
    requestLocationPermission,
    skipLocationPermission
  };
}
