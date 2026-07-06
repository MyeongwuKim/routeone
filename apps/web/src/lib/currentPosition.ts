export type RouteOnePosition = {
  lat: number;
  lng: number;
  accuracyMeters: number | null;
  timestamp: number;
};

type RouteOneNativeBridge = {
  getCurrentPosition?: () => Promise<RouteOnePosition>;
};

function getRouteOneNativeBridge() {
  return (window as Window & { RouteOneNative?: RouteOneNativeBridge })
    .RouteOneNative;
}

export function getCurrentPosition() {
  const nativeBridge = getRouteOneNativeBridge();

  if (nativeBridge?.getCurrentPosition) {
    return nativeBridge.getCurrentPosition();
  }

  return new Promise<RouteOnePosition>((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("현재 위치를 사용할 수 없어요."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracyMeters: position.coords.accuracy,
          timestamp: position.timestamp,
        });
      },
      () => {
        reject(new Error("현재 위치를 확인하지 못했어요."));
      },
      {
        enableHighAccuracy: false,
        maximumAge: 1000 * 60 * 5,
        timeout: 4000,
      }
    );
  });
}
