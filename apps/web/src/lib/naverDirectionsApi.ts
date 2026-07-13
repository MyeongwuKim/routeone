const DIRECTIONS_API_BASE_URL = "/map-direction/v1/driving";

type DirectionsLanguage = "ko" | "en";

type DirectionsApiResponse = {
  code?: number;
  message?: string;
  route?: {
    traoptimal?: Array<{
      summary?: {
        distance?: number;
        duration?: number;
      };
      path?: Array<[number, number]>;
    }>;
  };
};

export type DrivingRouteResult = {
  durationMs: number;
  distanceM: number;
  path: Array<{ lat: number; lng: number }>;
};

type FetchDrivingRouteParams = {
  startLat: number;
  startLng: number;
  goalLat: number;
  goalLng: number;
  language?: DirectionsLanguage;
};

export async function fetchDrivingRouteFromCurrentLocation(
  params: FetchDrivingRouteParams
) {
  const query = new URLSearchParams({
    start: `${params.startLng},${params.startLat}`,
    goal: `${params.goalLng},${params.goalLat}`,
    option: "traoptimal",
    lang: params.language ?? "ko",
  });

  const response = await fetch(`${DIRECTIONS_API_BASE_URL}?${query.toString()}`);

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error(
        "네이버 길찾기 API 인증에 실패했습니다. VITE_NCP_MAPS_KEY_ID, VITE_NCP_MAPS_KEY 값을 확인해주세요."
      );
    }

    const errorText = (await response.text()).trim();
    throw new Error(
      `Directions API request failed: ${response.status}${
        errorText ? ` (${errorText})` : ""
      }`
    );
  }

  const data = (await response.json()) as DirectionsApiResponse;
  if (data.code !== 0) {
    throw new Error(data.message ?? "길찾기 정보를 가져오지 못했습니다.");
  }

  const route = data.route?.traoptimal?.[0];
  const durationMs = route?.summary?.duration ?? 0;
  const distanceM = route?.summary?.distance ?? 0;
  const path =
    route?.path?.map(([lng, lat]) => ({
      lat,
      lng,
    })) ?? [];

  if (path.length === 0) {
    throw new Error("경로 좌표를 찾지 못했습니다.");
  }

  return {
    durationMs,
    distanceM,
    path,
  } satisfies DrivingRouteResult;
}
