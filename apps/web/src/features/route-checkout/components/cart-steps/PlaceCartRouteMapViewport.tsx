import { useMemo, type RefObject } from "react";
import { SegmentedToggle, type SegmentedToggleOption } from "@/components/inputs";
import type { UiText } from "@/lib/uiText";
import type {
  RouteMapDayOption,
  RouteMapViewMode,
} from "../../models/routeMapModel";
import type { SelectedRouteSegmentView } from "../../hooks/usePlaceCartRouteMapPopup";

type PlaceCartRouteMapViewportProps = {
  text: UiText;
  mapRef: RefObject<HTMLDivElement | null>;
  dayOptions: RouteMapDayOption[];
  selectedDayOptionId: string | null;
  onSelectDay: (dayOptionId: string) => void;
  hasDaySelector: boolean;
  hasComparisonRoute: boolean;
  routeViewMode: RouteMapViewMode;
  onRouteViewModeChange: (mode: RouteMapViewMode) => void;
  selectedRouteSegmentView: SelectedRouteSegmentView;
  onClearSelectedSegment: () => void;
  routeError: string | null;
  isSdkReady: boolean;
  isRouteLoading: boolean;
};

function PlaceCartRouteMapViewport({
  text,
  mapRef,
  dayOptions,
  selectedDayOptionId,
  onSelectDay,
  hasDaySelector,
  hasComparisonRoute,
  routeViewMode,
  onRouteViewModeChange,
  selectedRouteSegmentView,
  onClearSelectedSegment,
  routeError,
  isSdkReady,
  isRouteLoading,
}: PlaceCartRouteMapViewportProps) {
  const routeViewOptions = useMemo(
    () =>
      [
        { value: "all", label: text.cart.routeAll },
        { value: "comparison", label: text.cart.routeOriginal },
        { value: "current", label: text.cart.routeCurrent },
      ] satisfies ReadonlyArray<SegmentedToggleOption<RouteMapViewMode>>,
    [text]
  );
  const comparisonControlTopClass = hasDaySelector ? "top-16" : "top-4";
  const floatingPanelTopClass = hasDaySelector
    ? hasComparisonRoute
      ? "top-28"
      : "top-16"
    : hasComparisonRoute
      ? "top-20"
      : "top-4";
  const fallbackPanelTopClass = hasDaySelector ? "top-28" : "top-24";

  return (
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
                  onClick={() => onSelectDay(option.id)}
                  className={`inline-flex h-8 shrink-0 items-center rounded-full border px-3 text-xs font-semibold shadow-sm transition ${
                    isSelected
                      ? "border-brand-500 bg-brand-600 text-white"
                      : "border-brand-200 bg-white/95 text-slate-600 backdrop-blur"
                  }`}
                >
                  <span className="whitespace-nowrap">{option.label}</span>
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
            onChange={onRouteViewModeChange}
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
          className={`absolute left-4 flex max-w-[calc(100%-2rem)] items-center gap-3 rounded-full border bg-white/95 px-3 py-2 shadow-sm backdrop-blur ${floatingPanelTopClass}`}
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
            onClick={onClearSelectedSegment}
            className="shrink-0 rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-black text-slate-600"
          >
            {text.cart.viewAll}
          </button>
        </div>
      ) : null}
      {routeError ? (
        <div
          className={`absolute inset-x-4 rounded-2xl border border-amber-200 bg-amber-50/95 px-4 py-3 text-sm font-semibold text-amber-800 shadow-sm backdrop-blur ${floatingPanelTopClass}`}
        >
          {routeError}
        </div>
      ) : !isSdkReady || isRouteLoading ? (
        <div
          className={`absolute left-3 z-20 inline-flex max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-full border border-brand-400/30 bg-[#071718]/90 px-3 py-2 text-xs font-black text-brand-100 shadow-[0_10px_24px_rgba(0,0,0,0.22)] backdrop-blur ${floatingPanelTopClass}`}
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
  );
}

export default PlaceCartRouteMapViewport;
