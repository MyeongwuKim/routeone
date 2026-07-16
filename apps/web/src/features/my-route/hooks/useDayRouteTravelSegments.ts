import { useEffect, useMemo, useRef, useState } from "react";
import { fetchDrivingRouteFromCurrentLocation } from "@/lib/naverDirectionsApi";
import type { AppLanguage } from "@/stores/appLanguageStore";
import type { MyRoute, MyRouteDay, MyRouteStop } from "../types";

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
  startLocation: MyRoute["startLocation"];
};

export function useDayRouteTravelSegments({
  language,
  days,
  activeDayId,
  orderedStops,
  startLocation,
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
  const requests = useMemo(() => {
    const requestByKey = new Map<string, TravelSegmentRequest>();
    const appendRequest = (request: TravelSegmentRequest | null) => {
      if (request) {
        requestByKey.set(request.key, request);
      }
    };

    days.forEach((routeDay) => {
      const routeDayStops =
        routeDay.id === activeDayId ? orderedStops : routeDay.stops;
      const firstStop = routeDayStops[0] ?? null;

      if (firstStop && !getStoredTravelSegment(firstStop)) {
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
  }, [activeDayId, days, orderedStops, startLocation]);

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
