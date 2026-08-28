import * as Location from "expo-location";

const CACHED_POSITION_MAX_AGE_MS = 1000 * 60 * 5;
const LAST_KNOWN_POSITION_MAX_AGE_MS = 1000 * 15;
const LAST_KNOWN_POSITION_REQUIRED_ACCURACY_METERS = 50;
const FRESH_POSITION_MAX_AGE_MS = 15_000;
const FRESH_POSITION_TIMEOUT_MS = 20_000;
const POSITION_FUTURE_TOLERANCE_MS = 5_000;

export type NativeCurrentPosition = {
  lat: number;
  lng: number;
  accuracyMeters: number | null;
  timestamp: number;
};

let cachedPosition: NativeCurrentPosition | null = null;
let pendingPositionRequest: Promise<NativeCurrentPosition> | null = null;
let pendingFreshPositionRequest: Promise<NativeCurrentPosition> | null = null;

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

function rememberPosition(position: NativeCurrentPosition) {
  if (!cachedPosition || position.timestamp >= cachedPosition.timestamp) {
    cachedPosition = position;
  }

  return position;
}

async function requestFreshPosition() {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    const position = normalizePosition(
      await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error("새 위치를 확인하지 못했어요. GPS 신호가 잡히는 곳에서 다시 시도해 주세요."));
          }, FRESH_POSITION_TIMEOUT_MS);
        })
      ])
    );
    const ageMs = Date.now() - position.timestamp;

    if (
      !Number.isFinite(position.timestamp) ||
      ageMs > FRESH_POSITION_MAX_AGE_MS ||
      ageMs < -POSITION_FUTURE_TOLERANCE_MS
    ) {
      throw new Error("현재 위치가 갱신되지 않았어요. 잠시 후 다시 시도해 주세요.");
    }

    return position;
  } finally {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  }
}

export async function prepareNativeCurrentPosition({
  requestPermission = true,
  forceRefresh = false
}: {
  requestPermission?: boolean;
  forceRefresh?: boolean;
} = {}) {
  const pendingRequest = forceRefresh
    ? pendingFreshPositionRequest
    : pendingFreshPositionRequest ?? pendingPositionRequest;

  if (pendingRequest) {
    return pendingRequest;
  }

  const positionRequest = (async () => {
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
        return rememberPosition(normalizePosition(lastKnownPosition));
      }
    }

    const position = forceRefresh
      ? await requestFreshPosition()
      : normalizePosition(await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High
        }));

    return rememberPosition(position);
  })();

  if (forceRefresh) {
    pendingFreshPositionRequest = positionRequest;
  } else {
    pendingPositionRequest = positionRequest;
  }

  try {
    return await positionRequest;
  } finally {
    if (forceRefresh) {
      pendingFreshPositionRequest = null;
    } else {
      pendingPositionRequest = null;
    }
  }
}
