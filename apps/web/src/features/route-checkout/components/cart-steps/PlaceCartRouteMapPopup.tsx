import { createPortal } from "react-dom";
import { IoClose } from "react-icons/io5";
import { MdAdd } from "react-icons/md";
import { formatRouteMapDate, type RouteMapDayOption } from "../../models/routeMapModel";
import type { PlannedRouteDay } from "../../models/routePlanTypes";
import { usePlaceCartRouteMapPopup } from "../../hooks/usePlaceCartRouteMapPopup";
import PlaceCartRouteCheckoutScopeDialog from "./PlaceCartRouteCheckoutScopeDialog";
import PlaceCartRouteMapSummary from "./PlaceCartRouteMapSummary";
import PlaceCartRouteMapViewport from "./PlaceCartRouteMapViewport";

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

function PlaceCartRouteMapPopup(props: PlaceCartRouteMapPopupProps) {
  const {
    text,
    displayDay,
    dayOptions,
    hasDaySelector,
    hasComparisonRoute,
    canRequestCheckout,
    isCheckoutDisabled,
    openCheckoutScope,
    map,
    summary,
    checkout,
  } = usePlaceCartRouteMapPopup(props);

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
            {canRequestCheckout ? (
              <button
                type="button"
                onClick={openCheckoutScope}
                disabled={isCheckoutDisabled}
                className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full bg-brand-600 px-4 text-xs font-black text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-40"
              >
                <MdAdd className="text-base" />
                {text.dayRoute.addToCart}
              </button>
            ) : null}
            <button
              type="button"
              aria-label={text.dayRoute.routeMapCloseAria}
              onClick={props.onClose}
              className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-xl text-brand-700 shadow-sm transition hover:bg-brand-100 dark:border-brand-400/30 dark:bg-[#0f3431] dark:text-brand-200 dark:shadow-[0_10px_24px_rgba(0,0,0,0.22)] dark:hover:bg-[#13423e]"
            >
              <IoClose />
            </button>
          </div>
        </header>

        <PlaceCartRouteMapViewport
          text={text}
          mapRef={map.mapRef}
          dayOptions={dayOptions}
          selectedDayOptionId={map.selectedDayOptionId}
          onSelectDay={map.selectDayOption}
          hasDaySelector={hasDaySelector}
          hasComparisonRoute={hasComparisonRoute}
          routeViewMode={map.routeViewMode}
          onRouteViewModeChange={map.setRouteViewMode}
          selectedRouteSegmentView={map.selectedRouteSegmentView}
          onClearSelectedSegment={map.clearSelectedSegment}
          routeError={map.routeError}
          isSdkReady={map.isSdkReady}
          isRouteLoading={map.isRouteLoading}
        />

        <PlaceCartRouteMapSummary
          text={text}
          hasComparisonRoute={hasComparisonRoute}
          routeViewMode={map.routeViewMode}
          isStartPreviewDirty={summary.isStartPreviewDirty}
          startPreviewMode={summary.startPreviewMode}
          onStartPreviewModeChange={summary.setStartPreviewMode}
          canResetStartPreview={summary.canResetStartPreview}
          onResetStartPreview={summary.resetStartPreview}
          routePointGroups={summary.visibleRoutePointGroups}
          selectedSegment={summary.selectedSegment}
          onSelectSegment={summary.focusRouteSegment}
        />
      </div>

      {checkout.isOpen ? (
        <PlaceCartRouteCheckoutScopeDialog
          text={text}
          dayOptions={checkout.dayOptions}
          routePlanLength={checkout.routePlanLength}
          placeCount={checkout.placeCount}
          selectedDayIdSet={checkout.selectedDayIdSet}
          selectedRoutePlanLength={checkout.selectedRoutePlanLength}
          selectedPlaceCount={checkout.selectedPlaceCount}
          isAllSelected={checkout.isAllSelected}
          currentDayOptionId={checkout.currentDayOptionId}
          onClose={checkout.close}
          onToggleDay={checkout.toggleDay}
          onToggleAll={checkout.toggleAll}
          onConfirm={checkout.confirm}
        />
      ) : null}
    </div>,
    document.body
  );
}

export default PlaceCartRouteMapPopup;
