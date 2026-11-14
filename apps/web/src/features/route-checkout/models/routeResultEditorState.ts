import { isSamePlaceDuplicate } from "@/lib/placeDuplicate";
import type { SavedPlaceItem } from "@/stores/placeCartStore";
import {
  buildRoutePlan,
  getRecommendedStayMinutes,
  recalculateRouteDay,
  recalculateRoutePlanDays,
} from "../utils/routePlanBuilder";
import type {
  ManualRouteInsertion,
  PlannedRouteDay,
  RouteStartLocation,
  TravelTempo,
} from "./routePlanTypes";

/** 추천 일정 위에 적용하는 체류시간·삽입·삭제·배치 변경을 묶어 결과 단계 재진입 때 복원한다. */
export type RouteEditSnapshot = {
  /** 장소 ID별 수동 체류시간(분). 지정하지 않은 장소는 일정의 기존 값이나 추천값을 쓴다. */
  stayOverrides: Record<string, number>;
  /** 자동 배치 결과에 추가할 장소와 DAY·삽입 위치. 배치를 직접 편집하면 해당 일정에 합쳐진다. */
  manualInsertions: ManualRouteInsertion[];
  /** 자동 배치에서 제외할 장소 ID. 직접 편집한 배치에는 이미 삭제 결과가 반영된다. */
  removedPlaceIds: string[];
  /** 수동 편집한 날짜별 배치. null이면 담은 장소와 일정 설정으로 다시 계산한다. */
  routePlanOverride: PlannedRouteDay[] | null;
};

/** 적용 기준과 아직 적용하지 않은 변경을 각각 보존해 재진입 후에도 적용·취소를 구분한다. */
export type RouteEditorState = {
  /** 취소 시 돌아갈 마지막 적용 상태. */
  applied: RouteEditSnapshot;
  /** 화면에서 현재 편집 중인 상태. */
  draft: RouteEditSnapshot;
};

/** 결과 편집에서 draft를 갱신하거나 적용·취소할 변경 명령. */
export type RouteEditorAction =
  | { type: "change-stay-minutes"; placeId: string; minutes: number }
  | {
      type: "insert-place";
      placeId: string;
      routePlanOverride: PlannedRouteDay[];
    }
  | {
      type: "remove-place-from-plan";
      placeId: string;
      routePlanOverride: PlannedRouteDay[];
    }
  | { type: "remove-place-from-empty-plan"; placeId: string }
  | { type: "reorder-route-plan"; routePlanOverride: PlannedRouteDay[] }
  | { type: "apply-draft" }
  | { type: "cancel-draft" };

function createInitialRouteEditSnapshot(
  initialRoutePlan: PlannedRouteDay[] | null
): RouteEditSnapshot {
  return {
    stayOverrides: {},
    manualInsertions: [],
    removedPlaceIds: [],
    routePlanOverride: initialRoutePlan,
  };
}

function removeStayOverride(
  stayOverrides: Record<string, number>,
  placeId: string
) {
  const nextStayOverrides = { ...stayOverrides };
  delete nextStayOverrides[placeId];
  return nextStayOverrides;
}

/**
 * 편집 명령을 draft에만 반영하고, 적용·취소 시 두 snapshot이 같은 기준을 참조하게 한다.
 * 입력 상태와 일정은 변경하지 않으며 저장 잠금과 영속화는 호출한 Hook에서 처리한다.
 */
export function routeEditorReducer(
  state: RouteEditorState,
  action: RouteEditorAction
): RouteEditorState {
  switch (action.type) {
    case "change-stay-minutes":
      return {
        ...state,
        draft: {
          ...state.draft,
          stayOverrides: {
            ...state.draft.stayOverrides,
            [action.placeId]: action.minutes,
          },
        },
      };
    case "insert-place":
      return {
        ...state,
        draft: {
          ...state.draft,
          routePlanOverride: action.routePlanOverride,
          manualInsertions: [],
          removedPlaceIds: state.draft.removedPlaceIds.filter(
            (placeId) => placeId !== action.placeId
          ),
        },
      };
    case "remove-place-from-plan":
      return {
        ...state,
        draft: {
          ...state.draft,
          stayOverrides: removeStayOverride(
            state.draft.stayOverrides,
            action.placeId
          ),
          routePlanOverride: action.routePlanOverride,
          manualInsertions: [],
          removedPlaceIds: [],
        },
      };
    case "remove-place-from-empty-plan":
      return {
        ...state,
        draft: {
          ...state.draft,
          stayOverrides: removeStayOverride(
            state.draft.stayOverrides,
            action.placeId
          ),
          manualInsertions: state.draft.manualInsertions.filter(
            (insertion) => insertion.place.id !== action.placeId
          ),
          removedPlaceIds: state.draft.removedPlaceIds.includes(action.placeId)
            ? state.draft.removedPlaceIds
            : [...state.draft.removedPlaceIds, action.placeId],
        },
      };
    case "reorder-route-plan":
      return {
        ...state,
        draft: {
          ...state.draft,
          routePlanOverride: action.routePlanOverride,
          manualInsertions: [],
          removedPlaceIds: [],
        },
      };
    case "apply-draft":
      return {
        applied: state.draft,
        draft: state.draft,
      };
    case "cancel-draft":
      return {
        applied: state.applied,
        draft: state.applied,
      };
    default:
      return state;
  }
}

/** 복원 상태가 있으면 그대로 반환하고, 없으면 초기 일정을 적용·편집 상태가 함께 참조하게 한다. */
export function createRouteEditorState(
  initialRoutePlan: PlannedRouteDay[] | null,
  restoredState: RouteEditorState | null = null
): RouteEditorState {
  if (restoredState) {
    return restoredState;
  }

  const initialSnapshot = createInitialRouteEditSnapshot(initialRoutePlan);
  return {
    applied: initialSnapshot,
    draft: initialSnapshot,
  };
}

function addDays(dateValue: string, days: number) {
  const [yearText, monthText, dayText] = dateValue.split("-");
  const date = new Date(Number(yearText), Number(monthText) - 1, Number(dayText));

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  date.setDate(date.getDate() + days);

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function alignRoutePlanWithSchedule(options: {
  routePlan: PlannedRouteDay[];
  travelStartDate: string;
  tripDays: number;
  currentLocation: RouteStartLocation | null;
}) {
  const dayCount = Math.max(1, Math.floor(options.tripDays));
  const sortedSourceDays = [...options.routePlan].sort((a, b) => a.day - b.day);

  const alignedRoutePlan = Array.from({ length: dayCount }, (_, index) => {
    const dayNumber = index + 1;
    const sourceDay = sortedSourceDays[index];
    const date = options.travelStartDate
      ? addDays(options.travelStartDate, index)
      : "";

    if (!sourceDay) {
      return {
        day: dayNumber,
        date,
        startsFromCurrentLocation: Boolean(options.currentLocation),
        startLocation: options.currentLocation,
        items: [],
      } satisfies PlannedRouteDay;
    }

    return {
      ...sourceDay,
      day: dayNumber,
      date,
      startLocation: sourceDay.startLocation ?? options.currentLocation,
      startsFromCurrentLocation: Boolean(
        sourceDay.startLocation ?? options.currentLocation
      ),
    };
  });

  sortedSourceDays.slice(dayCount).forEach((sourceDay) => {
    const lastDay = alignedRoutePlan[dayCount - 1];
    lastDay.items = [...lastDay.items, ...sourceDay.items];
  });

  return alignedRoutePlan;
}

function applyManualRouteInsertions(options: {
  routePlan: PlannedRouteDay[];
  insertions: ManualRouteInsertion[];
  dailyStartMinutes: number;
  dailyEndMinutes: number;
  tempo: TravelTempo;
  stayOverrides: Record<string, number>;
  currentLocation: RouteStartLocation | null;
}) {
  const {
    routePlan,
    insertions,
    dailyStartMinutes,
    dailyEndMinutes,
    tempo,
    stayOverrides,
    currentLocation,
  } = options;

  if (insertions.length === 0) {
    return routePlan;
  }

  return routePlan.map((day) => {
    const dayInsertions = insertions
      .filter((insertion) => insertion.request.day === day.day)
      .sort((a, b) => a.request.insertIndex - b.request.insertIndex);

    if (dayInsertions.length === 0) {
      return day;
    }

    const nextItems = [...day.items];
    dayInsertions.forEach((insertion, offset) => {
      if (
        nextItems.some((item) =>
          isSamePlaceDuplicate(item.place, insertion.place)
        )
      ) {
        return;
      }

      const recommendedStayMinutes = getRecommendedStayMinutes(
        insertion.place,
        tempo
      );
      const insertIndex = Math.min(
        insertion.request.insertIndex + offset,
        nextItems.length
      );
      nextItems.splice(insertIndex, 0, {
        id: insertion.place.id,
        place: insertion.place,
        stayMinutes:
          stayOverrides[insertion.place.id] ?? recommendedStayMinutes,
        recommendedStayMinutes,
        startMinutes: 0,
        endMinutes: 0,
        travelMinutesFromPrevious: 0,
        isOverSchedule: false,
      });
    });

    return recalculateRouteDay({
      day: {
        ...day,
        items: nextItems,
      },
      dailyStartMinutes,
      dailyEndMinutes,
      tempo,
      stayOverrides,
      currentLocation,
    });
  });
}

/**
 * snapshot의 수동 배치가 있으면 날짜·일수를 맞춰 재계산하고, 없으면 삭제·삽입을 자동 배치에 반영한다.
 * 일정 조건이 유효하지 않으면 빈 배열을 반환한다. 원본 snapshot과 일정은 변경하지 않는다.
 */
export function resolveRouteEditorSnapshot(
  snapshot: RouteEditSnapshot,
  options: {
    savedPlaces: SavedPlaceItem[];
    travelStartDate: string;
    tripDays: number;
    dailyStartMinutes: number;
    dailyEndMinutes: number;
    tempo: TravelTempo | null;
    isScheduleValid: boolean;
    currentLocation: RouteStartLocation | null;
  }
): PlannedRouteDay[] {
  const {
    savedPlaces,
    travelStartDate,
    tripDays,
    dailyStartMinutes,
    dailyEndMinutes,
    tempo,
    isScheduleValid,
    currentLocation,
  } = options;

  if (!tempo || !isScheduleValid) {
    return [];
  }

  if (snapshot.routePlanOverride) {
    return recalculateRoutePlanDays({
      routePlan: alignRoutePlanWithSchedule({
        routePlan: snapshot.routePlanOverride,
        travelStartDate,
        tripDays,
        currentLocation,
      }),
      dailyStartMinutes,
      dailyEndMinutes,
      tempo,
      stayOverrides: snapshot.stayOverrides,
      currentLocation,
    });
  }

  const removedPlaceIdSet = new Set(snapshot.removedPlaceIds);
  const baseRoutePlan = buildRoutePlan({
    savedPlaces: savedPlaces.filter(
      (item) => !removedPlaceIdSet.has(item.place.id)
    ),
    travelStartDate,
    tripDays,
    dailyStartMinutes,
    dailyEndMinutes,
    tempo,
    stayOverrides: snapshot.stayOverrides,
    currentLocation,
  });

  const routePlanWithInsertions = applyManualRouteInsertions({
    routePlan: baseRoutePlan,
    insertions: snapshot.manualInsertions,
    dailyStartMinutes,
    dailyEndMinutes,
    tempo,
    stayOverrides: snapshot.stayOverrides,
    currentLocation,
  });

  return routePlanWithInsertions;
}
