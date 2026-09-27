
import { routeApi } from "./routeApi";
import type { AppendRouteDaysInput, CreateRouteInput } from "@/generated/graphql";
import {
  getMapSheetPlaceRegionCode,
  getMapSheetPlaceRegionLabelKey,
  mapSheetPlaceToPlaceSnapshotInput,
} from "@/lib/routePlaceSnapshot";
import type { MapSheetPlace } from "@/types/place";

export type RouteCheckoutPlanDay = {
  /** 비어 있는 일차 제거 전의 화면상 일차 번호 */
  day: number;
  /** 해당 일차의 출발 좌표. 없으면 전체 일정 출발지를 사용한다. */
  startLocation?: { lat: number; lng: number } | null;
  items: Array<{
    stayMinutes: number;
    travelMinutesFromPrevious?: number | null;
    place: MapSheetPlace;
  }>;
};

export type SaveRoutePlanInput = {
  /** 일정 만들기 화면에서 편집한 일차와 장소 목록 */
  routePlan: RouteCheckoutPlanDay[];
  /** 첫 일차의 여행 시작일 문자열 */
  travelStartDate: string;
  /** 화면에서 선택한 여행 일수. 서버 입력은 비어 있지 않은 일차 수로 다시 계산한다. */
  tripDays: number;
  /** 각 일차의 기본 출발 시각을 자정부터 분 단위로 표현한 값 */
  dailyStartMinutes: number;
  /** 하루 일정 종료 제한 시각을 자정부터 분 단위로 표현한 값 */
  scheduleEndMinutes: number;
  /** 개별 일차 출발지가 없을 때 사용할 전체 일정 출발 좌표 */
  startLocation?: {
    lat: number;
    lng: number;
  } | null;
};

type RouteTravelPoint = {
  lat: number;
  lng: number;
};

function normalizeRoutePlanDays(routePlan: RouteCheckoutPlanDay[]) {
  const nonEmptyDays = routePlan
    .filter((day) => day.items.length > 0)
    .sort((left, right) => left.day - right.day);

  if (nonEmptyDays.length === 0) {
    return {
      routePlan: [],
      tripDays: 1,
    };
  }

  return {
    routePlan: nonEmptyDays.map((day, index) => ({
      ...day,
      day: index + 1,
    })),
    tripDays: nonEmptyDays.length,
  };
}

/** 장소가 없는 일차를 제거하고 번호를 다시 매겼을 때 서버에 저장될 실제 여행 일수를 반환한다. */
export function getEffectiveRoutePlanTripDays(
  routePlan: RouteCheckoutPlanDay[]
) {
  return normalizeRoutePlanDays(routePlan).tripDays;
}

function getMostFrequentValue(values: Array<string | null | undefined>) {
  const counts = new Map<string, number>();

  values.forEach((value) => {
    if (!value) {
      return;
    }

    counts.set(value, (counts.get(value) ?? 0) + 1);
  });

  return (
    [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ??
    null
  );
}

function hasValidTravelPoint(
  point: RouteTravelPoint | null | undefined
): point is RouteTravelPoint {
  return Boolean(
    point && Number.isFinite(point.lat) && Number.isFinite(point.lng)
  );
}

function toRouteStartLocation(
  point: RouteTravelPoint | null | undefined
): RouteTravelPoint | null {
  if (!hasValidTravelPoint(point)) {
    return null;
  }

  return {
    lat: point.lat,
    lng: point.lng,
  };
}

/**
 * 빈 일차를 제거하고 남은 일차를 1부터 다시 번호 매겨 CreateRouteInput으로 변환한다.
 * 장소가 가장 많이 속한 지역을 대표 지역으로 선택하고, 유효한 전체·일차별 출발 좌표만 포함한다.
 * 장소 순서는 정규화된 일차 순서대로 하나의 연속 order를 부여한다.
 */
export function buildCreateRouteInput(
  input: SaveRoutePlanInput
): CreateRouteInput {
  const normalizedPlan = normalizeRoutePlanDays(input.routePlan);
  const startLocation = toRouteStartLocation(input.startLocation);
  const routeStops = normalizedPlan.routePlan.flatMap((day) =>
    day.items.map((item) => ({
      day,
      item,
    }))
  );
  const primaryRegionCode = getMostFrequentValue(
    routeStops.map(({ item }) => getMapSheetPlaceRegionCode(item.place))
  );
  const primaryRegionLabelKey = getMostFrequentValue(
    routeStops.map(({ item }) => getMapSheetPlaceRegionLabelKey(item.place))
  );

  return {
    countryCode: "KR",
    primaryRegionCode,
    primaryRegionLabelKey,
    tripDays: normalizedPlan.tripDays,
    travelStartDate: input.travelStartDate,
    dailyStartMinutes: input.dailyStartMinutes,
    scheduleEndMinutes: input.scheduleEndMinutes,
    startLocation,
    dayStartLocations: normalizedPlan.routePlan.flatMap((day) => {
      const dayStartLocation = toRouteStartLocation(
        day.startLocation ?? input.startLocation
      );

      return dayStartLocation
        ? [{ dayIndex: day.day, startLocation: dayStartLocation }]
        : [];
    }),
    stops: routeStops.map(({ day, item }, index) => ({
      dayIndex: day.day,
      order: index + 1,
      stayMinutes: item.stayMinutes,
      travelMinutesFromPrevious: item.travelMinutesFromPrevious ?? null,
      place: mapSheetPlaceToPlaceSnapshotInput(item.place),
    })),
  };
}

function buildAppendRouteDaysInput(
  routeId: string,
  input: SaveRoutePlanInput
): AppendRouteDaysInput {
  const routeInput = buildCreateRouteInput(input);

  return {
    routeId,
    tripDays: routeInput.tripDays,
    travelStartDate: routeInput.travelStartDate,
    travelEndDate: routeInput.travelEndDate,
    startLocation: routeInput.startLocation,
    dayStartLocations: routeInput.dayStartLocations,
    stops: routeInput.stops,
  };
}

/** 새 경로 생성과 기존 경로 일차 추가에 공통 일정 변환 규칙을 적용한 뒤 routeApi에 요청을 위임한다. */
export const routeCheckoutApi = {
  async saveRoutePlan(input: SaveRoutePlanInput, clientRequestId: string) {
    const routeInput = buildCreateRouteInput(input);
    routeInput.clientRequestId = clientRequestId;

    return routeApi.createRoute(routeInput);
  },
  async appendRouteDays(routeId: string, input: SaveRoutePlanInput) {
    return routeApi.appendRouteDays(buildAppendRouteDaysInput(routeId, input));
  },
};
