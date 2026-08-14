import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchDrivingRouteFromCurrentLocation } from "@/lib/naverDirectionsApi";
import type {
  PlannedRouteDay,
  RouteStartLocation,
} from "../models/routePlanTypes";

type RouteTravelSegment = {
  day: number;
  itemIndex: number;
  from: RouteStartLocation;
  to: RouteStartLocation;
};

type UseRoutePlanDrivingTimesOptions = {
  routePlan: PlannedRouteDay[];
  dailyStartMinutes: number;
  dailyEndMinutes: number;
};

const EMPTY_TRAVEL_MINUTES: Array<number | null> = [];

function buildRouteTravelSegments(routePlan: PlannedRouteDay[]) {
  return routePlan.flatMap((day) =>
    day.items.flatMap((item, itemIndex) => {
      const previousPoint =
        itemIndex === 0 ? day.startLocation : day.items[itemIndex - 1]?.place;

      if (!previousPoint) {
        return [];
      }

      return [
        {
          day: day.day,
          itemIndex,
          from: {
            lat: previousPoint.lat,
            lng: previousPoint.lng,
          },
          to: {
            lat: item.place.lat,
            lng: item.place.lng,
          },
        } satisfies RouteTravelSegment,
      ];
    })
  );
}

function getRouteTravelSegmentKey(day: number, itemIndex: number) {
  return `${day}:${itemIndex}`;
}

async function fetchRouteTravelMinutes(
  segments: RouteTravelSegment[]
): Promise<Array<number | null>> {
  const travelMinutes: Array<number | null> = [];

  for (const segment of segments) {
    try {
      const route = await fetchDrivingRouteFromCurrentLocation({
        startLat: segment.from.lat,
        startLng: segment.from.lng,
        goalLat: segment.to.lat,
        goalLng: segment.to.lng,
      });
      travelMinutes.push(Math.max(1, Math.round(route.durationMs / 60000)));
    } catch {
      travelMinutes.push(null);
    }
  }

  return travelMinutes;
}

function applyRouteTravelMinutes({
  routePlan,
  segments,
  resolvedTravelMinutes,
  dailyStartMinutes,
  dailyEndMinutes,
}: UseRoutePlanDrivingTimesOptions & {
  segments: RouteTravelSegment[];
  resolvedTravelMinutes: Array<number | null>;
}) {
  const travelMinutesByItem = new Map<string, number>();

  segments.forEach((segment, index) => {
    const travelMinutes = resolvedTravelMinutes[index];

    if (travelMinutes != null) {
      travelMinutesByItem.set(
        getRouteTravelSegmentKey(segment.day, segment.itemIndex),
        travelMinutes
      );
    }
  });

  return routePlan.map((day) => {
    let currentMinutes = dailyStartMinutes;

    return {
      ...day,
      items: day.items.map((item, itemIndex) => {
        const travelMinutes =
          travelMinutesByItem.get(
            getRouteTravelSegmentKey(day.day, itemIndex)
          ) ?? item.travelMinutesFromPrevious;
        const startMinutes = currentMinutes + travelMinutes;
        const endMinutes = startMinutes + item.stayMinutes;

        currentMinutes = endMinutes;

        return {
          ...item,
          travelMinutesFromPrevious: travelMinutes,
          startMinutes,
          endMinutes,
          isOverSchedule: endMinutes > dailyEndMinutes,
        };
      }),
    };
  });
}

export function useRoutePlanDrivingTimes({
  routePlan,
  dailyStartMinutes,
  dailyEndMinutes,
}: UseRoutePlanDrivingTimesOptions) {
  const segments = useMemo(
    () => buildRouteTravelSegments(routePlan),
    [routePlan]
  );
  const routeSegmentSignature = useMemo(
    () =>
      segments.map((segment) => [
        segment.from.lat,
        segment.from.lng,
        segment.to.lat,
        segment.to.lng,
      ]),
    [segments]
  );
  const travelMinutesQuery = useQuery({
    queryKey: ["route-checkout-driving-times", routeSegmentSignature],
    queryFn: () => fetchRouteTravelMinutes(segments),
    enabled: segments.length > 0,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    retry: false,
  });
  const resolvedTravelMinutes =
    travelMinutesQuery.data ?? EMPTY_TRAVEL_MINUTES;
  const resolvedRoutePlan = useMemo(
    () =>
      applyRouteTravelMinutes({
        routePlan,
        segments,
        resolvedTravelMinutes,
        dailyStartMinutes,
        dailyEndMinutes,
      }),
    [
      dailyEndMinutes,
      dailyStartMinutes,
      resolvedTravelMinutes,
      routePlan,
      segments,
    ]
  );

  return {
    routePlan: resolvedRoutePlan,
    isLoading: segments.length > 0 && travelMinutesQuery.isPending,
    hasFallback:
      travelMinutesQuery.isError ||
      resolvedTravelMinutes.some((travelMinutes) => travelMinutes == null),
  };
}
