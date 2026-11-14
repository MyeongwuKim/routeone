/** 추천 일정의 체류시간·장소 삽입·삭제·순서·DAY 출발지를 draft로 편집하고 적용 상태와 비교한다. */
import { useEffect, useMemo, useReducer } from "react";
import type { SavedPlaceItem } from "@/stores/placeCartStore";
import type { MapSheetPlace } from "@/types/place";
import { isSamePlaceDuplicate } from "@/lib/placeDuplicate";
import { getRecommendedStayMinutes } from "../utils/routePlanBuilder";
import { useRoutePlanDrivingTimes } from "./useRoutePlanDrivingTimes";
import { reorderRouteItemsFromStart } from "../models/routeMapModel";
import {
  createRouteEditorState,
  resolveRouteEditorSnapshot,
  routeEditorReducer,
  type RouteEditorAction,
  type RouteEditorState,
} from "../models/routeResultEditorState";
import type {
  PlannedRouteDay,
  RouteInsertRequest,
  RouteStartLocation,
  TravelTempo,
} from "../models/routePlanTypes";

type UseRouteResultEditorParams = {

  savedPlaces: SavedPlaceItem[];
  /** 편집 draft를 만들고 변경 여부를 비교할 기준 일정 */
  initialRoutePlan?: PlannedRouteDay[] | null;
  /** 결과 단계를 떠나기 전의 적용 기준과 미적용 변경. 처음 마운트할 때만 복원한다. */
  initialEditorState?: RouteEditorState | null;
  /** 초기 복원 및 이후 편집 상태를 상위 일정 초안에 전달한다. 이동시간 조회 결과는 포함하지 않는다. */
  onEditorStateChange?: (state: RouteEditorState) => void;

  travelStartDate: string;

  tripDays: number;

  dailyStartMinutes: number;

  dailyEndMinutes: number;

  tempo: TravelTempo | null;

  isScheduleValid: boolean;

  currentLocation: RouteStartLocation | null;

  isRouteSaveInFlight: () => boolean;
};

function isSameStartLocation(
  left: RouteStartLocation | null,
  right: RouteStartLocation | null
) {
  if (!left || !right) {
    return left === right;
  }

  return left.lat === right.lat && left.lng === right.lng;
}

/**
 * 결과 편집 모델의 reducer·일정 계산을 연결하고 편집 이벤트와 저장 중 변경 차단을 담당한다.
 * draft의 이동시간은 별도 조회 Hook으로 보정하고, 적용 전 편집은 저장 입력에 반영하지 않는다.
 * 재진입 시 initialEditorState를 우선 복원하고 적용·미적용 상태가 바뀔 때 상위 초안에 전달한다.
 */
export function useRouteResultEditor({
  savedPlaces,
  initialRoutePlan = null,
  initialEditorState = null,
  onEditorStateChange,
  travelStartDate,
  tripDays,
  dailyStartMinutes,
  dailyEndMinutes,
  tempo,
  isScheduleValid,
  currentLocation,
  isRouteSaveInFlight,
}: UseRouteResultEditorParams) {
  const [editorState, dispatchEditor] = useReducer(routeEditorReducer, null, () =>
    createRouteEditorState(initialRoutePlan, initialEditorState)
  );
  useEffect(() => {
    onEditorStateChange?.(editorState);
  }, [editorState, onEditorStateChange]);
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
    return resolveRouteEditorSnapshot(
      {
        stayOverrides: draft.stayOverrides,
        manualInsertions: draft.manualInsertions,
        removedPlaceIds: draft.removedPlaceIds,
        routePlanOverride: draft.routePlanOverride,
      },
      {
        savedPlaces,
        travelStartDate,
        tripDays,
        dailyStartMinutes,
        dailyEndMinutes,
        tempo,
        isScheduleValid,
        currentLocation,
      }
    );
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
    return resolveRouteEditorSnapshot(
      {
        stayOverrides: applied.stayOverrides,
        manualInsertions: applied.manualInsertions,
        removedPlaceIds: applied.removedPlaceIds,
        routePlanOverride: applied.routePlanOverride,
      },
      {
        savedPlaces,
        travelStartDate,
        tripDays,
        dailyStartMinutes,
        dailyEndMinutes,
        tempo,
        isScheduleValid,
        currentLocation,
      }
    );
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
