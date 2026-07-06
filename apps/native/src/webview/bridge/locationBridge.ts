import * as Location from "expo-location";
import { postNativeLocationResponse } from "./responses";
import type { NativeLocationRequest, NativeLocationResponse, WebViewRef } from "./types";

const LAST_KNOWN_POSITION_MAX_AGE_MS = 1000 * 15;
const LAST_KNOWN_POSITION_REQUIRED_ACCURACY_METERS = 50;

function buildNativeLocationResponse(
  position: Location.LocationObject
): NativeLocationResponse {
  return {
    ok: true,
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracyMeters: position.coords.accuracy,
    timestamp: position.timestamp
  };
}

async function getNativeCurrentPosition(): Promise<NativeLocationResponse> {
  const permission = await Location.getForegroundPermissionsAsync();
  const nextPermission =
    permission.status === "granted"
      ? permission
      : await Location.requestForegroundPermissionsAsync();

  if (nextPermission.status !== "granted") {
    throw new Error("위치 권한을 허용해야 장소 인증을 할 수 있어요.");
  }

  const lastKnownPosition = await Location.getLastKnownPositionAsync({
    maxAge: LAST_KNOWN_POSITION_MAX_AGE_MS,
    requiredAccuracy: LAST_KNOWN_POSITION_REQUIRED_ACCURACY_METERS
  });

  if (lastKnownPosition) {
    return buildNativeLocationResponse(lastKnownPosition);
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High
  });

  return buildNativeLocationResponse(position);
}

export async function handleNativeLocationRequest(
  message: NativeLocationRequest,
  webViewRef: WebViewRef
) {
  try {
    postNativeLocationResponse(
      webViewRef,
      message.id,
      await getNativeCurrentPosition()
    );
  } catch (error) {
    postNativeLocationResponse(webViewRef, message.id, {
      ok: false,
      error: error instanceof Error ? error.message : "Native location failed"
    });
  }
}
