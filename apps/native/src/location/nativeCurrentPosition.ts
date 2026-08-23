import * as Location from "expo-location";

const CACHED_POSITION_MAX_AGE_MS = 1000 * 60 * 5;
const LAST_KNOWN_POSITION_MAX_AGE_MS = 1000 * 15;
const LAST_KNOWN_POSITION_REQUIRED_ACCURACY_METERS = 50;

export type NativeCurrentPosition = {
  lat: number;
  lng: number;
  accuracyMeters: number | null;
  timestamp: number;
};

let cachedPosition: NativeCurrentPosition | null = null;
let pendingPositionRequest: Promise<NativeCurrentPosition> | null = null;

function normalizePosition(
  position: Location.LocationObject
): NativeCurrentPosition {
  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracyMeters: position.coords.accuracy,
    timestamp: position.timestamp
  };
}

function readFreshCachedPosition() {
  if (
    !cachedPosition ||
    Date.now() - cachedPosition.timestamp > CACHED_POSITION_MAX_AGE_MS
  ) {
    return null;
  }

  return cachedPosition;
}

export async function prepareNativeCurrentPosition({
  requestPermission = true,
  forceRefresh = false
}: {
  requestPermission?: boolean;
  forceRefresh?: boolean;
} = {}) {
  if (pendingPositionRequest) {
    return pendingPositionRequest;
  }

  pendingPositionRequest = (async () => {
    const permission = await Location.getForegroundPermissionsAsync();
    const nextPermission =
      permission.status === "granted" || !requestPermission
        ? permission
        : await Location.requestForegroundPermissionsAsync();

    if (nextPermission.status !== "granted") {
      throw new Error("위치 권한을 허용해야 현재 위치를 확인할 수 있어요.");
    }

    if (!forceRefresh) {
      const freshCachedPosition = readFreshCachedPosition();

      if (freshCachedPosition) {
        return freshCachedPosition;
      }
    }

    if (!forceRefresh) {
      const lastKnownPosition = await Location.getLastKnownPositionAsync({
        maxAge: LAST_KNOWN_POSITION_MAX_AGE_MS,
        requiredAccuracy: LAST_KNOWN_POSITION_REQUIRED_ACCURACY_METERS
      });

      if (lastKnownPosition) {
        cachedPosition = normalizePosition(lastKnownPosition);
        return cachedPosition;
      }
    }

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High
    });

    cachedPosition = normalizePosition(position);
    return cachedPosition;
  })();

  try {
    return await pendingPositionRequest;
  } finally {
    pendingPositionRequest = null;
  }
}
