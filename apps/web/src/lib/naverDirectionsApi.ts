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

function getDirectionsFailureMessage(language: DirectionsLanguage) {
  return language === "en"
    ? "Could not load directions."
    : "길찾기 정보를 가져오지 못했습니다.";
}

export async function fetchDrivingRouteFromCurrentLocation(
  params: FetchDrivingRouteParams
) {
  const language = params.language ?? "ko";
  const query = new URLSearchParams({
    start: `${params.startLng},${params.startLat}`,
    goal: `${params.goalLng},${params.goalLat}`,
    option: "traoptimal",
    lang: language,
  });

  const response = await fetch(`${DIRECTIONS_API_BASE_URL}?${query.toString()}`);

  if (!response.ok) {
    const errorText = (await response.text()).trim();
    console.warn("[naver-directions] request failed", {
      status: response.status,
      response: errorText || null,
    });
    throw new Error(getDirectionsFailureMessage(language));
  }

  const data = (await response.json()) as DirectionsApiResponse;
  if (data.code !== 0) {
    console.warn("[naver-directions] response rejected", {
      code: data.code ?? null,
      message: data.message ?? null,
    });
    throw new Error(getDirectionsFailureMessage(language));
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
    console.warn("[naver-directions] route path is empty");
    throw new Error(getDirectionsFailureMessage(language));
  }

  return {
    durationMs,
    distanceM,
    path,
  } satisfies DrivingRouteResult;
}
