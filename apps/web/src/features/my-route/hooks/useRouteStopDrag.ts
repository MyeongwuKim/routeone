import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type PointerEvent as ReactPointerEvent,
  type SetStateAction,
} from "react";
import type { MyRouteStop } from "../types";

export type RouteStopsByDayId = Record<string, MyRouteStop[]>;

export type DraggedStop = {
  stop: MyRouteStop;
  fromDayId: string;
  fromIndex: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  isActive: boolean;
};

export type RouteStopDropTarget = {
  dayId: string;
  index: number;
};

type DropZone = RouteStopDropTarget & {
  node: HTMLDivElement;
};

type UseRouteStopDragOptions = {
  isOrderEditing: boolean;
  stopsByDayId: RouteStopsByDayId;
  setStopsByDayId: Dispatch<SetStateAction<RouteStopsByDayId>>;
};

function moveStop(
  stopsByDayId: RouteStopsByDayId,
  draggedStop: DraggedStop,
  target: RouteStopDropTarget
) {
  const sourceStops = stopsByDayId[draggedStop.fromDayId] ?? [];
  const sourceIndex = sourceStops.findIndex(
    (stop) => stop.id === draggedStop.stop.id
  );

  if (sourceIndex < 0) {
    return stopsByDayId;
  }

  const nextSourceStops = [...sourceStops];
  const [movedStop] = nextSourceStops.splice(sourceIndex, 1);

  if (!movedStop) {
    return stopsByDayId;
  }

  if (draggedStop.fromDayId === target.dayId) {
    const adjustedIndex =
      target.index > sourceIndex ? target.index - 1 : target.index;
    const safeIndex = Math.max(
      0,
      Math.min(adjustedIndex, nextSourceStops.length)
    );
    nextSourceStops.splice(safeIndex, 0, movedStop);

    return {
      ...stopsByDayId,
      [target.dayId]: nextSourceStops,
    };
  }

  const targetStops = [...(stopsByDayId[target.dayId] ?? [])];
  const safeTargetIndex = Math.max(
    0,
    Math.min(target.index, targetStops.length)
  );
  targetStops.splice(safeTargetIndex, 0, movedStop);

  return {
    ...stopsByDayId,
    [draggedStop.fromDayId]: nextSourceStops,
    [target.dayId]: targetStops,
  };
}

export function useRouteStopDrag({
  isOrderEditing,
  stopsByDayId,
  setStopsByDayId,
}: UseRouteStopDragOptions) {
  const dropZoneRefs = useRef(new Map<string, DropZone>());
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const draggedStopRef = useRef<DraggedStop | null>(null);
  const pendingDragRenderRef = useRef<DraggedStop | null>(null);
  const dragFrameRef = useRef<number | null>(null);
  const [draggedStop, setDraggedStop] = useState<DraggedStop | null>(null);
  const [activeDropTarget, setActiveDropTarget] =
    useState<RouteStopDropTarget | null>(null);

  const stopCurrentDrag = () => {
    dragCleanupRef.current?.();
    dragCleanupRef.current = null;
    if (dragFrameRef.current != null) {
      window.cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
    }
    pendingDragRenderRef.current = null;
    draggedStopRef.current = null;
    setDraggedStop(null);
    setActiveDropTarget(null);
  };

  const resetDropZones = () => {
    dropZoneRefs.current.clear();
  };

  const registerDropZone = (
    dayId: string,
    index: number,
    node: HTMLDivElement | null
  ) => {
    const key = `${dayId}:${index}`;

    if (node) {
      dropZoneRefs.current.set(key, { dayId, index, node });
    } else {
      dropZoneRefs.current.delete(key);
    }
  };

  const getDropTargetAtPoint = (clientX: number, clientY: number) => {
    let matchedTarget: RouteStopDropTarget | null = null;
    let matchedDistance = Number.POSITIVE_INFINITY;

    dropZoneRefs.current.forEach(({ dayId, index, node }) => {
      const rect = node.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const isInside =
        clientX >= rect.left - 20 &&
        clientX <= rect.right + 20 &&
        clientY >= rect.top - 12 &&
        clientY <= rect.bottom + 12;

      if (!isInside) {
        return;
      }

      const distance = Math.hypot(centerX - clientX, centerY - clientY);
      if (distance >= matchedDistance) {
        return;
      }

      const dayStopCount = stopsByDayId[dayId]?.length ?? 0;
      const targetIndex = Math.min(
        clientY > centerY ? index + 1 : index,
        dayStopCount
      );
      matchedTarget = { dayId, index: targetIndex };
      matchedDistance = distance;
    });

    return matchedTarget;
  };

  const startDragStop = ({
    dayId,
    stop,
    fromIndex,
    event,
  }: {
    dayId: string;
    stop: MyRouteStop;
    fromIndex: number;
    event: ReactPointerEvent<HTMLButtonElement>;
  }) => {
    if (!isOrderEditing || event.button !== 0) {
      return;
    }

    let pointerCaptureTarget: HTMLElement | null = event.currentTarget;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      pointerCaptureTarget = null;
    }

    dragCleanupRef.current?.();
    const initialDraggedStop: DraggedStop = {
      stop,
      fromDayId: dayId,
      fromIndex,
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      isActive: false,
    };
    draggedStopRef.current = initialDraggedStop;
    setDraggedStop(initialDraggedStop);
    setActiveDropTarget(null);

    const isCurrentPointer = (pointerEvent: PointerEvent) =>
      pointerEvent.pointerId === event.pointerId;

    const handlePointerMove = (pointerEvent: PointerEvent) => {
      if (!isCurrentPointer(pointerEvent)) {
        return;
      }

      const currentDraggedStop = draggedStopRef.current;
      if (!currentDraggedStop) {
        return;
      }

      const moveDistance = Math.hypot(
        pointerEvent.clientX - currentDraggedStop.startX,
        pointerEvent.clientY - currentDraggedStop.startY
      );

      if (!currentDraggedStop.isActive && moveDistance < 6) {
        return;
      }

      pointerEvent.preventDefault();
      const nextDraggedStop = {
        ...currentDraggedStop,
        x: pointerEvent.clientX,
        y: pointerEvent.clientY,
        isActive: true,
      };
      draggedStopRef.current = nextDraggedStop;
      pendingDragRenderRef.current = nextDraggedStop;

      if (dragFrameRef.current == null) {
        dragFrameRef.current = window.requestAnimationFrame(() => {
          dragFrameRef.current = null;
          const pendingDraggedStop = pendingDragRenderRef.current;

          if (!pendingDraggedStop) {
            return;
          }

          pendingDragRenderRef.current = null;
          setDraggedStop(pendingDraggedStop);
          setActiveDropTarget(
            getDropTargetAtPoint(
              pendingDraggedStop.x,
              pendingDraggedStop.y
            )
          );
        });
      }
    };

    const handlePointerUp = (pointerEvent: PointerEvent) => {
      if (!isCurrentPointer(pointerEvent)) {
        return;
      }

      const currentDraggedStop = draggedStopRef.current;
      if (currentDraggedStop?.isActive) {
        pointerEvent.preventDefault();
        const dropTarget = getDropTargetAtPoint(
          pointerEvent.clientX,
          pointerEvent.clientY
        );

        if (dropTarget) {
          setStopsByDayId((currentStops) =>
            moveStop(currentStops, currentDraggedStop, dropTarget)
          );
        }
      }

      stopCurrentDrag();
    };

    const handlePointerCancel = (pointerEvent: PointerEvent) => {
      if (isCurrentPointer(pointerEvent)) {
        stopCurrentDrag();
      }
    };

    window.addEventListener("pointermove", handlePointerMove, {
      passive: false,
    });
    window.addEventListener("pointerup", handlePointerUp, { once: true });
    window.addEventListener("pointercancel", handlePointerCancel, {
      once: true,
    });

    dragCleanupRef.current = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);

      if (pointerCaptureTarget?.hasPointerCapture?.(event.pointerId)) {
        try {
          pointerCaptureTarget.releasePointerCapture(event.pointerId);
        } catch {
          // Pointer capture can already be released.
        }
      }
    };
  };

  useEffect(() => {
    return () => {
      dragCleanupRef.current?.();
      if (dragFrameRef.current != null) {
        window.cancelAnimationFrame(dragFrameRef.current);
      }
    };
  }, []);

  return {
    activeDropTarget,
    draggedStop,
    registerDropZone,
    resetDropZones,
    startDragStop,
    stopCurrentDrag,
  };
}
