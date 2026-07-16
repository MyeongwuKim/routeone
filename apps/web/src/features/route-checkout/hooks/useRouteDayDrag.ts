import { useEffect, useReducer, useRef } from "react";
import {
  INITIAL_ROUTE_DRAG_STATE,
  moveDayItem,
  routeDragReducer,
  type AdjacentMoveDirection,
  type DragStartPayload,
  type DraggedDayItem,
} from "../models/routeDayCardModel";
import type { PlannedRouteDay, PlannedRouteItem } from "../models/routePlanTypes";

type UseRouteDayDragOptions = {
  day: PlannedRouteDay;
  previousDay: PlannedRouteDay | null;
  nextDay: PlannedRouteDay | null;
  isOrderEditing: boolean;
  onReorderDayItems: (
    dayNumber: number,
    nextItems: PlannedRouteItem[]
  ) => void;
  onMovePlaceToDay: (
    placeId: string,
    targetDayNumber: number,
    position: "first" | "last"
  ) => void;
};

export function useRouteDayDrag({
  day,
  previousDay,
  nextDay,
  isOrderEditing,
  onReorderDayItems,
  onMovePlaceToDay,
}: UseRouteDayDragOptions) {
  const [dragState, dispatchDrag] = useReducer(
    routeDragReducer,
    INITIAL_ROUTE_DRAG_STATE
  );
  const { draggedItem, activeDropIndex, activeMoveDirection } = dragState;
  const dropZoneRefs = useRef(new Map<number, HTMLDivElement>());
  const previousDayDropZoneRef = useRef<HTMLDivElement | null>(null);
  const nextDayDropZoneRef = useRef<HTMLDivElement | null>(null);
  const draggedItemRef = useRef<DraggedDayItem | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);

  const stopCurrentDrag = () => {
    dragCleanupRef.current?.();
    dragCleanupRef.current = null;
    draggedItemRef.current = null;
    dispatchDrag({ type: "reset" });
  };

  const registerDropZone = (
    targetIndex: number,
    node: HTMLDivElement | null
  ) => {
    if (node) {
      dropZoneRefs.current.set(targetIndex, node);
    } else {
      dropZoneRefs.current.delete(targetIndex);
    }
  };

  const getDropIndexAtPoint = (x: number, y: number) => {
    let matchedIndex: number | null = null;
    let matchedDistance = Number.POSITIVE_INFINITY;

    dropZoneRefs.current.forEach((node, targetIndex) => {
      const rect = node.getBoundingClientRect();
      const isSegmentDropZone =
        node.dataset.routeDropZoneKind === "segment";
      const centerX = rect.left + rect.width / 2;
      const centerY = isSegmentDropZone
        ? rect.top
        : rect.top + rect.height / 2;
      const distance = Math.hypot(centerX - x, centerY - y);
      const isInside = isSegmentDropZone
        ? distance <= 24
        : x >= rect.left &&
          x <= rect.right &&
          y >= rect.top &&
          y <= rect.bottom;

      if (isInside && distance < matchedDistance) {
        matchedIndex = targetIndex;
        matchedDistance = distance;
      }
    });

    return matchedIndex;
  };

  const getAdjacentMoveDirectionAtPoint = (
    x: number,
    y: number
  ): AdjacentMoveDirection | null => {
    const adjacentZones: Array<{
      direction: AdjacentMoveDirection;
      node: HTMLDivElement | null;
    }> = [
      { direction: "previous", node: previousDayDropZoneRef.current },
      { direction: "next", node: nextDayDropZoneRef.current },
    ];

    for (const zone of adjacentZones) {
      if (!zone.node) {
        continue;
      }

      const rect = zone.node.getBoundingClientRect();
      if (
        x >= rect.left &&
        x <= rect.right &&
        y >= rect.top &&
        y <= rect.bottom
      ) {
        return zone.direction;
      }
    }

    return null;
  };

  const moveDraggedItemToAdjacentDay = (
    item: PlannedRouteItem,
    direction: AdjacentMoveDirection
  ) => {
    const targetDay = direction === "previous" ? previousDay : nextDay;
    if (!targetDay) {
      return false;
    }

    onMovePlaceToDay(
      item.place.id,
      targetDay.day,
      direction === "previous" ? "last" : "first"
    );
    return true;
  };

  const handleDropRouteItem = (targetIndex: number) => {
    if (!draggedItem) {
      return;
    }

    onReorderDayItems(
      day.day,
      moveDayItem(day.items, draggedItem.itemIndex, targetIndex)
    );
    stopCurrentDrag();
  };

  const handleDropAdjacentDay = (direction: AdjacentMoveDirection) => {
    if (!draggedItem) {
      return;
    }

    moveDraggedItemToAdjacentDay(draggedItem.item, direction);
    stopCurrentDrag();
  };

  const startDragItem = ({
    itemIndex,
    item,
    clientX,
    clientY,
    button,
    captureTarget,
    pointerId,
  }: DragStartPayload) => {
    if (button !== 0) {
      return;
    }

    let pointerCaptureTarget: HTMLElement | null = null;
    if (pointerId != null && captureTarget.setPointerCapture) {
      try {
        captureTarget.setPointerCapture(pointerId);
        pointerCaptureTarget = captureTarget;
      } catch {
        pointerCaptureTarget = null;
      }
    }
    dragCleanupRef.current?.();

    const initialDraggedItem: DraggedDayItem = {
      itemIndex,
      item,
      startX: clientX,
      startY: clientY,
      x: clientX,
      y: clientY,
      isActive: false,
    };
    draggedItemRef.current = initialDraggedItem;
    dispatchDrag({ type: "start", draggedItem: initialDraggedItem });

    const isCurrentDragPointer = (event: PointerEvent) =>
      pointerId == null || event.pointerId === pointerId;

    const handleDragMove = (moveEvent: PointerEvent) => {
      if (!isCurrentDragPointer(moveEvent)) {
        return;
      }

      const currentDraggedItem = draggedItemRef.current;
      if (!currentDraggedItem) {
        return;
      }

      const moveDistance = Math.hypot(
        moveEvent.clientX - currentDraggedItem.startX,
        moveEvent.clientY - currentDraggedItem.startY
      );
      if (!currentDraggedItem.isActive && moveDistance < 6) {
        return;
      }

      moveEvent.preventDefault();
      const nextDraggedItem = {
        ...currentDraggedItem,
        x: moveEvent.clientX,
        y: moveEvent.clientY,
        isActive: true,
      };
      draggedItemRef.current = nextDraggedItem;
      const moveDirection = getAdjacentMoveDirectionAtPoint(
        moveEvent.clientX,
        moveEvent.clientY
      );
      dispatchDrag({
        type: "move",
        draggedItem: nextDraggedItem,
        activeMoveDirection: moveDirection,
        activeDropIndex: moveDirection
          ? null
          : getDropIndexAtPoint(moveEvent.clientX, moveEvent.clientY),
      });
    };

    const handleDragEnd = (upEvent: PointerEvent) => {
      if (!isCurrentDragPointer(upEvent)) {
        return;
      }

      const currentDraggedItem = draggedItemRef.current;
      if (!currentDraggedItem || !currentDraggedItem.isActive) {
        stopCurrentDrag();
        return;
      }

      upEvent.preventDefault();
      const moveDirection = getAdjacentMoveDirectionAtPoint(
        upEvent.clientX,
        upEvent.clientY
      );
      const didMoveToAdjacentDay = moveDirection
        ? moveDraggedItemToAdjacentDay(currentDraggedItem.item, moveDirection)
        : false;
      const targetIndex = didMoveToAdjacentDay
        ? null
        : getDropIndexAtPoint(upEvent.clientX, upEvent.clientY);

      if (targetIndex != null) {
        onReorderDayItems(
          day.day,
          moveDayItem(day.items, currentDraggedItem.itemIndex, targetIndex)
        );
      }
      stopCurrentDrag();
    };

    const handleLostPointerCapture = (event: PointerEvent) => {
      if (isCurrentDragPointer(event)) {
        stopCurrentDrag();
      }
    };

    window.addEventListener("pointermove", handleDragMove, {
      passive: false,
    });
    window.addEventListener("pointerup", handleDragEnd, { once: true });
    window.addEventListener("pointercancel", handleDragEnd, { once: true });
    pointerCaptureTarget?.addEventListener(
      "lostpointercapture",
      handleLostPointerCapture
    );

    dragCleanupRef.current = () => {
      if (
        pointerId != null &&
        pointerCaptureTarget?.hasPointerCapture?.(pointerId)
      ) {
        try {
          pointerCaptureTarget.releasePointerCapture(pointerId);
        } catch {
          // Pointer capture can already be released by the browser.
        }
      }
      window.removeEventListener("pointermove", handleDragMove);
      window.removeEventListener("pointerup", handleDragEnd);
      window.removeEventListener("pointercancel", handleDragEnd);
      pointerCaptureTarget?.removeEventListener(
        "lostpointercapture",
        handleLostPointerCapture
      );
    };
  };

  useEffect(() => {
    if (!isOrderEditing) {
      stopCurrentDrag();
    }
  }, [isOrderEditing]);

  useEffect(() => {
    return () => {
      dragCleanupRef.current?.();
    };
  }, []);

  return {
    activeDropIndex,
    activeMoveDirection,
    draggedItem,
    handleDropAdjacentDay,
    handleDropRouteItem,
    nextDayDropZoneRef,
    previousDayDropZoneRef,
    registerDropZone,
    startDragItem,
    stopCurrentDrag,
  };
}
