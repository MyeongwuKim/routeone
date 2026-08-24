import { prepareNativeCurrentPosition } from "@/location/nativeCurrentPosition";
import { postNativeLocationResponse } from "./responses";
import type { NativeLocationRequest, NativeLocationResponse, WebViewRef } from "./types";

let routeArrivalTestPosition: NativeLocationResponse | null = null;

export function setNativeRouteArrivalTestPosition(
  position: { lat: number; lng: number } | null
) {
  routeArrivalTestPosition = position
    ? {
        ok: true,
        lat: position.lat,
        lng: position.lng,
        accuracyMeters: 1,
        timestamp: Date.now(),
      }
    : null;
}

async function getNativeCurrentPosition(
  locationTestModeEnabled: boolean,
  useRealPosition: boolean
): Promise<NativeLocationResponse> {
  if (
    locationTestModeEnabled &&
    !useRealPosition &&
    routeArrivalTestPosition?.ok
  ) {
    return {
      ...routeArrivalTestPosition,
      timestamp: Date.now(),
    };
  }

  return {
    ok: true,
    ...(await prepareNativeCurrentPosition())
  };
}

export async function handleNativeLocationRequest(
  message: NativeLocationRequest,
  webViewRef: WebViewRef,
  locationTestModeEnabled = false
) {
  try {
    postNativeLocationResponse(
      webViewRef,
      message.id,
      await getNativeCurrentPosition(
        locationTestModeEnabled,
        message.useRealPosition === true
      )
    );
  } catch (error) {
    postNativeLocationResponse(webViewRef, message.id, {
      ok: false,
      error: error instanceof Error ? error.message : "Native location failed"
    });
  }
}
