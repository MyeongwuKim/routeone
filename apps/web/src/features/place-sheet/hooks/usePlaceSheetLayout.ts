/** 장소 상세 bottom sheet의 접힘·펼침 높이, 포인터 드래그와 배경 스크롤 잠금을 관리한다. */
import { useEffect, useRef, useState } from "react";
import type { PointerEventHandler } from "react";

type SheetSnap = "collapsed" | "expanded";

type UsePlaceSheetLayoutParams = {

  isSheetOpen: boolean;

  onRequestClose: () => void;

  resetVersion?: number;
};

const DRAG_SNAP_THRESHOLD_PX = 48;
const DRAG_CLOSE_THRESHOLD_PX = 72;
const COLLAPSED_DRAG_OVERSCROLL_PX = 132;
const COLLAPSED_CONTENT_MIN_HEIGHT_PX = 452;
const COLLAPSED_CONTENT_MAX_HEIGHT_PX = 472;

function getSheetTop(viewportHeight: number, snap: SheetSnap) {
  const safeTop = typeof window === "undefined" ? 0 : window.visualViewport?.offsetTop ?? 0;
  const expandedTop = Math.max(safeTop, 0);
  const maxCollapsedHeight = Math.max(360, viewportHeight - expandedTop - 180);
  const collapsedHeight = Math.min(
    maxCollapsedHeight,
    Math.max(
      COLLAPSED_CONTENT_MIN_HEIGHT_PX,
      Math.min(COLLAPSED_CONTENT_MAX_HEIGHT_PX, viewportHeight * 0.46)
    )
  );
  const collapsedTop = Math.max(expandedTop + 180, viewportHeight - collapsedHeight);
  return snap === "expanded" ? expandedTop : collapsedTop;
}

/**
 * viewport와 safe area를 기준으로 두 snap 위치를 계산한다. 헤더 드래그 거리와 속도로 snap 또는 닫기를 결정하고,
 * 열린 동안 body 스크롤을 잠근다. resetVersion이 바뀌면 접힌 상태와 스크롤 위치로 초기화한다.
 */
export function usePlaceSheetLayout({
  isSheetOpen,
  onRequestClose,
  resetVersion = 0,
}: UsePlaceSheetLayoutParams) {
  const [viewportHeight, setViewportHeight] = useState(() =>
    typeof window === "undefined" ? 800 : window.innerHeight
  );
  const [sheetSnap, setSheetSnap] = useState<SheetSnap>("collapsed");
  const [sheetTop, setSheetTop] = useState(() =>
    getSheetTop(typeof window === "undefined" ? 800 : window.innerHeight, "collapsed")
  );
  const [isDraggingSheet, setIsDraggingSheet] = useState(false);
  const sheetSnapRef = useRef<SheetSnap>("collapsed");
  const sheetTopRef = useRef(sheetTop);
  const wasSheetOpenRef = useRef(false);
  const lastResetVersionRef = useRef(resetVersion);
  const dragStateRef = useRef<{
    active: boolean;
    pointerId: number | null;
    startY: number;
    startTop: number;
    startSnap: SheetSnap;
  }>({
    active: false,
    pointerId: null,
    startY: 0,
    startTop: 0,
    startSnap: "collapsed",
  });

  const isSheetExpanded = sheetSnap === "expanded";
  const collapsedTop = getSheetTop(viewportHeight, "collapsed");
  const showOverviewPanel =
    sheetSnap === "expanded" || sheetTop < collapsedTop - DRAG_SNAP_THRESHOLD_PX * 0.6;

  useEffect(() => {
    const onResize = () => {
      const nextViewportHeight = window.innerHeight;
      const nextTop = getSheetTop(nextViewportHeight, sheetSnapRef.current);
      setViewportHeight(nextViewportHeight);
      setSheetTop(nextTop);
      sheetTopRef.current = nextTop;
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (resetVersion !== lastResetVersionRef.current) {
      const nextTop = getSheetTop(viewportHeight, "collapsed");
      setSheetSnap("collapsed");
      sheetSnapRef.current = "collapsed";
      setIsDraggingSheet(false);
      setSheetTop(nextTop);
      sheetTopRef.current = nextTop;
      lastResetVersionRef.current = resetVersion;
    }
  }, [resetVersion, viewportHeight]);

  useEffect(() => {
    if (isSheetOpen && !wasSheetOpenRef.current) {
      const collapsedTop = getSheetTop(viewportHeight, "collapsed");
      setSheetSnap("collapsed");
      sheetSnapRef.current = "collapsed";
      setIsDraggingSheet(false);
      setSheetTop(collapsedTop);
      sheetTopRef.current = collapsedTop;
    }

    wasSheetOpenRef.current = isSheetOpen;
  }, [isSheetOpen, viewportHeight]);

  useEffect(() => {
    sheetTopRef.current = sheetTop;
  }, [sheetTop]);

  const resetSheetLayout = () => {
    setSheetSnap("collapsed");
    sheetSnapRef.current = "collapsed";
    setIsDraggingSheet(false);
    setSheetTop(getSheetTop(viewportHeight, "collapsed"));
  };

  const collapseSheet = () => {
    setSheetSnap("collapsed");
    sheetSnapRef.current = "collapsed";
    setSheetTop(getSheetTop(viewportHeight, "collapsed"));
  };

  const handleSheetPointerDown: PointerEventHandler<HTMLDivElement> = (event) => {
    if (!isSheetOpen) {
      return;
    }

    dragStateRef.current = {
      active: true,
      pointerId: event.pointerId,
      startY: event.clientY,
      startTop: sheetTop,
      startSnap: sheetSnap,
    };
    setIsDraggingSheet(true);
  };

  const handleSheetPointerMove: PointerEventHandler<HTMLDivElement> = (event) => {
    const dragState = dragStateRef.current;
    if (!dragState.active || dragState.pointerId !== event.pointerId) {
      return;
    }

    const expandedTop = getSheetTop(viewportHeight, "expanded");
    const collapsedTop = getSheetTop(viewportHeight, "collapsed");
    const maxTop =
      dragState.startSnap === "collapsed"
        ? collapsedTop + COLLAPSED_DRAG_OVERSCROLL_PX
        : collapsedTop;
    const nextTop = Math.min(
      maxTop,
      Math.max(expandedTop, dragState.startTop + (event.clientY - dragState.startY))
    );

    setSheetTop(nextTop);
    sheetTopRef.current = nextTop;
  };

  const handleSheetPointerUp: PointerEventHandler<HTMLDivElement> = (event) => {
    const dragState = dragStateRef.current;
    if (!dragState.active || dragState.pointerId !== event.pointerId) {
      return;
    }

    dragStateRef.current = {
      active: false,
      pointerId: null,
      startY: 0,
      startTop: 0,
      startSnap: "collapsed",
    };
    setIsDraggingSheet(false);

    const expandedTop = getSheetTop(viewportHeight, "expanded");
    const collapsedTop = getSheetTop(viewportHeight, "collapsed");
    const currentTop = sheetTopRef.current;
    const movedDistance = currentTop - dragState.startTop;
    const movedUpEnough = movedDistance < -DRAG_SNAP_THRESHOLD_PX;
    const movedDownEnough = movedDistance > DRAG_SNAP_THRESHOLD_PX;

    if (dragState.startSnap === "collapsed" && movedDistance > DRAG_CLOSE_THRESHOLD_PX) {
      onRequestClose();
      resetSheetLayout();
      return;
    }

    const midpoint = expandedTop + (collapsedTop - expandedTop) / 2;
    let nextSnap: SheetSnap;
    if (dragState.startSnap === "collapsed") {
      nextSnap = movedUpEnough || currentTop < midpoint ? "expanded" : "collapsed";
    } else {
      nextSnap = movedDownEnough || currentTop > midpoint ? "collapsed" : "expanded";
    }

    setSheetSnap(nextSnap);
    sheetSnapRef.current = nextSnap;
    setSheetTop(getSheetTop(viewportHeight, nextSnap));
  };

  return {
    isSheetExpanded,
    isDraggingSheet,
    sheetTop,
    showOverviewPanel,
    resetSheetLayout,
    collapseSheet,
    handleSheetPointerDown,
    handleSheetPointerMove,
    handleSheetPointerUp,
  };
}
