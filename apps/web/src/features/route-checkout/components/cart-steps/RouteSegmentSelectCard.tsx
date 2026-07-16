import { memo } from "react";
import type { UiText } from "@/lib/uiText";
import {
  formatRouteDistance,
  formatRouteDuration,
  type RouteDisplayVariant,
  type RouteMapSegment,
} from "../../models/routeMapModel";

type RouteSegmentSelectCardProps = {
  segment: RouteMapSegment;
  segmentColor: string;
  variant: RouteDisplayVariant;
  isSelected: boolean;
  text: UiText;
  onSelect: (
    variant: RouteDisplayVariant,
    segment: RouteMapSegment,
    isAlreadySelected: boolean
  ) => void;
};

const RouteSegmentSelectCard = memo(function RouteSegmentSelectCard({
  segment,
  segmentColor,
  variant,
  isSelected,
  text,
  onSelect,
}: RouteSegmentSelectCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(variant, segment, isSelected)}
      className={`h-[76px] min-w-[180px] rounded-2xl border px-3 py-2 text-left transition ${
        isSelected
          ? "bg-white shadow-sm"
          : variant === "comparison"
            ? "border-slate-200 bg-white"
            : "border-brand-100 bg-white"
      }`}
      style={
        isSelected
          ? {
              borderColor: segmentColor,
              boxShadow: `0 0 0 2px ${segmentColor}33, 0 14px 24px rgba(15, 23, 42, 0.12)`,
            }
          : undefined
      }
    >
      <span
        className={`mb-1.5 block h-1.5 rounded-full ${
          isSelected ? "w-14" : "w-10"
        }`}
        style={{ backgroundColor: segmentColor }}
      />
      <p
        className={`text-[10px] font-black ${
          variant === "comparison" ? "text-slate-500" : "text-brand-700"
        }`}
      >
        {segment.from.sequenceLabel} → {segment.to.sequenceLabel}
      </p>
      <p className="mt-1 truncate text-xs font-semibold text-slate-900">
        {segment.from.title} → {segment.to.title}
      </p>
      <p className="mt-1 min-h-4 truncate text-[10px] font-bold text-slate-500">
        {segment.durationMs && segment.distanceM ? (
          <>
            {text.dayRoute.travelByCar(
              formatRouteDuration(segment.durationMs, text)
            )}{" "}
            · {formatRouteDistance(segment.distanceM)}
          </>
        ) : null}
      </p>
    </button>
  );
});

export default RouteSegmentSelectCard;
