import { useMemo, useReducer } from "react";
import type { SavedPlaceItem } from "@/stores/placeCartStore";
import type { MapSheetPlace } from "@/types/place";
import { isSamePlaceDuplicate } from "@/lib/placeDuplicate";
import {
  buildRoutePlan,
  getRecommendedStayMinutes,
  recalculateRouteDay,
  recalculateRoutePlanDays,
} from "../utils/routePlanBuilder";
import { useRoutePlanDrivingTimes } from "./useRoutePlanDrivingTimes";
import { reorderRouteItemsFromStart } from "../models/routeMapModel";
import type {
  ManualRouteInsertion,
  PlannedRouteDay,
  RouteInsertRequest,
  RouteStartLocation,
  TravelTempo,
} from "../models/routePlanTypes";

type UseRouteResultEditorParams = {
  savedPlaces: SavedPlaceItem[];
  initialRoutePlan?: PlannedRouteDay[] | null;
  travelStartDate: string;
  tripDays: number;
  dailyStartMinutes: number;
  dailyEndMinutes: number;
  tempo: TravelTempo | null;
  isScheduleValid: boolean;
  currentLocation: RouteStartLocation | null;
  isRouteSaveInFlight: () => boolean;
};

type RouteEditSnapshot = {
  stayOverrides: Record<string, number>;
  manualInsertions: ManualRouteInsertion[];
  removedPlaceIds: string[];
  routePlanOverride: PlannedRouteDay[] | null;
};

type RouteEditorState = {
  applied: RouteEditSnapshot;
  draft: RouteEditSnapshot;
};

type RouteEditorAction =
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

function routeEditorReducer(
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

function isSameStartLocation(
  left: RouteStartLocation | null,
  right: RouteStartLocation | null
) {
  if (!left || !right) {
    return left === right;
  }

  return left.lat === right.lat && left.lng === right.lng;
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

export function useRouteResultEditor({
  savedPlaces,
  initialRoutePlan = null,
  travelStartDate,
  tripDays,
  dailyStartMinutes,
  dailyEndMinutes,
  tempo,
  isScheduleValid,
  currentLocation,
  isRouteSaveInFlight,
}: UseRouteResultEditorParams) {
  const [editorState, dispatchEditor] = useReducer(routeEditorReducer, null, () => {
    const initialSnapshot = createInitialRouteEditSnapshot(initialRoutePlan);

    return {
      applied: initialSnapshot,
      draft: initialSnapshot,
    };
  });
  const { applied, draft } = editorState;
  const dispatchWhenEditable = (action: RouteEditorAction) => {
    if (!isRouteSaveInFlight()) {
      dispatchEditor(action);
    }
  };
  const isRouteEditDirty = useMemo(
    () =>
      JSON.stringify(draft.stayOverrides) !==
        JSON.stringify(applied.stayOverrides) ||
      JSON.stringify(draft.manualInsertions) !==
        JSON.stringify(applied.manualInsertions) ||
      JSON.stringify([...draft.removedPlaceIds].sort()) !==
      JSON.stringify([...applied.removedPlaceIds].sort()) ||
      JSON.stringify(draft.routePlanOverride) !==
        JSON.stringify(applied.routePlanOverride),
    [
      applied.manualInsertions,
      applied.removedPlaceIds,
      applied.routePlanOverride,
      applied.stayOverrides,
      draft.manualInsertions,
      draft.removedPlaceIds,
      draft.routePlanOverride,
      draft.stayOverrides,
    ]
  );

  const estimatedRoutePlan = useMemo(() => {
    if (!tempo || !isScheduleValid) {
      return [];
    }

    if (draft.routePlanOverride) {
      return recalculateRoutePlanDays({
        routePlan: alignRoutePlanWithSchedule({
          routePlan: draft.routePlanOverride,
          travelStartDate,
          tripDays,
          currentLocation,
        }),
        dailyStartMinutes,
        dailyEndMinutes,
        tempo,
        stayOverrides: draft.stayOverrides,
        currentLocation,
      });
    }

    const removedPlaceIdSet = new Set(draft.removedPlaceIds);
    const baseRoutePlan = buildRoutePlan({
      savedPlaces: savedPlaces.filter(
        (item) => !removedPlaceIdSet.has(item.place.id)
      ),
      travelStartDate,
      tripDays,
      dailyStartMinutes,
      dailyEndMinutes,
      tempo,
      stayOverrides: draft.stayOverrides,
      currentLocation,
    });

    const routePlanWithInsertions = applyManualRouteInsertions({
      routePlan: baseRoutePlan,
      insertions: draft.manualInsertions,
      dailyStartMinutes,
      dailyEndMinutes,
      tempo,
      stayOverrides: draft.stayOverrides,
      currentLocation,
    });

    return routePlanWithInsertions;
  }, [
    dailyEndMinutes,
    dailyStartMinutes,
    draft.manualInsertions,
    draft.removedPlaceIds,
    draft.routePlanOverride,
    currentLocation,
    draft.stayOverrides,
    isScheduleValid,
    savedPlaces,
    tempo,
    travelStartDate,
    tripDays,
  ]);

  const {
    routePlan,
    isLoading: isRouteTravelLoading,
    hasFallback: hasRouteTravelFallback,
    loadingDayNumbers: routeTravelLoadingDays,
    fallbackDayNumbers: routeTravelFallbackDays,
  } = useRoutePlanDrivingTimes({
    routePlan: estimatedRoutePlan,
    dailyStartMinutes,
    dailyEndMinutes,
  });

  const appliedRoutePlan = useMemo(() => {
    if (!tempo || !isScheduleValid) {
      return [];
    }

    if (applied.routePlanOverride) {
      return recalculateRoutePlanDays({
        routePlan: alignRoutePlanWithSchedule({
          routePlan: applied.routePlanOverride,
          travelStartDate,
          tripDays,
          currentLocation,
        }),
        dailyStartMinutes,
        dailyEndMinutes,
        tempo,
        stayOverrides: applied.stayOverrides,
        currentLocation,
      });
    }

    const removedPlaceIdSet = new Set(applied.removedPlaceIds);
    const baseRoutePlan = buildRoutePlan({
      savedPlaces: savedPlaces.filter(
        (item) => !removedPlaceIdSet.has(item.place.id)
      ),
      travelStartDate,
      tripDays,
      dailyStartMinutes,
      dailyEndMinutes,
      tempo,
      stayOverrides: applied.stayOverrides,
      currentLocation,
    });

    const routePlanWithInsertions = applyManualRouteInsertions({
      routePlan: baseRoutePlan,
      insertions: applied.manualInsertions,
      dailyStartMinutes,
      dailyEndMinutes,
      tempo,
      stayOverrides: applied.stayOverrides,
      currentLocation,
    });

    return routePlanWithInsertions;
  }, [
    applied.manualInsertions,
    applied.removedPlaceIds,
    applied.routePlanOverride,
    applied.stayOverrides,
    dailyEndMinutes,
    dailyStartMinutes,
    isScheduleValid,
    currentLocation,
    savedPlaces,
    tempo,
    travelStartDate,
    tripDays,
  ]);

  const handleChangeStayMinutes = (placeId: string, minutes: number) => {
    dispatchWhenEditable({ type: "change-stay-minutes", placeId, minutes });
  };

  const handleInsertPlace = (
    request: RouteInsertRequest,
    place: MapSheetPlace
  ) => {
    if (!tempo) {
      return;
    }

    const recommendedStayMinutes = getRecommendedStayMinutes(place, tempo);
    const nextRoutePlan = routePlan.map((day) => {
      if (day.day !== request.day) {
        return {
          ...day,
          items: day.items.filter(
            (item) => !isSamePlaceDuplicate(item.place, place)
          ),
        };
      }

      const nextItems = day.items.filter(
        (item) => !isSamePlaceDuplicate(item.place, place)
      );
      nextItems.splice(Math.min(request.insertIndex, nextItems.length), 0, {
        id: place.id,
        place,
        stayMinutes: draft.stayOverrides[place.id] ?? recommendedStayMinutes,
        recommendedStayMinutes,
        startMinutes: 0,
        endMinutes: 0,
        travelMinutesFromPrevious: 0,
        isOverSchedule: false,
      });

      return {
        ...day,
        items: nextItems,
      };
    });

    dispatchWhenEditable({
      type: "insert-place",
      placeId: place.id,
      routePlanOverride: nextRoutePlan,
    });
  };

  const handleRemoveRoutePlace = (placeId: string) => {
    if (routePlan.length > 0) {
      dispatchWhenEditable({
        type: "remove-place-from-plan",
        placeId,
        routePlanOverride: routePlan.map((day) => ({
          ...day,
          items: day.items.filter((item) => item.place.id !== placeId),
        })),
      });
    } else {
      dispatchWhenEditable({ type: "remove-place-from-empty-plan", placeId });
    }
  };

  const handleReorderRoutePlan = (nextRoutePlan: PlannedRouteDay[]) => {
    dispatchWhenEditable({
      type: "reorder-route-plan",
      routePlanOverride: nextRoutePlan,
    });
  };

  const handleChangeDayStartLocation = (
    dayNumber: number,
    location: RouteStartLocation
  ) => {
    const selectedDay = routePlan.find((day) => day.day === dayNumber);
    if (
      isRouteSaveInFlight() ||
      !selectedDay ||
      isSameStartLocation(selectedDay.startLocation, location)
    ) {
      return;
    }

    handleReorderRoutePlan(
      routePlan.map((day) =>
        day.day === dayNumber
          ? {
              ...day,
              startLocation: location,
              startsFromCurrentLocation: true,
              items: reorderRouteItemsFromStart(day.items, location),
            }
          : day
      )
    );
  };

  const handleApplyRouteEdits = () => {
    dispatchWhenEditable({ type: "apply-draft" });
  };

  const handleCancelRouteEdits = () => {
    dispatchWhenEditable({ type: "cancel-draft" });
  };

  return {
    routePlan,
    appliedRoutePlan,
    isRouteEditDirty,
    isRouteTravelLoading,
    hasRouteTravelFallback,
    routeTravelLoadingDays,
    routeTravelFallbackDays,
    handleChangeStayMinutes,
    handleChangeDayStartLocation,
    handleInsertPlace,
    handleRemoveRoutePlace,
    handleReorderRoutePlan,
    handleApplyRouteEdits,
    handleCancelRouteEdits,
  };
}
