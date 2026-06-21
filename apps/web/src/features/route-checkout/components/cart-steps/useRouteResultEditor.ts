import { useMemo, useState } from "react";
import type { SavedPlaceItem } from "@/stores/placeCartStore";
import type { MapSheetPlace } from "@/types/place";
import type { TravelTempo } from "./PlaceCartTempoStep";
import { isSamePlaceDuplicate } from "@/lib/placeDuplicate";
import {
  buildRoutePlan,
  getRecommendedStayMinutes,
  recalculateRouteDay,
  recalculateRoutePlanDays,
} from "./routePlanBuilder";
import type {
  ManualRouteInsertion,
  PlannedRouteDay,
  RouteInsertRequest,
  RouteStartLocation,
} from "./routePlanTypes";

type UseRouteResultEditorParams = {
  savedPlaces: SavedPlaceItem[];
  travelStartDate: string;
  tripDays: number;
  dailyStartMinutes: number;
  dailyEndMinutes: number;
  tempo: TravelTempo | null;
  isScheduleValid: boolean;
  currentLocation: RouteStartLocation | null;
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
  travelStartDate,
  tripDays,
  dailyStartMinutes,
  dailyEndMinutes,
  tempo,
  isScheduleValid,
  currentLocation,
}: UseRouteResultEditorParams) {
  const [appliedStayOverrides, setAppliedStayOverrides] = useState<
    Record<string, number>
  >({});
  const [draftStayOverrides, setDraftStayOverrides] = useState<
    Record<string, number>
  >({});
  const [appliedManualInsertions, setAppliedManualInsertions] = useState<
    ManualRouteInsertion[]
  >([]);
  const [draftManualInsertions, setDraftManualInsertions] = useState<
    ManualRouteInsertion[]
  >([]);
  const [appliedRemovedPlaceIds, setAppliedRemovedPlaceIds] = useState<string[]>(
    []
  );
  const [draftRemovedPlaceIds, setDraftRemovedPlaceIds] = useState<string[]>([]);
  const [appliedRoutePlanOverride, setAppliedRoutePlanOverride] = useState<
    PlannedRouteDay[] | null
  >(null);
  const [draftRoutePlanOverride, setDraftRoutePlanOverride] = useState<
    PlannedRouteDay[] | null
  >(null);
  const [appliedStartLocation, setAppliedStartLocation] =
    useState<RouteStartLocation | null>(currentLocation);
  const [draftStartLocation, setDraftStartLocation] =
    useState<RouteStartLocation | null>(currentLocation);
  const resolvedAppliedStartLocation = appliedStartLocation ?? currentLocation;
  const resolvedDraftStartLocation = draftStartLocation ?? currentLocation;

  const isRouteEditDirty = useMemo(
    () =>
      JSON.stringify(draftStayOverrides) !==
        JSON.stringify(appliedStayOverrides) ||
      JSON.stringify(draftManualInsertions) !==
        JSON.stringify(appliedManualInsertions) ||
      JSON.stringify([...draftRemovedPlaceIds].sort()) !==
        JSON.stringify([...appliedRemovedPlaceIds].sort()) ||
      JSON.stringify(draftRoutePlanOverride) !==
        JSON.stringify(appliedRoutePlanOverride) ||
      !isSameStartLocation(
        resolvedDraftStartLocation,
        resolvedAppliedStartLocation
      ),
    [
      appliedManualInsertions,
      appliedRemovedPlaceIds,
      appliedRoutePlanOverride,
      resolvedAppliedStartLocation,
      appliedStayOverrides,
      draftManualInsertions,
      draftRemovedPlaceIds,
      draftRoutePlanOverride,
      resolvedDraftStartLocation,
      draftStayOverrides,
    ]
  );

  const routePlan = useMemo(() => {
    if (!tempo || !isScheduleValid) {
      return [];
    }

    const removedPlaceIdSet = new Set(draftRemovedPlaceIds);
    const baseRoutePlan = buildRoutePlan({
      savedPlaces: savedPlaces.filter(
        (item) => !removedPlaceIdSet.has(item.place.id)
      ),
      travelStartDate,
      tripDays,
      dailyStartMinutes,
      dailyEndMinutes,
      tempo,
      stayOverrides: draftStayOverrides,
      currentLocation: resolvedDraftStartLocation,
    });

    const routePlanWithInsertions = applyManualRouteInsertions({
      routePlan: baseRoutePlan,
      insertions: draftManualInsertions,
      dailyStartMinutes,
      dailyEndMinutes,
      tempo,
      stayOverrides: draftStayOverrides,
      currentLocation: resolvedDraftStartLocation,
    });

    if (!draftRoutePlanOverride) {
      return routePlanWithInsertions;
    }

    return recalculateRoutePlanDays({
      routePlan: draftRoutePlanOverride,
      dailyStartMinutes,
      dailyEndMinutes,
      tempo,
      stayOverrides: draftStayOverrides,
      currentLocation: resolvedDraftStartLocation,
    });
  }, [
    dailyEndMinutes,
    dailyStartMinutes,
    draftManualInsertions,
    draftRemovedPlaceIds,
    draftRoutePlanOverride,
    resolvedDraftStartLocation,
    draftStayOverrides,
    isScheduleValid,
    savedPlaces,
    tempo,
    travelStartDate,
    tripDays,
  ]);

  const appliedRoutePlan = useMemo(() => {
    if (!tempo || !isScheduleValid) {
      return [];
    }

    const removedPlaceIdSet = new Set(appliedRemovedPlaceIds);
    const baseRoutePlan = buildRoutePlan({
      savedPlaces: savedPlaces.filter(
        (item) => !removedPlaceIdSet.has(item.place.id)
      ),
      travelStartDate,
      tripDays,
      dailyStartMinutes,
      dailyEndMinutes,
      tempo,
      stayOverrides: appliedStayOverrides,
      currentLocation: resolvedAppliedStartLocation,
    });

    const routePlanWithInsertions = applyManualRouteInsertions({
      routePlan: baseRoutePlan,
      insertions: appliedManualInsertions,
      dailyStartMinutes,
      dailyEndMinutes,
      tempo,
      stayOverrides: appliedStayOverrides,
      currentLocation: resolvedAppliedStartLocation,
    });

    if (!appliedRoutePlanOverride) {
      return routePlanWithInsertions;
    }

    return recalculateRoutePlanDays({
      routePlan: appliedRoutePlanOverride,
      dailyStartMinutes,
      dailyEndMinutes,
      tempo,
      stayOverrides: appliedStayOverrides,
      currentLocation: resolvedAppliedStartLocation,
    });
  }, [
    appliedManualInsertions,
    appliedRemovedPlaceIds,
    appliedRoutePlanOverride,
    appliedStayOverrides,
    dailyEndMinutes,
    dailyStartMinutes,
    isScheduleValid,
    resolvedAppliedStartLocation,
    savedPlaces,
    tempo,
    travelStartDate,
    tripDays,
  ]);

  const handleChangeStayMinutes = (placeId: string, minutes: number) => {
    setDraftStayOverrides((previous) => ({
      ...previous,
      [placeId]: minutes,
    }));
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
        stayMinutes: draftStayOverrides[place.id] ?? recommendedStayMinutes,
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

    setDraftRoutePlanOverride(nextRoutePlan);
    setDraftManualInsertions([]);
    setDraftRemovedPlaceIds((previous) =>
      previous.filter((placeId) => placeId !== place.id)
    );
  };

  const handleRemoveRoutePlace = (placeId: string) => {
    if (routePlan.length > 0) {
      setDraftRoutePlanOverride(
        routePlan.map((day) => ({
          ...day,
          items: day.items.filter((item) => item.place.id !== placeId),
        }))
      );
      setDraftManualInsertions([]);
      setDraftRemovedPlaceIds([]);
    } else {
      setDraftRemovedPlaceIds((previous) =>
        previous.includes(placeId) ? previous : [...previous, placeId]
      );
    }

    setDraftManualInsertions((previous) =>
      previous.filter((insertion) => insertion.place.id !== placeId)
    );
    setDraftStayOverrides((previous) => {
      const nextOverrides = { ...previous };
      delete nextOverrides[placeId];
      return nextOverrides;
    });
  };

  const handleReorderRoutePlan = (nextRoutePlan: PlannedRouteDay[]) => {
    setDraftRoutePlanOverride(nextRoutePlan);
    setDraftManualInsertions([]);
    setDraftRemovedPlaceIds([]);
  };

  const handleChangeStartLocation = (location: RouteStartLocation) => {
    setDraftStartLocation(location);
  };

  const handleApplyRouteEdits = () => {
    setAppliedStayOverrides(draftStayOverrides);
    setAppliedManualInsertions(draftManualInsertions);
    setAppliedRemovedPlaceIds(draftRemovedPlaceIds);
    setAppliedRoutePlanOverride(draftRoutePlanOverride);
    setAppliedStartLocation(draftStartLocation);
  };

  const handleCancelRouteEdits = () => {
    setDraftStayOverrides(appliedStayOverrides);
    setDraftManualInsertions(appliedManualInsertions);
    setDraftRemovedPlaceIds(appliedRemovedPlaceIds);
    setDraftRoutePlanOverride(appliedRoutePlanOverride);
    setDraftStartLocation(appliedStartLocation);
  };

  return {
    routePlan,
    appliedRoutePlan,
    startLocation: resolvedDraftStartLocation,
    isRouteEditDirty,
    handleChangeStayMinutes,
    handleChangeStartLocation,
    handleInsertPlace,
    handleRemoveRoutePlace,
    handleReorderRoutePlan,
    handleApplyRouteEdits,
    handleCancelRouteEdits,
  };
}
