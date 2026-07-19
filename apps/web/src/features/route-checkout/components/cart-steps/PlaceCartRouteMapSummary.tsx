import { useMemo } from "react";
import { SegmentedToggle, type SegmentedToggleOption } from "@/components/inputs";
import type { UiText } from "@/lib/uiText";
import {
  getRouteSegmentDisplayColor,
  getRouteSegmentKey,
  type RouteDisplayVariant,
  type RouteMapSegment,
  type RouteMapViewMode,
  type RouteSegmentSelection,
  type StartPreviewMode,
} from "../../models/routeMapModel";
import type { RoutePointGroup } from "../../hooks/usePlaceCartRouteMapPopup";
import RouteSegmentSelectCard from "./RouteSegmentSelectCard";

type PlaceCartRouteMapSummaryProps = {
  text: UiText;
  hasComparisonRoute: boolean;
  routeViewMode: RouteMapViewMode;
  isStartPreviewDirty: boolean;
  startPreviewMode: StartPreviewMode;
  onStartPreviewModeChange: (mode: StartPreviewMode) => void;
  canResetStartPreview: boolean;
  onResetStartPreview: () => void;
  routePointGroups: RoutePointGroup[];
  selectedSegment: RouteSegmentSelection | null;
  onSelectSegment: (
    variant: RouteDisplayVariant,
    segment: RouteMapSegment,
    isAlreadySelected: boolean
  ) => void;
};

function PlaceCartRouteMapSummary({
  text,
  hasComparisonRoute,
  routeViewMode,
  isStartPreviewDirty,
  startPreviewMode,
  onStartPreviewModeChange,
  canResetStartPreview,
  onResetStartPreview,
  routePointGroups,
  selectedSegment,
  onSelectSegment,
}: PlaceCartRouteMapSummaryProps) {
  const startPreviewModeOptions = useMemo(
    () =>
      [
        { value: "original", label: text.cart.routeOriginal },
        { value: "changed", label: text.cart.routeCurrent },
      ] satisfies ReadonlyArray<SegmentedToggleOption<StartPreviewMode>>,
    [text]
  );

  return (
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
                  onChange={onStartPreviewModeChange}
                  ariaLabel={text.dayRoute.startRouteComparisonAria}
                  size="xs"
                />
                {canResetStartPreview ? (
                  <button
                    type="button"
                    onClick={onResetStartPreview}
                    className="rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-black text-slate-500"
                  >
                    {text.common.reset}
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
          {routePointGroups.map((group) => (
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
                        : text.dayRoute.stopOrderLabel(point.sequenceLabel)}
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
                    const segmentColor = getRouteSegmentDisplayColor({
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
                        onSelect={onSelectSegment}
                      />
                    );
                  })}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default PlaceCartRouteMapSummary;
