import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { IoReorderThreeOutline } from "react-icons/io5";
import { routeApi } from "@/api/routeApi";
import { useRouteEditFlowStore } from "@/stores/routeEditFlowStore";
import { createPlaceDuplicateKeySet } from "@/lib/placeDuplicate";
import {
  getMapSheetPlaceStaySummaryKey,
  mapSheetPlaceToPlaceSnapshotInput,
  resolvePlaceStaySummaryForDisplay,
  type PlaceStaySummaryPreview,
} from "@/lib/routePlaceSnapshot";
import { useUiText } from "@/lib/uiText";
import { useRouteCheckout } from "../../hooks/useRouteCheckout";
import { useRouteCheckoutSave } from "../../hooks/useRouteCheckoutSave";
import PlaceCartRouteDayCard from "./PlaceCartRouteDayCard";
import StartLocationPickerPopup from "./StartLocationPickerPopup";
import { useRouteResultEditor } from "../../hooks/useRouteResultEditor";
import { formatRouteClock } from "../../models/routeDayCardModel";
import type { SavedPlaceItem } from "@/stores/placeCartStore";
import type { MapSheetPlace } from "@/types/place";
import type {
  PlannedRouteDay,
  RouteStartLocation,
} from "../../models/routePlanTypes";

type PlaceCartRouteResultStepProps = {
  savedPlaces: SavedPlaceItem[];
  candidatePlaces: MapSheetPlace[];
  initialRoutePlan?: PlannedRouteDay[] | null;
  currentLocation: RouteStartLocation | null;
  onClose: () => void;
  onClearPlaces: () => void;
  onRequestSearchPlace: () => void;
};

function isSameRouteDay(left: PlannedRouteDay, right: PlannedRouteDay) {
  if (
    left.startLocation?.lat !== right.startLocation?.lat ||
    left.startLocation?.lng !== right.startLocation?.lng ||
    left.items.length !== right.items.length
  ) {
    return false;
  }

  return left.items.every(
    (item, index) => item.place.id === right.items[index]?.place.id
  );
}

function PlaceCartRouteResultStep({
  savedPlaces,
  candidatePlaces,
  initialRoutePlan,
  currentLocation,
  onClose,
  onClearPlaces,
  onRequestSearchPlace,
}: PlaceCartRouteResultStepProps) {
  const text = useUiText();
  const appendTarget = useRouteEditFlowStore((state) => state.appendTarget);
  const {
    isSavingRoute,
    isRouteSaveInFlight,
    travelStartDate,
    tripDays,
    setStep,
    dailyStartMinutes,
    scheduleEndMinutes,
    tempo,
    isScheduleValid,
  } = useRouteCheckout();
  const {
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
  } = useRouteResultEditor({
    savedPlaces,
    initialRoutePlan,
    travelStartDate,
    tripDays,
    dailyStartMinutes,
    dailyEndMinutes: scheduleEndMinutes,
    tempo,
    isScheduleValid,
    currentLocation,
    isRouteSaveInFlight,
  });
  const [isOrderEditing, setIsOrderEditing] = useState(false);
  const [startLocationDayNumber, setStartLocationDayNumber] =
    useState<number | null>(null);
  const startLocationDay =
    routePlan.find((day) => day.day === startLocationDayNumber) ?? null;
  const pickerStartLocation =
    startLocationDay?.startLocation ??
    currentLocation ??
    startLocationDay?.items[0]?.place ??
    null;
  const hasOverSchedule = routePlan.some((day) =>
    day.items.some((item) => item.isOverSchedule)
  );
  const hasEditableRoute = routePlan.some((day) => day.items.length > 0);
  const isRouteOrderEditing = isOrderEditing && hasEditableRoute;
  const { handleSaveRoute } = useRouteCheckoutSave({
    input: {
      routePlan,
      travelStartDate,
      tripDays,
      dailyStartMinutes,
      scheduleEndMinutes,
      startLocation: currentLocation,
    },
    canSave: !isRouteTravelLoading && !isRouteOrderEditing && !isRouteEditDirty,
    onClose,
    onClearPlaces,
    onChooseDate: () => {
      setIsOrderEditing(false);
      setStep("schedule");
    },
  });
  const routePlanPlaces = useMemo(() => {
    const usedKeys = new Set<string>();

    return routePlan
      .flatMap((day) => day.items.map((item) => item.place))
      .filter((place) => {
        const key = getMapSheetPlaceStaySummaryKey(place);

        if (usedKeys.has(key)) {
          return false;
        }

        usedKeys.add(key);
        return true;
      });
  }, [routePlan]);
  const routePlanPlaceSummaryKey = routePlanPlaces
    .map(getMapSheetPlaceStaySummaryKey)
    .join("::");
  const placeStaySummariesQuery = useQuery({
    queryKey: ["checkout-place-stay-summaries", routePlanPlaceSummaryKey],
    enabled: routePlanPlaces.length > 0,
    queryFn: async () => {
      const result = await routeApi.placeStaySummaries(
        routePlanPlaces.map(mapSheetPlaceToPlaceSnapshotInput)
      );
      return result.placeStaySummaries;
    },
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
  });
  const placeStaySummaryByPlaceId = useMemo(() => {
    const summaryMap = new Map<string, PlaceStaySummaryPreview>();

    routePlanPlaces.forEach((place, index) => {
      const summary = resolvePlaceStaySummaryForDisplay(
        place,
        placeStaySummariesQuery.data?.[index]
      );

      if (summary) {
        summaryMap.set(place.id, summary);
      }
    });

    return summaryMap;
  }, [placeStaySummariesQuery.data, routePlanPlaces]);
  const excludedPlaceKeys = [
    ...createPlaceDuplicateKeySet(
      routePlan.flatMap((day) => day.items.map((item) => item.place))
    ),
  ];
  const getBaselineDay = (dayNumber: number) =>
    appliedRoutePlan.find((day) => day.day === dayNumber) ?? null;
  const startOrderEditing = () => {
    if (
      isRouteSaveInFlight() ||
      !hasEditableRoute ||
      isRouteTravelLoading ||
      isOrderEditing
    ) {
      return;
    }

    setIsOrderEditing(true);
  };
  const finishOrderEditing = () => {
    if (isRouteSaveInFlight() || !isOrderEditing) {
      return;
    }

    setIsOrderEditing(false);
  };
  const getComparisonDay = (day: PlannedRouteDay) => {
    const baselineDay = getBaselineDay(day.day);

    if (!baselineDay || isSameRouteDay(day, baselineDay)) {
      return null;
    }

    return baselineDay;
  };
  const handleReorderDayItems = (
    dayNumber: number,
    nextItems: PlannedRouteDay["items"]
  ) => {
    handleReorderRoutePlan(
      routePlan.map((day) =>
        day.day === dayNumber
          ? {
              ...day,
              items: nextItems,
            }
          : day
      )
    );
  };
  const handleMovePlaceToDay = (
    placeId: string,
    targetDayNumber: number,
    position: "first" | "last"
  ) => {
    const movedItem = routePlan
      .flatMap((day) => day.items)
      .find((item) => item.place.id === placeId);

    if (!movedItem) {
      return;
    }

    const nextRoutePlan = routePlan.map((day) => {
      const nextItems = day.items.filter((item) => item.place.id !== placeId);

      if (day.day !== targetDayNumber) {
        return {
          ...day,
          items: nextItems,
        };
      }

      return {
        ...day,
        items:
          position === "first"
            ? [movedItem, ...nextItems]
            : [...nextItems, movedItem],
      };
    });

    handleReorderRoutePlan(nextRoutePlan);
  };

  if (!tempo) {
    return null;
  }

  const handleApplyResultEdits = () => {
    if (isRouteSaveInFlight()) {
      return;
    }

    handleApplyRouteEdits();
    setIsOrderEditing(false);
  };

  const handleCancelResultEdits = () => {
    if (isRouteSaveInFlight()) {
      return;
    }

    handleCancelRouteEdits();
    setIsOrderEditing(false);
  };
  const handleOpenDayStartLocation = (dayNumber: number) => {
    if (isRouteSaveInFlight() || isRouteTravelLoading || !isRouteOrderEditing) {
      return;
    }
    setStartLocationDayNumber(dayNumber);
  };
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="route-checkout-step-enter space-y-4">
          <div>
            <div className="min-w-0">
              <p className="font-trip text-sm text-brand-700">ROUTE RESULT</p>
              {isRouteEditDirty ? (
                <span className="mt-1 inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                  {text.cart.editingBadge}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-xl font-semibold text-slate-900">
              {appendTarget ? text.cart.appendResultTitle : text.cart.resultTitle}
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              {appendTarget
                ? text.cart.appendResultDescription(appendTarget.routeTitle)
                : text.cart.resultDescription(
                    tempo === "relaxed"
                      ? text.cart.tempoRelaxedTitle
                      : tempo === "packed"
                        ? text.cart.tempoPackedTitle
                        : text.cart.tempoBalancedTitle
                  )}
            </p>
          </div>

          {!isRouteTravelLoading && hasOverSchedule ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
              {text.cart.overScheduleWarning(formatRouteClock(scheduleEndMinutes))}
            </div>
          ) : null}

          {!isRouteTravelLoading && hasRouteTravelFallback ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
              {text.cart.routeTravelFallbackWarning}
            </div>
          ) : null}

          <div className="space-y-4">
            {routePlan.map((day) => (
              <PlaceCartRouteDayCard
                key={day.day}
                day={day}
                routePlan={routePlan}
                isOrderEditing={isRouteOrderEditing}
                isTravelTimeEstimated={routeTravelFallbackDays.includes(day.day)}
                isTravelTimeLoading={routeTravelLoadingDays.includes(day.day)}
                comparisonDay={getComparisonDay(day)}
                candidatePlaces={candidatePlaces}
                excludedPlaceKeys={excludedPlaceKeys}
                placeStaySummaryByPlaceId={placeStaySummaryByPlaceId}
                onChangeStayMinutes={handleChangeStayMinutes}
                onChangeStartLocation={handleOpenDayStartLocation}
                onInsertPlace={handleInsertPlace}
                onRemovePlace={handleRemoveRoutePlace}
                onReorderDayItems={handleReorderDayItems}
                onMovePlaceToDay={handleMovePlaceToDay}
                onRequestSearchPlace={onRequestSearchPlace}
              />
            ))}
          </div>
        </div>
      </div>

      <footer className="app-safe-area-footer shrink-0 border-t border-brand-100 px-4 py-4">
        {isRouteOrderEditing ? (
          <button
            type="button"
            onClick={finishOrderEditing}
            className="w-full rounded-2xl bg-brand-600 px-4 py-3 text-sm font-bold text-white"
          >
            {text.cart.finishOrderEditing}
          </button>
        ) : isRouteEditDirty ? (
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={startOrderEditing}
              disabled={isSavingRoute || isRouteTravelLoading || !hasEditableRoute}
              className="inline-flex items-center justify-center gap-1 rounded-2xl border border-brand-200 bg-brand-50 px-2 py-3 text-xs font-bold text-brand-700 disabled:opacity-40"
            >
              <IoReorderThreeOutline className="text-base" />
              {text.cart.editOrder}
            </button>
            <button
              type="button"
              onClick={handleCancelResultEdits}
              disabled={isSavingRoute || isRouteTravelLoading}
              className="rounded-2xl border border-slate-200 bg-white px-2 py-3 text-xs font-bold text-slate-600 disabled:opacity-40"
            >
              {text.cart.cancelChanges}
            </button>
            <button
              type="button"
              onClick={handleApplyResultEdits}
              disabled={isSavingRoute || isRouteTravelLoading}
              className="rounded-2xl bg-brand-600 px-2 py-3 text-xs font-bold text-white disabled:opacity-40"
            >
              {text.cart.applyChanges}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={startOrderEditing}
              disabled={isSavingRoute || isRouteTravelLoading || !hasEditableRoute}
              className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-brand-200 bg-brand-50 px-3 py-3 text-sm font-bold text-brand-700 disabled:opacity-40"
            >
              <IoReorderThreeOutline className="text-lg" />
              {text.cart.editOrder}
            </button>
            <button
              type="button"
              onClick={handleSaveRoute}
              disabled={
                isSavingRoute || isRouteTravelLoading || !hasEditableRoute
              }
              className="rounded-2xl bg-brand-600 px-3 py-3 text-sm font-bold text-white disabled:opacity-40"
            >
              {isSavingRoute
                ? text.cart.saving
                : isRouteTravelLoading
                  ? text.dayRoute.routeCalculating
                  : appendTarget
                    ? text.cart.addDay
                    : text.cart.done}
            </button>
          </div>
        )}
      </footer>

      {startLocationDay && pickerStartLocation ? (
        <StartLocationPickerPopup
          key={startLocationDay.day}
          title={text.cart.dayStartLocationTitle(startLocationDay.day)}
          routePlan={[startLocationDay]}
          initialLocation={pickerStartLocation}
          onClose={() => {
            if (!isRouteSaveInFlight()) setStartLocationDayNumber(null);
          }}
          onApply={(location) => {
            if (isRouteSaveInFlight()) return false;
            handleChangeDayStartLocation(startLocationDay.day, location);
          }}
        />
      ) : null}
    </div>
  );
}

export default PlaceCartRouteResultStep;
