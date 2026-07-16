import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { createPortal } from "react-dom";
import { IoClose } from "react-icons/io5";
import { MdAdd } from "react-icons/md";
import { SegmentedToggle, type SegmentedToggleOption } from "@/components/inputs";
import { useUiText } from "@/lib/uiText";
import RouteSegmentSelectCard from "./RouteSegmentSelectCard";
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
  getRouteSegmentKey,
  routeMapViewReducer,
  type RouteDisplayVariant,
  type RouteMapDayOption,
  type RouteMapPoint,
  type RouteMapSegment,
  type RouteMapViewMode,
  type StartPreviewMode,
} from "../../models/routeMapModel";
import type {
  PlannedRouteDay,
  RouteStartLocation,
} from "../../models/routePlanTypes";
import { useRouteMapRenderer } from "../../hooks/useRouteMapRenderer";
import { useRouteMapSegments } from "../../hooks/useRouteMapSegments";

type PlaceCartRouteMapPopupProps = {
  day: PlannedRouteDay;
  comparisonDay?: PlannedRouteDay | null;
  completedItemIds?: string[];
  dayOptions?: RouteMapDayOption[];
  initialDayOptionId?: string;
  enableStartPreview?: boolean;
  onRequestCheckout?: (routePlan: PlannedRouteDay[]) => void;
  onClose: () => void;
};

function PlaceCartRouteMapPopup({
  day,
  comparisonDay,
  completedItemIds = EMPTY_COMPLETED_ITEM_IDS,
  dayOptions = EMPTY_DAY_OPTIONS,
  initialDayOptionId,
  enableStartPreview = false,
  onRequestCheckout,
  onClose,
}: PlaceCartRouteMapPopupProps) {
  const text = useUiText();
  const routeViewOptions = useMemo(
    () =>
      [
        { value: "all", label: text.cart.routeAll },
        { value: "comparison", label: text.cart.routeOriginal },
        { value: "current", label: text.cart.routeCurrent },
      ] satisfies ReadonlyArray<SegmentedToggleOption<RouteMapViewMode>>,
    [text]
  );
  const startPreviewModeOptions = useMemo(
    () =>
      [
        { value: "original", label: text.cart.routeOriginal },
        { value: "changed", label: text.cart.routeCurrent },
      ] satisfies ReadonlyArray<SegmentedToggleOption<StartPreviewMode>>,
    [text]
  );
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
  const { selectedDayOptionId, selectedSegment, routeViewMode } =
    routeMapViewState;
  const [isCheckoutScopeOpen, setIsCheckoutScopeOpen] = useState(false);
  const [selectedCheckoutDayIds, setSelectedCheckoutDayIds] = useState<
    string[]
  >([]);
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
  const previewStartLocation =
    enableStartPreview
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
      const startLocation =
        enableStartPreview
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
      .map((option) => {
        const routeDay = createStartPreviewRouteDay(option.day);

        return {
          id: option.id,
          label: option.label,
          summary: option.summary,
          day: routeDay,
        };
      })
      .filter((option) => option.day.items.length > 0);
  }, [createStartPreviewRouteDay, dayOptions, displayDay, displayDayKey, text]);
  const checkoutRoutePlan = useMemo(
    () => checkoutDayOptions.map((option) => option.day),
    [checkoutDayOptions]
  );
  const checkoutPlaceCount = useMemo(
    () =>
      checkoutRoutePlan.reduce(
        (totalCount, routeDay) => totalCount + routeDay.items.length,
        0
      ),
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
    () =>
      selectedCheckoutRoutePlan.reduce(
        (totalCount, routeDay) => totalCount + routeDay.items.length,
        0
      ),
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
  const comparisonControlTopClass = hasDaySelector ? "top-16" : "top-4";
  const floatingPanelTopClass = hasDaySelector
    ? hasComparisonRoute
      ? "top-28"
      : "top-16"
    : hasComparisonRoute
      ? "top-20"
      : "top-4";
  const fallbackPanelTopClass = hasDaySelector ? "top-28" : "top-24";
  const shouldShowComparisonRoute =
    hasComparisonRoute && routeViewMode !== "current";
  const shouldShowCurrentRoute =
    !hasComparisonRoute || routeViewMode !== "comparison";
  const visibleRoutePointGroups = useMemo(() => {
    const groups: Array<{
      key: RouteDisplayVariant;
      label: string;
      points: RouteMapPoint[];
      segments: RouteMapSegment[];
    }> = [];

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
  const mapAutoFitKey = useMemo(() => {
    const serializePoint = (point: RouteMapPoint) =>
      `${point.id}:${point.lat.toFixed(6)},${point.lng.toFixed(6)}`;

    return [
      displayDayKey,
      routeViewMode,
      shouldShowComparisonRoute ? "comparison" : "",
      shouldShowCurrentRoute ? "current" : "",
      routePoints.map(serializePoint).join("|"),
      comparisonRoutePoints.map(serializePoint).join("|"),
    ].join("::");
  }, [
    comparisonRoutePoints,
    displayDayKey,
    routePoints,
    routeViewMode,
    shouldShowComparisonRoute,
    shouldShowCurrentRoute,
  ]);
  const selectedRouteSegmentView = useMemo(() => {
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

    const segment = group.segments[segmentIndex];

    return {
      segment,
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

  const focusRouteSegment = useCallback(
    (
      variant: RouteDisplayVariant,
      segment: RouteMapSegment,
      isAlreadySelected: boolean
    ) => {
      if (isAlreadySelected) {
        dispatchRouteMapView({ type: "clear-selected-segment" });
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
    []
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
      dispatchRouteMapView({ type: "clear-selected-segment" });
    },
    [displayDayKey]
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

  const requestCheckout = useCallback(
    (routePlan: PlannedRouteDay[]) => {
      if (routePlan.length === 0) {
        return;
      }

      setIsCheckoutScopeOpen(false);
      onRequestCheckout?.(routePlan);
    },
    [onRequestCheckout]
  );
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
  const handleCheckoutButtonClick = useCallback(() => {
    if (!onRequestCheckout || checkoutRoutePlan.length === 0) {
      return;
    }

    setSelectedCheckoutDayIds(checkoutDayOptions.map((option) => option.id));
    setIsCheckoutScopeOpen(true);
  }, [
    checkoutDayOptions,
    checkoutRoutePlan,
    onRequestCheckout,
  ]);

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
      if (event.key === "Escape") {
        if (isCheckoutScopeOpen) {
          setIsCheckoutScopeOpen(false);
          return;
        }

        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCheckoutScopeOpen, onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[2750] bg-white">
      <div className="flex h-full flex-col">
        <header className="app-safe-area-header flex items-center justify-between border-b border-brand-100 px-4 py-3">
          <div className="min-w-0">
            <p className="font-trip text-sm text-brand-700">
              {hasDaySelector
                ? "ROUTE MAP"
                : text.dayRoute.routeMapDayTitle(displayDay.day)}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {hasDaySelector
                ? `${text.dayRoute.daySchedule(
                    dayOptions.length
                  )} · ${text.dayRoute.routeMapSelectedDay(displayDay.day)}`
                : displayDay.date
                  ? formatRouteMapDate(displayDay.date)
                  : text.dayRoute.selectedSchedule}{" "}
              · {text.dayRoute.placeCount(displayDay.items.length)}
              {hasComparisonRoute ? ` · ${text.dayRoute.routeMapComparison}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onRequestCheckout ? (
              <button
                type="button"
                onClick={handleCheckoutButtonClick}
                disabled={checkoutRoutePlan.length === 0}
                className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full bg-brand-600 px-4 text-xs font-black text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-40"
              >
                <MdAdd className="text-base" />
                {text.dayRoute.addToCart}
              </button>
            ) : null}
            <button
              type="button"
              aria-label={text.dayRoute.routeMapCloseAria}
              onClick={onClose}
              className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-xl text-brand-700 shadow-sm transition hover:bg-brand-100 dark:border-brand-400/30 dark:bg-[#0f3431] dark:text-brand-200 dark:shadow-[0_10px_24px_rgba(0,0,0,0.22)] dark:hover:bg-[#13423e]"
            >
              <IoClose />
            </button>
          </div>
        </header>

        <div className="relative min-h-0 flex-1 overflow-hidden">
          <div
            ref={mapRef}
            className="naver-map-root h-full w-full overflow-hidden"
            style={{
              background: "#e0f2fe",
              minHeight: "100%",
              width: "100%",
            }}
          />
          {hasDaySelector ? (
            <div className="scrollbar-hide absolute inset-x-0 top-4 z-10 overflow-x-auto px-3 pb-1">
              <div className="flex w-max min-w-full gap-2 pr-3">
                {dayOptions.map((option) => {
                  const isSelected = option.id === selectedDayOptionId;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={isSelected}
                      aria-label={text.cart.routeDayViewAria(option.label)}
                      onClick={() => {
                        dispatchRouteMapView({
                          type: "select-day-option",
                          dayOptionId: option.id,
                        });
                      }}
                      className={`inline-flex h-8 shrink-0 items-center rounded-full border px-3 text-xs font-semibold shadow-sm transition ${
                        isSelected
                          ? "border-brand-500 bg-brand-600 text-white"
                          : "border-brand-200 bg-white/95 text-slate-600 backdrop-blur"
                      }`}
                    >
                      <span className="whitespace-nowrap">
                        {option.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          {hasComparisonRoute ? (
            <div
              className={`absolute inset-x-4 ${comparisonControlTopClass} rounded-2xl border border-brand-100 bg-white/95 p-1 shadow-sm backdrop-blur`}
            >
              <SegmentedToggle
                options={routeViewOptions}
                value={routeViewMode}
                onChange={(nextMode) => {
                  dispatchRouteMapView({
                    type: "set-route-view-mode",
                    routeViewMode: nextMode,
                  });
                }}
                ariaLabel={text.cart.routeViewModeAria}
                fullWidth
                className="rounded-xl border-0 bg-transparent p-0"
                itemClassName="rounded-xl px-2 py-2 text-xs font-bold"
                idleItemClassName="text-slate-500 hover:bg-brand-50"
              />
            </div>
          ) : null}
          {selectedRouteSegmentView ? (
            <div
              className={`absolute left-4 flex max-w-[calc(100%-2rem)] items-center gap-3 rounded-full border bg-white/95 px-3 py-2 shadow-sm backdrop-blur ${
                floatingPanelTopClass
              }`}
              style={{
                borderColor: selectedRouteSegmentView.color,
                boxShadow: `0 12px 26px ${selectedRouteSegmentView.color}24`,
              }}
            >
              <span
                className="inline-flex min-w-0 items-center gap-2 text-xs font-black"
                style={{ color: selectedRouteSegmentView.color }}
              >
                <span
                  className="h-2 w-7 shrink-0 rounded-full"
                  style={{ backgroundColor: selectedRouteSegmentView.color }}
                />
                {text.cart.segmentHighlighted}
              </span>
              <button
                type="button"
                onClick={() =>
                  dispatchRouteMapView({ type: "clear-selected-segment" })
                }
                className="shrink-0 rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-black text-slate-600"
              >
                {text.cart.viewAll}
              </button>
            </div>
          ) : null}
          {routeError ? (
            <div
              className={`absolute inset-x-4 rounded-2xl border border-amber-200 bg-amber-50/95 px-4 py-3 text-sm font-semibold text-amber-800 shadow-sm backdrop-blur ${
                floatingPanelTopClass
              }`}
            >
              {routeError}
            </div>
          ) : !isSdkReady || isRouteLoading ? (
            <div
              className={`absolute left-3 z-20 inline-flex max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-full border border-brand-400/30 bg-[#071718]/90 px-3 py-2 text-xs font-black text-brand-100 shadow-[0_10px_24px_rgba(0,0,0,0.22)] backdrop-blur ${
                floatingPanelTopClass
              }`}
            >
              <span className="size-3 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" />
              <span className="truncate">
                {isSdkReady
                  ? text.dayRoute.routeCalculating
                  : text.dayRoute.mapPreparing}
              </span>
            </div>
          ) : null}
          {routeError && !isSdkReady ? (
            <div
              className={`absolute inset-x-6 ${fallbackPanelTopClass} rounded-2xl border border-brand-100 bg-white/95 p-4 text-sm shadow-sm backdrop-blur`}
            >
              <p className="font-black text-slate-900">
                {text.dayRoute.mapFallbackTitle}
              </p>
              <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                {text.dayRoute.mapFallbackDescription}
              </p>
            </div>
          ) : null}
          {hasComparisonRoute && routeViewMode === "all" ? (
            <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-brand-100 bg-white/95 px-4 py-3 text-xs font-bold shadow-sm backdrop-blur">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="inline-flex items-center gap-1.5 text-indigo-600">
                  <span className="h-1.5 w-8 rounded-full border-t-[4px] border-dashed border-indigo-500/70" />
                  {text.dayRoute.originalRouteDashed}
                </span>
                <span className="inline-flex items-center gap-1.5 text-teal-700">
                  <span className="h-1.5 w-8 rounded-full bg-teal-500/70" />
                  {text.dayRoute.recalculatedRouteSolid}
                </span>
              </div>
            </div>
          ) : null}
        </div>

        <div className="app-safe-area-footer max-h-[228px] shrink-0 overflow-hidden border-t border-brand-100 bg-white px-4 py-3">
          <div className="scrollbar-hide max-h-[204px] overflow-y-auto pr-1">
            <div className="space-y-2 pb-1">
              {isStartPreviewDirty ? (
                <div className="flex items-center justify-between gap-3 pb-1">
                  <p className="shrink-0 text-[10px] font-black text-brand-700">
                    {text.dayRoute.startBasis}
                  </p>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <SegmentedToggle
                      options={startPreviewModeOptions}
                      value={startPreviewMode}
                      onChange={(mode) => {
                        setStartPreviewModeByDayKey((currentModes) => ({
                          ...currentModes,
                          [displayDayKey]: mode,
                        }));
                        dispatchRouteMapView({
                          type: "clear-selected-segment",
                        });
                      }}
                      ariaLabel={text.dayRoute.startRouteComparisonAria}
                      size="xs"
                    />
                    {canResetStartPreview ? (
                      <button
                        type="button"
                        onClick={() => {
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
                          dispatchRouteMapView({
                            type: "clear-selected-segment",
                          });
                        }}
                        className="rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-black text-slate-500"
                      >
                        {text.common.reset}
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
              {visibleRoutePointGroups.map((group) => {
                return (
                  <div key={group.key}>
                    {hasComparisonRoute ? (
                      <p
                        className={`mb-1 text-[10px] font-black ${
                          group.key === "comparison"
                            ? "text-slate-500"
                            : "text-brand-700"
                        }`}
                      >
                        {group.label}
                      </p>
                    ) : null}
                    <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-1">
                      {group.points.map((point) => (
                        <div
                          key={`${group.key}-${point.id}`}
                          className={`h-16 min-w-[136px] rounded-2xl border px-3 py-2 ${
                            group.key === "comparison"
                              ? "border-slate-200 bg-slate-50"
                              : "border-brand-100 bg-brand-50"
                          }`}
                        >
                          <p
                            className={`text-[10px] font-bold ${
                              group.key === "comparison"
                                ? "text-slate-500"
                                : "text-brand-700"
                            }`}
                          >
                            {point.variant === "start"
                              ? "START"
                              : text.dayRoute.stopOrderLabel(
                                  point.sequenceLabel
                                )}
                          </p>
                          <p className="mt-1 truncate text-xs font-semibold text-slate-900">
                            {point.title}
                          </p>
                          <p className="mt-0.5 text-[10px] text-slate-500">
                            {point.subtitle}
                          </p>
                        </div>
                      ))}
                    </div>
                    {group.segments.length > 0 ? (
                      <div className="scrollbar-hide mt-1 flex gap-2 overflow-x-auto pb-1">
                        {group.segments.map((segment, segmentIndex) => {
                          const isSelectedSegment =
                            selectedSegment &&
                            getRouteSegmentKey(
                              selectedSegment.variant,
                              selectedSegment.segmentId
                            ) === getRouteSegmentKey(group.key, segment.id);
                          const segmentColor =
                            getRouteSegmentDisplayColor({
                              index: segmentIndex,
                              variant: group.key,
                              hasComparisonRoute,
                              routeViewMode,
                            });

                          return (
                            <RouteSegmentSelectCard
                              key={`${group.key}-${segment.id}`}
                              segment={segment}
                              segmentColor={segmentColor}
                              variant={group.key}
                              isSelected={Boolean(isSelectedSegment)}
                              text={text}
                              onSelect={focusRouteSegment}
                            />
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      {isCheckoutScopeOpen ? (
        <div
          className="absolute inset-0 z-[2147483600] flex items-end bg-slate-950/50 px-4 pb-4 backdrop-blur-[2px]"
          onMouseDown={() => setIsCheckoutScopeOpen(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label={text.dayRoute.checkoutScopeAria}
            className="flex max-h-[calc(100dvh-2rem)] w-full flex-col rounded-[28px] border border-brand-200 bg-white p-4 shadow-[0_24px_70px_rgba(15,23,42,0.28)]"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-black text-brand-700">
                  {text.dayRoute.checkoutScope}
                </p>
                <h2 className="mt-1 text-lg font-black text-slate-950">
                  {text.dayRoute.checkoutScopeTitle}
                </h2>
              </div>
              <button
                type="button"
                aria-label={text.dayRoute.checkoutScopeCloseAria}
                onClick={() => setIsCheckoutScopeOpen(false)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-lg text-slate-500 transition hover:bg-slate-200"
              >
                <IoClose />
              </button>
            </div>

            <button
              type="button"
              aria-pressed={isAllCheckoutDaysSelected}
              onClick={toggleAllCheckoutDays}
              className="mt-4 flex w-full items-center justify-between gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-left transition hover:border-brand-400 hover:bg-brand-100"
            >
              <span className="inline-flex min-w-0 items-center gap-3">
                <span
                  className={`inline-flex size-7 shrink-0 items-center justify-center rounded-full border text-sm font-black ${
                    isAllCheckoutDaysSelected
                      ? "border-brand-600 bg-brand-600 text-white"
                      : "border-brand-200 bg-white text-transparent"
                  }`}
                >
                  ✓
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-black text-slate-950">
                    {text.dayRoute.selectAll}
                  </span>
                  <span className="mt-0.5 block text-xs font-bold text-slate-500">
                    {text.dayRoute.daySchedule(checkoutRoutePlan.length)} ·{" "}
                    {text.dayRoute.placeCount(checkoutPlaceCount)}
                  </span>
                </span>
              </span>
              <span className="shrink-0 text-xs font-black text-brand-700">
                {isAllCheckoutDaysSelected
                  ? text.dayRoute.selected
                  : text.dayRoute.select}
              </span>
            </button>

            <div className="scrollbar-hide mt-3 grid max-h-[40dvh] gap-2 overflow-y-auto pr-1">
              {checkoutDayOptions.map((option) => {
                const isCurrentRouteDay = option.id === selectedDayOptionId;
                const isSelected = selectedCheckoutDayIdSet.has(option.id);
                const daySummary =
                  option.summary ||
                  text.dayRoute.placeCount(option.day.items.length);

                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => toggleCheckoutDay(option.id)}
                    className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                      isSelected
                        ? "border-brand-500 bg-white shadow-[0_10px_26px_rgba(20,184,166,0.16)]"
                        : "border-slate-200 bg-white hover:border-brand-200 hover:bg-brand-50"
                    }`}
                  >
                    <span
                      className={`inline-flex h-10 min-w-16 shrink-0 items-center justify-center rounded-full px-3 text-xs font-black ${
                        isSelected
                          ? "bg-brand-600 text-white"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {option.label}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-black text-slate-950">
                        {option.day.date
                          ? formatRouteMapDate(option.day.date)
                          : `DAY ${option.day.day}`}
                      </span>
                      <span className="mt-0.5 block text-xs font-bold text-slate-500">
                        {daySummary}
                      </span>
                    </span>
                    <span
                      className={`ml-auto inline-flex size-7 shrink-0 items-center justify-center rounded-full border text-sm font-black ${
                        isSelected
                          ? "border-brand-600 bg-brand-600 text-white"
                          : "border-slate-200 bg-white text-transparent"
                      }`}
                    >
                      ✓
                    </span>
                    {isCurrentRouteDay ? (
                      <span className="sr-only">
                        {text.dayRoute.currentViewingDaySr}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex items-center gap-3 border-t border-slate-100 pt-4">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-black text-brand-700">
                  {text.dayRoute.selectedDays(
                    selectedCheckoutRoutePlan.length
                  )}
                </p>
                <p className="mt-0.5 text-xs font-bold text-slate-500">
                  {text.dayRoute.addPlacesSummary(selectedCheckoutPlaceCount)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => requestCheckout(selectedCheckoutRoutePlan)}
                disabled={selectedCheckoutRoutePlan.length === 0}
                className="inline-flex h-12 min-w-28 shrink-0 items-center justify-center rounded-full bg-brand-600 px-5 text-sm font-black text-white shadow-sm transition hover:bg-brand-700 disabled:bg-slate-200 disabled:text-slate-400"
              >
                {text.common.confirm}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>,
    document.body
  );
}

export default PlaceCartRouteMapPopup;
