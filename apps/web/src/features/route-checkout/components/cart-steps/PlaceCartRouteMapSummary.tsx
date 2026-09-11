/**
 * 사용 위치: 루트 지도 → 하단 경로 상세 영역
 *
 * 용도:
 * 지도에서 확인할 수 있는 이동 구간 수를 먼저 보여주고,
 * 사용자가 요청할 때 세로형 경로 상세 목록을 펼친다.
 *
 * 구조:
 * 상세 펼침 버튼, START 초기화 버튼, 이동 구간 목록으로 구성되어 있다.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { IoChevronUp } from "react-icons/io5";
import type { UiText } from "@/lib/uiText";
import type {
  RouteDisplayVariant,
  RouteMapSegment,
  RouteMapViewMode,
  RouteSegmentSelection,
} from "../../models/routeMapModel";
import type { RoutePointGroup } from "../../hooks/usePlaceCartRouteMapPopup";
import RouteMapSegmentDetails from "./RouteMapSegmentDetails";

type PlaceCartRouteMapSummaryProps = {
  text: UiText;
  hasComparisonRoute: boolean;
  routeViewMode: RouteMapViewMode;
  isStartPreviewDirty: boolean;
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
  canResetStartPreview,
  onResetStartPreview,
  routePointGroups,
  selectedSegment,
  onSelectSegment,
}: PlaceCartRouteMapSummaryProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [detailsHeight, setDetailsHeight] = useState(0);
  const detailsResizeObserverRef = useRef<ResizeObserver | null>(null);
  const observeDetailsContent = useCallback((element: HTMLDivElement | null) => {
    detailsResizeObserverRef.current?.disconnect();
    detailsResizeObserverRef.current = null;

    if (!element) {
      return;
    }

    const updateDetailsHeight = () => {
      const viewportLimit = Math.max(160, window.innerHeight * 0.42);
      const nextHeight = Math.min(
        Math.ceil(element.getBoundingClientRect().height),
        viewportLimit
      );
      setDetailsHeight((currentHeight) =>
        currentHeight === nextHeight ? currentHeight : nextHeight
      );
    };
    const resizeObserver = new ResizeObserver(updateDetailsHeight);

    resizeObserver.observe(element);
    detailsResizeObserverRef.current = resizeObserver;
    updateDetailsHeight();
  }, []);
  const visibleSegmentCount =
    routeViewMode === "all"
      ? Math.max(...routePointGroups.map((group) => group.segments.length), 0)
      : (routePointGroups[0]?.segments.length ?? 0);

  useEffect(
    () => () => {
      detailsResizeObserverRef.current?.disconnect();
    },
    []
  );

  return (
    <div className="app-safe-area-footer shrink-0 border-t border-brand-100 bg-white">
      <div className="flex min-h-14 items-center gap-2 px-4 py-2">
        <button
          type="button"
          aria-expanded={isExpanded}
          onClick={() => setIsExpanded((current) => !current)}
          className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-xl px-1 py-2 text-left"
        >
          <span className="min-w-0">
            <span className="block text-xs font-black text-slate-900">
              {text.cart.routeDetails}
            </span>
            <span className="mt-0.5 block text-[10px] font-bold text-slate-500">
              {text.cart.routeSegmentCount(visibleSegmentCount)}
              {isStartPreviewDirty ? ` · ${text.dayRoute.startBasis}` : ""}
            </span>
          </span>
          <IoChevronUp
            className={`shrink-0 text-lg text-brand-700 motion-safe:transition-transform motion-safe:duration-300 ${
              isExpanded ? "" : "rotate-180"
            }`}
          />
        </button>
        {isStartPreviewDirty && canResetStartPreview ? (
          <button
            type="button"
            onClick={onResetStartPreview}
            className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-2 text-[11px] font-black text-slate-500"
          >
            {text.common.reset}
          </button>
        ) : null}
      </div>
      <div
        className="overflow-hidden motion-safe:will-change-[height] motion-safe:transition-[height] motion-safe:duration-[320ms] motion-safe:ease-out"
        style={{ height: isExpanded ? `${detailsHeight}px` : "0px" }}
      >
        <div className="h-full overflow-y-auto">
          <div
            ref={observeDetailsContent}
            className={`scrollbar-hide border-t border-slate-100 px-4 py-3 motion-safe:transition-[opacity,transform] motion-safe:duration-200 motion-safe:ease-out ${
              isExpanded
                ? "translate-y-0 opacity-100 motion-safe:delay-75"
                : "-translate-y-2 opacity-0"
            }`}
          >
            <RouteMapSegmentDetails
              text={text}
              hasComparisonRoute={hasComparisonRoute}
              routeViewMode={routeViewMode}
              routePointGroups={routePointGroups}
              selectedSegment={selectedSegment}
              onSelectSegment={onSelectSegment}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default PlaceCartRouteMapSummary;
