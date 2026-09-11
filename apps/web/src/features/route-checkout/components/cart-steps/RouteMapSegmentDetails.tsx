/**
 * 사용 위치: 루트 지도 → 펼친 경로 상세 영역
 *
 * 용도:
 * 비교 모드에서는 같은 순번의 기존·재계산 구간을 묶어 보여주고,
 * 단독 모드에서는 선택한 경로의 이동 구간을 세로 목록으로 보여준다.
 *
 * 구조:
 * 이동 순번별 비교 묶음 또는 단일 경로 구간 목록으로 구성되어 있다.
 */
import type { UiText } from "@/lib/uiText";
import type { RoutePointGroup } from "../../hooks/usePlaceCartRouteMapPopup";
import {
  getRouteSegmentDisplayColor,
  getRouteSegmentKey,
  type RouteDisplayVariant,
  type RouteMapSegment,
  type RouteMapViewMode,
  type RouteSegmentSelection,
} from "../../models/routeMapModel";
import RouteSegmentSelectCard from "./RouteSegmentSelectCard";

type RouteMapSegmentDetailsProps = {
  text: UiText;
  hasComparisonRoute: boolean;
  routeViewMode: RouteMapViewMode;
  routePointGroups: RoutePointGroup[];
  selectedSegment: RouteSegmentSelection | null;
  onSelectSegment: (
    variant: RouteDisplayVariant,
    segment: RouteMapSegment,
    isAlreadySelected: boolean
  ) => void;
};

function RouteMapSegmentDetails({
  text,
  hasComparisonRoute,
  routeViewMode,
  routePointGroups,
  selectedSegment,
  onSelectSegment,
}: RouteMapSegmentDetailsProps) {
  const isSelected = (variant: RouteDisplayVariant, segmentId: string) =>
    Boolean(
      selectedSegment &&
        getRouteSegmentKey(
          selectedSegment.variant,
          selectedSegment.segmentId
        ) === getRouteSegmentKey(variant, segmentId)
    );
  const renderSegment = (
    group: RoutePointGroup,
    segment: RouteMapSegment,
    segmentIndex: number,
    showRouteLabel: boolean
  ) => {
    const segmentColor = getRouteSegmentDisplayColor({
      index: segmentIndex,
      variant: group.key,
      hasComparisonRoute,
      routeViewMode,
    });
    const segmentIsSelected = isSelected(group.key, segment.id);

    return (
      <RouteSegmentSelectCard
        key={`${group.key}-${segment.id}`}
        segment={segment}
        segmentColor={segmentColor}
        variant={group.key}
        routeLabel={showRouteLabel ? group.label : undefined}
        lineStyle={
          routeViewMode === "all" && group.key === "comparison"
            ? "dashed"
            : "solid"
        }
        isSelected={segmentIsSelected}
        text={text}
        onSelect={onSelectSegment}
      />
    );
  };

  if (routeViewMode === "all" && hasComparisonRoute) {
    const comparisonGroup = routePointGroups.find(
      (group) => group.key === "comparison"
    );
    const currentGroup = routePointGroups.find(
      (group) => group.key === "current"
    );
    const pairCount = Math.max(
      comparisonGroup?.segments.length ?? 0,
      currentGroup?.segments.length ?? 0
    );

    return (
      <div className="space-y-3">
        {Array.from({ length: pairCount }, (_, index) => {
          const comparisonSegment = comparisonGroup?.segments[index];
          const currentSegment = currentGroup?.segments[index];

          return (
            <section
              key={`route-comparison-${index}`}
              className="rounded-2xl border border-slate-200 bg-slate-50/70 p-2"
            >
              <p className="px-1 pb-2 text-[10px] font-black text-slate-500">
                {text.cart.routeMovementOrder(index + 1)}
              </p>
              <div className="space-y-1.5">
                {comparisonGroup && comparisonSegment
                  ? renderSegment(
                      comparisonGroup,
                      comparisonSegment,
                      index,
                      true
                    )
                  : null}
                {currentGroup && currentSegment
                  ? renderSegment(currentGroup, currentSegment, index, true)
                  : null}
              </div>
            </section>
          );
        })}
      </div>
    );
  }

  const visibleGroup = routePointGroups[0];
  if (!visibleGroup) {
    return null;
  }

  return (
    <div className="space-y-2">
      {visibleGroup.segments.map((segment, index) =>
        renderSegment(visibleGroup, segment, index, false)
      )}
    </div>
  );
}

export default RouteMapSegmentDetails;
