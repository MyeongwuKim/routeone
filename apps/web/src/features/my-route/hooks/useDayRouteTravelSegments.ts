/** DAY 출발지와 장소 사이의 자동차 이동시간을 저장값, 길찾기 응답 또는 거리 추정값으로 제공한다. */
import { useEffect, useMemo, useRef, useState } from "react";
import { fetchDrivingRouteFromCurrentLocation } from "@/lib/naverDirectionsApi";
import type { AppLanguage } from "@/stores/appLanguageStore";
import type { MyRoute, MyRouteDay, MyRouteStop } from "../types";
import { getDayRouteStartLocation } from "../utils/dayRouteStartLocation";

export type RouteLatLng = {
  lat: number;
  lng: number;
};

export type TravelSegmentState =
  | {
      status: "loading";
    }
  | {
      status: "success" | "fallback";
      minutes: number;
    }
  | {
      status: "error";
    };

type TravelSegmentRequest = {
  key: string;
  from: RouteLatLng;
  to: RouteLatLng;
};

function hasValidCoordinate(
  point: RouteLatLng | null | undefined
): point is RouteLatLng {
  return Boolean(
    point && Number.isFinite(point.lat) && Number.isFinite(point.lng)
  );
}

function calculateDistanceKm(from: RouteLatLng, to: RouteLatLng) {
  const earthRadiusKm = 6371;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const fromLat = toRadians(from.lat);
  const toLat = toRadians(to.lat);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
}

function estimateTravelMinutes(
  from: RouteLatLng | null | undefined,
  to: RouteLatLng | null | undefined
) {
  if (!hasValidCoordinate(from) || !hasValidCoordinate(to)) {
    return null;
  }

  const distanceKm = calculateDistanceKm(from, to);

  return Math.max(8, Math.round((distanceKm / 35) * 60));
}

function getCoordinateKey(point: RouteLatLng) {
  return `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`;
}

/** 두 좌표가 유효하면 소수점 여섯 자리 좌표 쌍으로 중복 요청을 구분하는 키를 만들고, 아니면 null을 반환한다. */
export function getTravelSegmentKey(
  from: RouteLatLng | null | undefined,
  to: RouteLatLng | null | undefined
) {
  if (!hasValidCoordinate(from) || !hasValidCoordinate(to)) {
    return null;
  }

  return `${getCoordinateKey(from)}>${getCoordinateKey(to)}`;
}

function createTravelSegmentRequest(
  from: RouteLatLng | null | undefined,
  to: RouteLatLng | null | undefined
): TravelSegmentRequest | null {
  const key = getTravelSegmentKey(from, to);

  if (!key || !hasValidCoordinate(from) || !hasValidCoordinate(to)) {
    return null;
  }

  return {
    key,
    from,
    to,
  };
}

/** 장소에 저장된 이전 구간 이동시간이 양수일 때만 success 상태로 반환한다. */
export function getStoredTravelSegment(
  stop: MyRouteStop | null | undefined
): TravelSegmentState | null {
  const minutes = stop?.travelMinutesFromPrevious;

  return typeof minutes === "number" && minutes > 0
    ? {
        status: "success",
        minutes,
      }
    : null;
}

type UseDayRouteTravelSegmentsOptions = {

  language: AppLanguage;

  days: MyRouteDay[];

  activeDayId: string;

  orderedStops: MyRouteStop[];

  stopsByDayId?: Record<string, MyRouteStop[]>;

  routeStartLocation: MyRoute["startLocation"];
};

/** 각 DAY의 출발지→첫 장소와 저장 시간이 없는 장소 간 구간을 만들고 같은 좌표 쌍은 한 요청으로 합친다. */
export function createDayRouteTravelSegmentRequests({
  days,
  activeDayId,
  orderedStops,
  stopsByDayId,
  routeStartLocation,
}: Omit<UseDayRouteTravelSegmentsOptions, "language">) {
  const requestByKey = new Map<string, TravelSegmentRequest>();
  const appendRequest = (request: TravelSegmentRequest | null) => {
    if (request) {
      requestByKey.set(request.key, request);
    }
  };

  days.forEach((routeDay) => {
    const routeDayStops =
      stopsByDayId?.[routeDay.id] ??
      (routeDay.id === activeDayId ? orderedStops : routeDay.stops);
    const firstStop = routeDayStops[0] ?? null;
    const startLocation = getDayRouteStartLocation(routeDay, routeStartLocation);

    if (firstStop && startLocation) {
      appendRequest(createTravelSegmentRequest(startLocation, firstStop.place));
    }

    routeDayStops.forEach((stop, index) => {
      const nextStop = routeDayStops[index + 1] ?? null;

      if (nextStop && !getStoredTravelSegment(nextStop)) {
        appendRequest(createTravelSegmentRequest(stop.place, nextStop.place));
      }
    });
  });

  return [...requestByKey.values()];
}

/**
 * 필요한 좌표 구간을 한 번씩 조회하고 결과를 프레임 단위로 묶어 상태에 반영한다.
 * 길찾기 실패 시 유효한 좌표는 직선거리와 시속 35km 기준 추정시간을 fallback으로 사용하며,
 * 훅 정리 뒤 도착한 결과와 이미 해결·요청 중인 키는 무시한다.
 */
export function useDayRouteTravelSegments({
  language,
  days,
  activeDayId,
  orderedStops,
  stopsByDayId,
  routeStartLocation,
}: UseDayRouteTravelSegmentsOptions) {
  const [travelSegmentByKey, setTravelSegmentByKey] = useState<
    Record<string, TravelSegmentState>
  >({});
  const resolvedSegmentByKeyRef = useRef<
    Record<string, TravelSegmentState>
  >({});
  const inFlightSegmentKeysRef = useRef(new Set<string>());
  const pendingSegmentUpdatesRef = useRef<
    Record<string, TravelSegmentState>
  >({});
  const updateFrameRef = useRef<number | null>(null);
  const isMountedRef = useRef(false);
  const requests = useMemo(
    () =>
      createDayRouteTravelSegmentRequests({
        days,
        activeDayId,
        orderedStops,
        stopsByDayId,
        routeStartLocation,
      }),
    [activeDayId, days, orderedStops, routeStartLocation, stopsByDayId]
  );

  useEffect(() => {
    const queueSegmentUpdate = (
      key: string,
      segment: TravelSegmentState
    ) => {
      resolvedSegmentByKeyRef.current[key] = segment;

      if (!isMountedRef.current) {
        return;
      }

      pendingSegmentUpdatesRef.current[key] = segment;

      if (updateFrameRef.current != null) {
        return;
      }

      updateFrameRef.current = window.requestAnimationFrame(() => {
        const updates = pendingSegmentUpdatesRef.current;
        pendingSegmentUpdatesRef.current = {};
        updateFrameRef.current = null;
        setTravelSegmentByKey((currentSegments) => ({
          ...currentSegments,
          ...updates,
        }));
      });
    };
    const pendingRequests = requests.filter(
      (request) =>
        !resolvedSegmentByKeyRef.current[request.key] &&
        !inFlightSegmentKeysRef.current.has(request.key)
    );

    pendingRequests.forEach((request) => {
      inFlightSegmentKeysRef.current.add(request.key);
      void fetchDrivingRouteFromCurrentLocation({
        startLat: request.from.lat,
        startLng: request.from.lng,
        goalLat: request.to.lat,
        goalLng: request.to.lng,
        language,
      })
        .then((routeResult) => {
          queueSegmentUpdate(request.key, {
            status: "success",
            minutes: Math.max(1, Math.round(routeResult.durationMs / 60000)),
          });
        })
        .catch(() => {
          const fallbackMinutes = estimateTravelMinutes(
            request.from,
            request.to
          );

          queueSegmentUpdate(
            request.key,
            fallbackMinutes != null
              ? {
                  status: "fallback",
                  minutes: fallbackMinutes,
                }
              : {
                  status: "error",
                }
          );
        })
        .finally(() => {
          inFlightSegmentKeysRef.current.delete(request.key);
        });
    });
  }, [language, requests]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      if (updateFrameRef.current != null) {
        window.cancelAnimationFrame(updateFrameRef.current);
      }
    };
  }, []);

  return travelSegmentByKey;
}
