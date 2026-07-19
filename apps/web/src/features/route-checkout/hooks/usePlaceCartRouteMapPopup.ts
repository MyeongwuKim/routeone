import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { useUiText } from "@/lib/uiText";
import {
  EMPTY_COMPLETED_ITEM_IDS,
  EMPTY_DAY_OPTIONS,
  buildFallbackRouteSegments,
  buildRouteMapPoints,
  createInitialRouteMapViewState,
  createStartPreviewDay,
  formatRouteMapDate,
  getInitialStartPreviewLocation,
  getRouteDayKey,
  getRouteSegmentDisplayColor,
  routeMapViewReducer,
  type RouteDisplayVariant,
  type RouteMapDayOption,
  type RouteMapPoint,
  type RouteMapSegment,
  type RouteMapViewMode,
  type StartPreviewMode,
} from "../models/routeMapModel";
import type {
  PlannedRouteDay,
  RouteStartLocation,
} from "../models/routePlanTypes";
import { useRouteMapRenderer } from "./useRouteMapRenderer";
import { useRouteMapSegments } from "./useRouteMapSegments";

type UsePlaceCartRouteMapPopupOptions = {
  day: PlannedRouteDay;
  comparisonDay?: PlannedRouteDay | null;
  completedItemIds?: string[];
  dayOptions?: RouteMapDayOption[];
  initialDayOptionId?: string;
  enableStartPreview?: boolean;
  onRequestCheckout?: (routePlan: PlannedRouteDay[]) => void;
  onClose: () => void;
};

export type RoutePointGroup = {
  key: RouteDisplayVariant;
  label: string;
  points: RouteMapPoint[];
  segments: RouteMapSegment[];
};

export type SelectedRouteSegmentView = {
  segment: RouteMapSegment;
  color: string;
} | null;

function countRoutePlaces(routePlan: PlannedRouteDay[]) {
  return routePlan.reduce(
    (totalCount, routeDay) => totalCount + routeDay.items.length,
    0
  );
}

function serializeRoutePoint(point: RouteMapPoint) {
  return `${point.id}:${point.lat.toFixed(6)},${point.lng.toFixed(6)}`;
}

export function usePlaceCartRouteMapPopup({
  day,
  comparisonDay,
  completedItemIds = EMPTY_COMPLETED_ITEM_IDS,
  dayOptions = EMPTY_DAY_OPTIONS,
  initialDayOptionId,
  enableStartPreview = false,
  onRequestCheckout,
  onClose,
}: UsePlaceCartRouteMapPopupOptions) {
  const text = useUiText();
  const [startPreviewDraftByDayKey, setStartPreviewDraftByDayKey] = useState<
    Record<string, RouteStartLocation>
  >({});
  const [startPreviewModeByDayKey, setStartPreviewModeByDayKey] = useState<
    Record<string, StartPreviewMode>
  >({});
  const [routeMapViewState, dispatchRouteMapView] = useReducer(
    routeMapViewReducer,
    { initialDayOptionId, dayOptions },
    createInitialRouteMapViewState
  );
  const [isCheckoutScopeOpen, setIsCheckoutScopeOpen] = useState(false);
  const [selectedCheckoutDayIds, setSelectedCheckoutDayIds] = useState<
    string[]
  >([]);
  const { selectedDayOptionId, selectedSegment, routeViewMode } =
    routeMapViewState;

  const selectedDayOption = useMemo(
    () =>
      selectedDayOptionId
        ? dayOptions.find((option) => option.id === selectedDayOptionId) ?? null
        : null,
    [dayOptions, selectedDayOptionId]
  );
  const displayDay = selectedDayOption?.day ?? day;
  const displayCompletedItemIds =
    selectedDayOption?.completedItemIds ?? completedItemIds;
  const displayDayKey = useMemo(() => getRouteDayKey(displayDay), [displayDay]);
  const initialStartPreviewLocation = useMemo(
    () =>
      enableStartPreview ? getInitialStartPreviewLocation(displayDay) : null,
    [displayDay, enableStartPreview]
  );
  const changedStartPreviewLocation = enableStartPreview
    ? (startPreviewDraftByDayKey[displayDayKey] ?? null)
    : null;
  const isStartPreviewDirty =
    enableStartPreview && Boolean(changedStartPreviewLocation);
  const startPreviewMode = isStartPreviewDirty
    ? (startPreviewModeByDayKey[displayDayKey] ?? "changed")
    : "changed";
  const previewStartLocation = enableStartPreview
    ? startPreviewMode === "original"
      ? initialStartPreviewLocation
      : (changedStartPreviewLocation ?? initialStartPreviewLocation)
    : initialStartPreviewLocation;

  const createStartPreviewRouteDay = useCallback(
    (routeDay: PlannedRouteDay) => {
      const routeDayKey = getRouteDayKey(routeDay);
      const initialLocation = getInitialStartPreviewLocation(routeDay);
      const changedLocation = enableStartPreview
        ? (startPreviewDraftByDayKey[routeDayKey] ?? null)
        : null;
      const isDirty = enableStartPreview && Boolean(changedLocation);
      const mode = isDirty
        ? (startPreviewModeByDayKey[routeDayKey] ?? "changed")
        : "changed";
      const startLocation = enableStartPreview
        ? mode === "original"
          ? initialLocation
          : (changedLocation ?? initialLocation)
        : initialLocation;

      return enableStartPreview && startLocation
        ? createStartPreviewDay({
            day: routeDay,
            startLocation,
            shouldReorder: isDirty && mode === "changed",
          })
        : routeDay;
    },
    [
      enableStartPreview,
      startPreviewDraftByDayKey,
      startPreviewModeByDayKey,
    ]
  );
  const displayRouteDay = useMemo(
    () =>
      enableStartPreview && previewStartLocation
        ? createStartPreviewRouteDay(displayDay)
        : displayDay,
    [
      createStartPreviewRouteDay,
      displayDay,
      enableStartPreview,
      previewStartLocation,
    ]
  );
  const checkoutDayOptions = useMemo(() => {
    const routeDayOptions =
      dayOptions.length > 0
        ? dayOptions
        : [
            {
              id: displayDayKey,
              label: `DAY ${displayDay.day}`,
              summary: displayDay.date
                ? formatRouteMapDate(displayDay.date)
                : text.dayRoute.placeCount(displayDay.items.length),
              day: displayDay,
            },
          ];

    return routeDayOptions
      .map((option) => ({
        id: option.id,
        label: option.label,
        summary: option.summary,
        day: createStartPreviewRouteDay(option.day),
      }))
      .filter((option) => option.day.items.length > 0);
  }, [createStartPreviewRouteDay, dayOptions, displayDay, displayDayKey, text]);
  const checkoutRoutePlan = useMemo(
    () => checkoutDayOptions.map((option) => option.day),
    [checkoutDayOptions]
  );
  const checkoutPlaceCount = useMemo(
    () => countRoutePlaces(checkoutRoutePlan),
    [checkoutRoutePlan]
  );
  const selectedCheckoutDayIdSet = useMemo(
    () => new Set(selectedCheckoutDayIds),
    [selectedCheckoutDayIds]
  );
  const selectedCheckoutDayOptions = useMemo(
    () =>
      checkoutDayOptions.filter((option) =>
        selectedCheckoutDayIdSet.has(option.id)
      ),
    [checkoutDayOptions, selectedCheckoutDayIdSet]
  );
  const selectedCheckoutRoutePlan = useMemo(
    () => selectedCheckoutDayOptions.map((option) => option.day),
    [selectedCheckoutDayOptions]
  );
  const selectedCheckoutPlaceCount = useMemo(
    () => countRoutePlaces(selectedCheckoutRoutePlan),
    [selectedCheckoutRoutePlan]
  );
  const isAllCheckoutDaysSelected =
    checkoutDayOptions.length > 0 &&
    checkoutDayOptions.every((option) =>
      selectedCheckoutDayIdSet.has(option.id)
    );

  const displayComparisonDay = selectedDayOption?.comparisonDay ?? comparisonDay;
  const completedItemIdSet = useMemo(
    () => new Set(displayCompletedItemIds),
    [displayCompletedItemIds]
  );
  const routePoints = useMemo(
    () => buildRouteMapPoints(displayRouteDay, completedItemIdSet, text),
    [completedItemIdSet, displayRouteDay, text]
  );
  const comparisonRoutePoints = useMemo(
    () =>
      displayComparisonDay
        ? buildRouteMapPoints(displayComparisonDay, completedItemIdSet, text)
        : [],
    [displayComparisonDay, completedItemIdSet, text]
  );
  const fallbackSegments = useMemo(
    () => buildFallbackRouteSegments(routePoints),
    [routePoints]
  );
  const comparisonFallbackSegments = useMemo(
    () => buildFallbackRouteSegments(comparisonRoutePoints),
    [comparisonRoutePoints]
  );
  const {
    comparisonRouteSegments,
    isRouteLoading,
    routeError: routeSegmentError,
    routeSegments,
  } = useRouteMapSegments({
    routePoints,
    comparisonRoutePoints,
    fallbackSegments,
    comparisonFallbackSegments,
  });
  const hasComparisonRoute = Boolean(
    displayComparisonDay && comparisonRoutePoints.length > 1
  );
  const hasDaySelector = dayOptions.length > 1;
  const canResetStartPreview =
    enableStartPreview && Boolean(initialStartPreviewLocation);
  const shouldShowComparisonRoute =
    hasComparisonRoute && routeViewMode !== "current";
  const shouldShowCurrentRoute =
    !hasComparisonRoute || routeViewMode !== "comparison";
  const visibleRoutePointGroups = useMemo(() => {
    const groups: RoutePointGroup[] = [];

    if (shouldShowComparisonRoute) {
      groups.push({
        key: "comparison",
        label: text.cart.routeOriginal,
        points: comparisonRoutePoints,
        segments: comparisonRouteSegments,
      });
    }

    if (shouldShowCurrentRoute) {
      groups.push({
        key: "current",
        label: text.cart.routeCurrent,
        points: routePoints,
        segments: routeSegments,
      });
    }

    return groups;
  }, [
    comparisonRoutePoints,
    comparisonRouteSegments,
    routePoints,
    routeSegments,
    shouldShowComparisonRoute,
    shouldShowCurrentRoute,
    text,
  ]);
  const mapAutoFitKey = useMemo(
    () =>
      [
        displayDayKey,
        routeViewMode,
        shouldShowComparisonRoute ? "comparison" : "",
        shouldShowCurrentRoute ? "current" : "",
        routePoints.map(serializeRoutePoint).join("|"),
        comparisonRoutePoints.map(serializeRoutePoint).join("|"),
      ].join("::"),
    [
      comparisonRoutePoints,
      displayDayKey,
      routePoints,
      routeViewMode,
      shouldShowComparisonRoute,
      shouldShowCurrentRoute,
    ]
  );
  const selectedRouteSegmentView = useMemo<SelectedRouteSegmentView>(() => {
    if (!selectedSegment) {
      return null;
    }

    const group = visibleRoutePointGroups.find(
      (routeGroup) => routeGroup.key === selectedSegment.variant
    );
    if (!group) {
      return null;
    }

    const segmentIndex = group.segments.findIndex(
      (segment) => segment.id === selectedSegment.segmentId
    );
    if (segmentIndex < 0) {
      return null;
    }

    return {
      segment: group.segments[segmentIndex],
      color: getRouteSegmentDisplayColor({
        index: segmentIndex,
        variant: group.key,
        hasComparisonRoute,
        routeViewMode,
      }),
    };
  }, [
    hasComparisonRoute,
    routeViewMode,
    selectedSegment,
    visibleRoutePointGroups,
  ]);

  const clearSelectedSegment = useCallback(() => {
    dispatchRouteMapView({ type: "clear-selected-segment" });
  }, []);
  const focusRouteSegment = useCallback(
    (
      variant: RouteDisplayVariant,
      segment: RouteMapSegment,
      isAlreadySelected: boolean
    ) => {
      if (isAlreadySelected) {
        clearSelectedSegment();
        return;
      }

      dispatchRouteMapView({
        type: "select-segment",
        segment: {
          variant,
          segmentId: segment.id,
        },
      });
    },
    [clearSelectedSegment]
  );
  const moveStartPreviewTo = useCallback(
    (location: RouteStartLocation) => {
      setStartPreviewDraftByDayKey((currentDrafts) => ({
        ...currentDrafts,
        [displayDayKey]: location,
      }));
      setStartPreviewModeByDayKey((currentModes) => ({
        ...currentModes,
        [displayDayKey]: "changed",
      }));
      clearSelectedSegment();
    },
    [clearSelectedSegment, displayDayKey]
  );
  const { isSdkReady, mapError, mapRef } = useRouteMapRenderer({
    comparisonRoutePoints,
    comparisonRouteSegments,
    displayDayKey,
    enableStartPreview,
    hasComparisonRoute,
    hasDaySelector,
    isStartPreviewDirty,
    mapAutoFitKey,
    moveStartPreviewTo,
    routePoints,
    routeSegments,
    routeViewMode,
    selectedSegment,
    selectedRouteSegmentView,
    shouldShowComparisonRoute,
    shouldShowCurrentRoute,
  });
  const routeError = mapError ?? routeSegmentError;

  const selectDayOption = useCallback((dayOptionId: string) => {
    dispatchRouteMapView({ type: "select-day-option", dayOptionId });
  }, []);
  const setRouteViewMode = useCallback((nextMode: RouteMapViewMode) => {
    dispatchRouteMapView({
      type: "set-route-view-mode",
      routeViewMode: nextMode,
    });
  }, []);
  const setStartPreviewMode = useCallback(
    (mode: StartPreviewMode) => {
      setStartPreviewModeByDayKey((currentModes) => ({
        ...currentModes,
        [displayDayKey]: mode,
      }));
      clearSelectedSegment();
    },
    [clearSelectedSegment, displayDayKey]
  );
  const resetStartPreview = useCallback(() => {
    setStartPreviewDraftByDayKey((currentDrafts) => {
      const nextDrafts = { ...currentDrafts };
      delete nextDrafts[displayDayKey];
      return nextDrafts;
    });
    setStartPreviewModeByDayKey((currentModes) => {
      const nextModes = { ...currentModes };
      delete nextModes[displayDayKey];
      return nextModes;
    });
    clearSelectedSegment();
  }, [clearSelectedSegment, displayDayKey]);
  const closeCheckoutScope = useCallback(() => {
    setIsCheckoutScopeOpen(false);
  }, []);
  const requestCheckout = useCallback(
    (routePlan: PlannedRouteDay[]) => {
      if (routePlan.length === 0) {
        return;
      }

      closeCheckoutScope();
      onRequestCheckout?.(routePlan);
    },
    [closeCheckoutScope, onRequestCheckout]
  );
  const confirmCheckout = useCallback(() => {
    requestCheckout(selectedCheckoutRoutePlan);
  }, [requestCheckout, selectedCheckoutRoutePlan]);
  const toggleCheckoutDay = useCallback((dayId: string) => {
    setSelectedCheckoutDayIds((currentDayIds) =>
      currentDayIds.includes(dayId)
        ? currentDayIds.filter((currentDayId) => currentDayId !== dayId)
        : [...currentDayIds, dayId]
    );
  }, []);
  const toggleAllCheckoutDays = useCallback(() => {
    setSelectedCheckoutDayIds((currentDayIds) =>
      checkoutDayOptions.every((option) => currentDayIds.includes(option.id))
        ? []
        : checkoutDayOptions.map((option) => option.id)
    );
  }, [checkoutDayOptions]);
  const openCheckoutScope = useCallback(() => {
    if (!onRequestCheckout || checkoutRoutePlan.length === 0) {
      return;
    }

    setSelectedCheckoutDayIds(checkoutDayOptions.map((option) => option.id));
    setIsCheckoutScopeOpen(true);
  }, [checkoutDayOptions, checkoutRoutePlan, onRequestCheckout]);

  useEffect(() => {
    if (dayOptions.length === 0) {
      dispatchRouteMapView({
        type: "sync-day-option",
        dayOptionId: null,
      });
      return;
    }

    const hasCurrentDayOption = dayOptions.some(
      (option) => option.id === selectedDayOptionId
    );
    const nextInitialDayOptionId =
      initialDayOptionId &&
      dayOptions.some((option) => option.id === initialDayOptionId)
        ? initialDayOptionId
        : dayOptions[0].id;

    if (!hasCurrentDayOption) {
      dispatchRouteMapView({
        type: "sync-day-option",
        dayOptionId: nextInitialDayOptionId,
      });
    }
  }, [dayOptions, initialDayOptionId, selectedDayOptionId]);

  useEffect(() => {
    dispatchRouteMapView({ type: "reset-route-view" });
  }, [displayComparisonDay, displayDay]);

  useEffect(() => {
    if (!hasComparisonRoute && routeViewMode !== "all") {
      dispatchRouteMapView({ type: "ensure-all-route-view" });
    }
  }, [hasComparisonRoute, routeViewMode]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      if (isCheckoutScopeOpen) {
        closeCheckoutScope();
        return;
      }

      onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeCheckoutScope, isCheckoutScopeOpen, onClose]);

  return {
    text,
    displayDay,
    dayOptions,
    hasDaySelector,
    hasComparisonRoute,
    canRequestCheckout: Boolean(onRequestCheckout),
    isCheckoutDisabled: checkoutRoutePlan.length === 0,
    openCheckoutScope,
    map: {
      mapRef,
      selectedDayOptionId,
      selectDayOption,
      routeViewMode,
      setRouteViewMode,
      selectedRouteSegmentView,
      clearSelectedSegment,
      routeError,
      isSdkReady,
      isRouteLoading,
    },
    summary: {
      isStartPreviewDirty,
      startPreviewMode,
      setStartPreviewMode,
      canResetStartPreview,
      resetStartPreview,
      visibleRoutePointGroups,
      selectedSegment,
      focusRouteSegment,
    },
    checkout: {
      isOpen: isCheckoutScopeOpen,
      close: closeCheckoutScope,
      dayOptions: checkoutDayOptions,
      routePlanLength: checkoutRoutePlan.length,
      placeCount: checkoutPlaceCount,
      selectedDayIdSet: selectedCheckoutDayIdSet,
      selectedRoutePlanLength: selectedCheckoutRoutePlan.length,
      selectedPlaceCount: selectedCheckoutPlaceCount,
      isAllSelected: isAllCheckoutDaysSelected,
      currentDayOptionId: selectedDayOptionId,
      toggleDay: toggleCheckoutDay,
      toggleAll: toggleAllCheckoutDays,
      confirm: confirmCheckout,
    },
  };
}
