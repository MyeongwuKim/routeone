import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { IoLocationSharp } from "react-icons/io5";
import {
  getEffectiveRoutePlanTripDays,
  routeCheckoutApi,
} from "@/api/routeCheckoutApi";
import { routeApi } from "@/api/routeApi";
import {
  MY_ROUTES_QUERY_KEY,
  upsertMyRouteCache,
} from "@/features/my-route/myRouteCache";
import { useUiToastStore } from "@/stores/uiToastStore";
import { useUiModalStore } from "@/stores/uiModalStore";
import { useRouteEditFlowStore } from "@/stores/routeEditFlowStore";
import { createPlaceDuplicateKeySet } from "@/lib/placeDuplicate";
import {
  getMapSheetPlaceStaySummaryKey,
  mapSheetPlaceToPlaceSnapshotInput,
  resolvePlaceStaySummaryForDisplay,
  type PlaceStaySummaryPreview,
} from "@/lib/routePlaceSnapshot";
import { useUiText, type UiText } from "@/lib/uiText";
import { useRouteCheckout } from "../../hooks/useRouteCheckout";
import PlaceCartRouteDayCard from "./PlaceCartRouteDayCard";
import StartLocationPickerPopup from "./StartLocationPickerPopup";
import { useRouteResultEditor } from "../../hooks/useRouteResultEditor";
import { findRouteDateConflict } from "../../utils/routeDateConflict";
import type { SavedPlaceItem } from "@/stores/placeCartStore";
import type { MapSheetPlace } from "@/types/place";
import type { MyRoutesQuery } from "@/generated/graphql";
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

function formatClock(totalMinutes: number) {
  const normalizedMinutes = Math.max(0, Math.round(totalMinutes));
  const hour = Math.floor(normalizedMinutes / 60);
  const minute = normalizedMinutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function formatDurationText(totalMinutes: number, text: UiText) {
  const normalizedMinutes = Math.max(0, Math.round(totalMinutes));

  if (normalizedMinutes < 60) {
    return text.dayRoute.minutes(normalizedMinutes);
  }

  const hour = Math.floor(normalizedMinutes / 60);
  const minute = normalizedMinutes % 60;
  return minute > 0
    ? text.dayRoute.hoursMinutes(hour, minute)
    : text.dayRoute.hours(hour);
}

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

function getRouteSaveErrorMessage(error: unknown, text: UiText) {
  return error instanceof Error
    ? error.message
    : text.cart.saveRouteFallbackError;
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const showToast = useUiToastStore((state) => state.showToast);
  const openModal = useUiModalStore((state) => state.openModal);
  const appendTarget = useRouteEditFlowStore((state) => state.appendTarget);
  const clearAppendTarget = useRouteEditFlowStore(
    (state) => state.clearAppendTarget
  );
  const {
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
    startLocation,
    isRouteEditDirty,
    handleChangeStayMinutes,
    handleChangeStartLocation,
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
  });
  const [isOrderEditing, setIsOrderEditing] = useState(false);
  const [isSavingRoute, setIsSavingRoute] = useState(false);
  const [isStartLocationPickerOpen, setIsStartLocationPickerOpen] =
    useState(false);
  const hasOverSchedule = routePlan.some((day) =>
    day.items.some((item) => item.isOverSchedule)
  );
  const hasEditableRoute = routePlan.some((day) => day.items.length > 0);
  const firstRouteItem =
    routePlan.find((day) => day.items.length > 0)?.items[0] ?? null;
  const firstTravelMinutes = firstRouteItem?.travelMinutesFromPrevious ?? null;
  const isRouteOrderEditing = isOrderEditing && hasEditableRoute;
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
    if (!hasEditableRoute || isOrderEditing) {
      return;
    }

    setIsOrderEditing(true);
  };
  const finishOrderEditing = () => {
    if (!isOrderEditing) {
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
    handleApplyRouteEdits();
    setIsOrderEditing(false);
  };

  const handleCancelResultEdits = () => {
    handleCancelRouteEdits();
    setIsOrderEditing(false);
  };
  const handleSaveRoute = async () => {
    if (isSavingRoute) {
      return;
    }

    if (!hasEditableRoute) {
      showToast(text.cart.noPlacesToSaveToast);
      return;
    }

    setIsSavingRoute(true);

    try {
      const routesData =
        queryClient.getQueryData<MyRoutesQuery>(MY_ROUTES_QUERY_KEY) ??
        (await queryClient.fetchQuery<MyRoutesQuery>({
          queryKey: MY_ROUTES_QUERY_KEY,
          queryFn: () => routeApi.myRoutes(),
        }));
      const effectiveTripDays = getEffectiveRoutePlanTripDays(routePlan);
      const conflict = findRouteDateConflict({
        routes: routesData.myRoutes,
        travelStartDate,
        tripDays: effectiveTripDays,
        excludeRouteId: appendTarget?.routeId,
      });

      if (conflict) {
        openModal({
          title: text.cart.dateConflictTitle,
          description: text.cart.dateConflictDescription(
            conflict.requestedRangeLabel,
            conflict.existingRangeLabel
          ),
          detail: text.cart.dateConflictDetail,
          actions: [
            {
              label: text.cart.viewMyRoutes,
              variant: "secondary",
              onClick: () => {
                onClose();
                navigate("/my-route");
              },
            },
            {
              label: text.cart.chooseDateAgain,
              variant: "primary",
              onClick: () => {
                setStep("schedule");
              },
            },
          ],
        });
        setIsSavingRoute(false);
        return;
      }

      if (appendTarget) {
        const route = await routeCheckoutApi.appendRouteDays(appendTarget.routeId, {
          routePlan,
          travelStartDate,
          tripDays,
          dailyStartMinutes,
          scheduleEndMinutes,
          startLocation,
        });
        queryClient.setQueryData<MyRoutesQuery>(
          MY_ROUTES_QUERY_KEY,
          (currentData) => upsertMyRouteCache(currentData, route.appendRouteDays)
        );
      } else {
        const route = await routeCheckoutApi.saveRoutePlan({
          routePlan,
          travelStartDate,
          tripDays,
          dailyStartMinutes,
          scheduleEndMinutes,
          startLocation,
        });
        queryClient.setQueryData<MyRoutesQuery>(
          MY_ROUTES_QUERY_KEY,
          (currentData) => upsertMyRouteCache(currentData, route.createRoute)
        );

        showToast(text.cart.routeSavedToast(route.createRoute.totalStopCount));
      }

      if (appendTarget) {
        showToast(text.cart.appendDaySavedToast(appendTarget.routeTitle));
      }
      clearAppendTarget();
      onClearPlaces();
      onClose();
    } catch (error) {
      showToast(getRouteSaveErrorMessage(error, text), 2600);
      setIsSavingRoute(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="route-checkout-step-enter space-y-4">
          <div>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-trip text-sm text-brand-700">ROUTE RESULT</p>
                {isRouteEditDirty ? (
                  <span className="mt-1 inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                    {text.cart.editingBadge}
                  </span>
                ) : null}
              </div>
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

          {hasOverSchedule ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
              {text.cart.overScheduleWarning(formatClock(scheduleEndMinutes))}
            </div>
          ) : null}

          <div className="space-y-4">
            {startLocation ? (
              <section className="rounded-2xl border border-brand-100 bg-white px-4 py-3 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1 text-xs font-black text-brand-700">
                      <IoLocationSharp className="text-sm" />
                      {text.cart.startLocationLabel}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold leading-5 text-slate-500">
                      {firstTravelMinutes != null && firstTravelMinutes >= 60
                        ? text.cart.firstPlaceTravelWarning(
                            formatDurationText(firstTravelMinutes, text)
                          )
                        : text.cart.startLocationRecalculateDescription}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsStartLocationPickerOpen(true)}
                    className="shrink-0 rounded-full border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-bold text-brand-700"
                  >
                    {text.cart.changeOnMap}
                  </button>
                </div>
              </section>
            ) : null}

            {routePlan.map((day) => (
              <PlaceCartRouteDayCard
                key={day.day}
                day={day}
                routePlan={routePlan}
                isOrderEditing={isRouteOrderEditing}
                comparisonDay={getComparisonDay(day)}
                candidatePlaces={candidatePlaces}
                excludedPlaceKeys={excludedPlaceKeys}
                placeStaySummaryByPlaceId={placeStaySummaryByPlaceId}
                onChangeStayMinutes={handleChangeStayMinutes}
                onInsertPlace={handleInsertPlace}
                onRemovePlace={handleRemoveRoutePlace}
                onReorderDayItems={handleReorderDayItems}
                onMovePlaceToDay={handleMovePlaceToDay}
                onRequestOrderEditing={startOrderEditing}
                onFinishOrderEditing={finishOrderEditing}
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
            disabled
            className="w-full rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm font-bold text-brand-700 opacity-80"
          >
            {text.cart.finishOrderEditing}
          </button>
        ) : isRouteEditDirty ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleCancelResultEdits}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600"
            >
              {text.cart.cancelChanges}
            </button>
            <button
              type="button"
              onClick={handleApplyResultEdits}
              className="rounded-2xl bg-brand-600 px-4 py-3 text-sm font-bold text-white"
            >
              {text.cart.applyChanges}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleSaveRoute}
            disabled={isSavingRoute || !hasEditableRoute}
            className="w-full rounded-2xl bg-brand-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-40"
          >
            {isSavingRoute
              ? text.cart.saving
              : appendTarget
                ? text.cart.addDay
                : text.cart.done}
          </button>
        )}
      </footer>

      {isStartLocationPickerOpen && startLocation ? (
        <StartLocationPickerPopup
          routePlan={routePlan}
          initialLocation={startLocation}
          onClose={() => setIsStartLocationPickerOpen(false)}
          onApply={handleChangeStartLocation}
        />
      ) : null}
    </div>
  );
}

export default PlaceCartRouteResultStep;
