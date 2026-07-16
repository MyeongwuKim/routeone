import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type PointerEvent as ReactPointerEvent,
  type SetStateAction,
} from "react";
import type { MyRouteStop } from "../types";

export type DraggedStop = {
  stop: MyRouteStop;
  fromIndex: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  isActive: boolean;
};

function moveStop(stops: MyRouteStop[], fromIndex: number, toIndex: number) {
  const nextStops = [...stops];
  const [movedStop] = nextStops.splice(fromIndex, 1);

  if (!movedStop) {
    return stops;
  }

  const adjustedIndex = toIndex > fromIndex ? toIndex - 1 : toIndex;
  const safeIndex = Math.max(0, Math.min(adjustedIndex, nextStops.length));
  nextStops.splice(safeIndex, 0, movedStop);

  return nextStops;
}

type UseRouteStopDragOptions = {
  isOrderEditing: boolean;
  orderedStops: MyRouteStop[];
  setOrderedStops: Dispatch<SetStateAction<MyRouteStop[]>>;
};

export function useRouteStopDrag({
  isOrderEditing,
  orderedStops,
  setOrderedStops,
}: UseRouteStopDragOptions) {
  const dropZoneRefs = useRef<Array<HTMLDivElement | null>>([]);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const draggedStopRef = useRef<DraggedStop | null>(null);
  const pendingDragRenderRef = useRef<DraggedStop | null>(null);
  const dragFrameRef = useRef<number | null>(null);
  const [draggedStop, setDraggedStop] = useState<DraggedStop | null>(null);
  const [activeDropIndex, setActiveDropIndex] = useState<number | null>(null);

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
    setActiveDropIndex(null);
  };

  const resetDropZones = () => {
    dropZoneRefs.current = [];
  };

  const registerDropZone = (index: number, node: HTMLDivElement | null) => {
    dropZoneRefs.current[index] = node;
  };

  const getDropIndexAtPoint = (clientY: number) => {
    for (let index = 0; index < orderedStops.length; index += 1) {
      const node = dropZoneRefs.current[index];

      if (!node) {
        continue;
      }

      const rect = node.getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) {
        return index;
      }
    }

    return orderedStops.length;
  };

  const startDragStop = ({
    stop,
    fromIndex,
    event,
  }: {
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
      fromIndex,
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      isActive: false,
    };
    draggedStopRef.current = initialDraggedStop;
    setDraggedStop(initialDraggedStop);
    setActiveDropIndex(null);

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
          setActiveDropIndex(getDropIndexAtPoint(pendingDraggedStop.y));
        });
      }
    };

    const handlePointerEnd = (pointerEvent: PointerEvent) => {
      if (!isCurrentPointer(pointerEvent)) {
        return;
      }

      const currentDraggedStop = draggedStopRef.current;

      if (!currentDraggedStop) {
        stopCurrentDrag();
        return;
      }

      if (currentDraggedStop.isActive) {
        pointerEvent.preventDefault();
        const dropIndex = getDropIndexAtPoint(pointerEvent.clientY);
        setOrderedStops((currentStops) =>
          moveStop(currentStops, currentDraggedStop.fromIndex, dropIndex)
        );
      }

      stopCurrentDrag();
    };

    const handleLostPointerCapture = (pointerEvent: PointerEvent) => {
      if (isCurrentPointer(pointerEvent)) {
        stopCurrentDrag();
      }
    };

    window.addEventListener("pointermove", handlePointerMove, {
      passive: false,
    });
    window.addEventListener("pointerup", handlePointerEnd, { once: true });
    window.addEventListener("pointercancel", handlePointerEnd, { once: true });
    pointerCaptureTarget?.addEventListener(
      "lostpointercapture",
      handleLostPointerCapture
    );

    dragCleanupRef.current = () => {
      if (pointerCaptureTarget?.hasPointerCapture?.(event.pointerId)) {
        try {
          pointerCaptureTarget.releasePointerCapture(event.pointerId);
        } catch {
          // Pointer capture can already be released.
        }
      }
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
      pointerCaptureTarget?.removeEventListener(
        "lostpointercapture",
        handleLostPointerCapture
      );
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
    activeDropIndex,
    draggedStop,
    registerDropZone,
    resetDropZones,
    startDragStop,
    stopCurrentDrag,
  };
}
