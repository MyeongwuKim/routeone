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
import { IoChevronDown, IoChevronUp } from "react-icons/io5";
import type { UiText } from "@/lib/uiText";
import type {
  RouteDisplayVariant,
  RouteMapSegment,
  RouteMapViewMode,
  RouteSegmentSelection,
} from "../../models/routeMapModel";
import type { RoutePointGroup } from "../../hooks/usePlaceCartRouteMapPopup";
import RouteMapSegmentDetails from "./RouteMapSegmentDetails";

const MIN_DETAILS_HEIGHT = 180;
const MAX_DETAILS_HEIGHT = 220;
const DETAILS_VIEWPORT_RATIO = 0.25;

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
  const [showScrollHint, setShowScrollHint] = useState(false);
  const detailsScrollRef = useRef<HTMLDivElement | null>(null);
  const detailsResizeObserverRef = useRef<ResizeObserver | null>(null);
  const updateScrollHint = useCallback(() => {
    const element = detailsScrollRef.current;

    if (!element) {
      setShowScrollHint(false);
      return;
    }

    const remainingScroll =
      element.scrollHeight - element.scrollTop - element.clientHeight;
    setShowScrollHint(isExpanded && remainingScroll > 8);
  }, [isExpanded]);
  const observeDetailsContent = useCallback((element: HTMLDivElement | null) => {
    detailsResizeObserverRef.current?.disconnect();
    detailsResizeObserverRef.current = null;

    if (!element) {
      return;
    }

    const updateDetailsHeight = () => {
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const viewportLimit = Math.min(
        MAX_DETAILS_HEIGHT,
        Math.max(MIN_DETAILS_HEIGHT, viewportHeight * DETAILS_VIEWPORT_RATIO)
      );
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

  useEffect(() => {
    const frameId = window.requestAnimationFrame(updateScrollHint);

    return () => window.cancelAnimationFrame(frameId);
  }, [detailsHeight, routePointGroups, routeViewMode, updateScrollHint]);

  useEffect(() => {
    if (!detailsScrollRef.current) {
      return;
    }

    detailsScrollRef.current.scrollTop = 0;
    updateScrollHint();
  }, [routeViewMode, updateScrollHint]);

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
        className="relative overflow-hidden motion-safe:will-change-[height] motion-safe:transition-[height] motion-safe:duration-[320ms] motion-safe:ease-out"
        style={{ height: isExpanded ? `${detailsHeight}px` : "0px" }}
        onTransitionEnd={(event) => {
          if (event.propertyName === "height") {
            updateScrollHint();
          }
        }}
      >
        <div
          ref={detailsScrollRef}
          onScroll={updateScrollHint}
          className="scrollbar-hide h-full overflow-y-auto overscroll-contain"
        >
          <div
            ref={observeDetailsContent}
            className={`border-t border-slate-100 px-4 py-3 motion-safe:transition-[opacity,transform] motion-safe:duration-200 motion-safe:ease-out ${
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
        {showScrollHint ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-white via-white/95 to-transparent pb-2 pt-8 dark:from-[#071718] dark:via-[#071718]/95">
            <span className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-white/95 px-3 py-1.5 text-[10px] font-black text-brand-700 shadow-sm dark:border-brand-400/30 dark:bg-[#0f3431]/95 dark:text-brand-200">
              {text.cart.routeScrollHint}
              <IoChevronDown className="text-sm motion-safe:animate-bounce" />
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default PlaceCartRouteMapSummary;
