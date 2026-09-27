/** 일정의 출발지→첫 장소와 장소 간 자동차 이동시간을 조회해 DAY별 시간 계산에 제공한다. */
import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
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

/**
 * 좌표가 있는 구간을 DAY와 itemIndex로 구분해 Query로 조회하고 분 단위로 변환한다.
 * 개별 구간 실패는 null로 남겨 다른 구간 계산을 유지하며, 조회 결과로 각 DAY의 도착·종료 시각을 다시 계산한다.
 */
export function useRoutePlanDrivingTimes({
  routePlan,
  dailyStartMinutes,
  dailyEndMinutes,
}: UseRoutePlanDrivingTimesOptions) {
  const segmentsByDay = useMemo(
    () => routePlan.map((day) => buildRouteTravelSegments([day])),
    [routePlan]
  );
  const travelMinutesQueries = useQueries({
    queries: segmentsByDay.map((segments, index) => ({
      queryKey: [
        "route-checkout-day-driving-times",
        routePlan[index].day,
        segments.map((segment) => [
          segment.from.lat,
          segment.from.lng,
          segment.to.lat,
          segment.to.lng,
        ]),
      ],
      queryFn: () => fetchRouteTravelMinutes(segments),
      enabled: segments.length > 0,
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      retry: false,
    })),
  });
  const resolvedRoutePlan = routePlan.flatMap((day, index) =>
    applyRouteTravelMinutes({
      routePlan: [day],
      segments: segmentsByDay[index],
      resolvedTravelMinutes:
        travelMinutesQueries[index].data ?? EMPTY_TRAVEL_MINUTES,
      dailyStartMinutes,
      dailyEndMinutes,
    })
  );
  const loadingDayNumbers = routePlan.flatMap((day, index) =>
    segmentsByDay[index].length > 0 && travelMinutesQueries[index].isPending
      ? [day.day]
      : []
  );
  const fallbackDayNumbers = routePlan.flatMap((day, index) =>
    travelMinutesQueries[index].isError ||
    travelMinutesQueries[index].data?.some((minutes) => minutes == null)
      ? [day.day]
      : []
  );

  return {
    routePlan: resolvedRoutePlan,
    loadingDayNumbers,
    fallbackDayNumbers,
    isLoading: loadingDayNumbers.length > 0,
    hasFallback: fallbackDayNumbers.length > 0,
  };
}
