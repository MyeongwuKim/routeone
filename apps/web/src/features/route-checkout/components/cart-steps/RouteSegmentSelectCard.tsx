/**
 * 사용 위치: 루트 지도 → 경로 상세 목록
 *
 * 용도:
 * 이동 구간의 출발지와 도착지, 예상 이동 정보를 한 줄로 보여주고
 * 선택하면 지도에서 해당 구간을 강조한다.
 */
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
  routeLabel?: string;
  lineStyle?: "solid" | "dashed";
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
  routeLabel,
  lineStyle = "solid",
  text,
  onSelect,
}: RouteSegmentSelectCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(variant, segment, isSelected)}
      aria-pressed={isSelected}
      className={`min-h-[66px] w-full rounded-xl border px-3 py-2.5 text-left transition ${
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
      <span className="flex items-center gap-3">
        <span className="flex w-[74px] shrink-0 flex-col gap-2">
          {routeLabel ? (
            <span
              className={`truncate text-[10px] font-black ${
                variant === "comparison"
                  ? "text-slate-500"
                  : "text-brand-700"
              }`}
            >
              {routeLabel}
            </span>
          ) : null}
          <span
            className={`block w-12 ${
              lineStyle === "dashed"
                ? "h-0 border-t-[4px] border-dashed"
                : "h-1 rounded-full"
            }`}
            style={
              lineStyle === "dashed"
                ? { borderColor: segmentColor }
                : { backgroundColor: segmentColor }
            }
          />
          <span
            className={`text-[10px] font-black ${
              variant === "comparison"
                ? "text-slate-500"
                : "text-brand-700"
            }`}
          >
            {segment.from.sequenceLabel} → {segment.to.sequenceLabel}
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold text-slate-900">
            {segment.from.title} → {segment.to.title}
          </span>
          <span className="mt-1 block min-h-4 truncate text-[10px] font-bold text-slate-500">
            {segment.durationMs && segment.distanceM ? (
              <>
                {text.dayRoute.travelByCar(
                  formatRouteDuration(segment.durationMs, text)
                )}{" "}
                · {formatRouteDistance(segment.distanceM)}
              </>
            ) : null}
          </span>
        </span>
      </span>
    </button>
  );
});

export default RouteSegmentSelectCard;
