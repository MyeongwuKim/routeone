/**
 * 용도:
 * GPS 테스트 지도에서 위치 선택, 목적지까지 가상 이동, 실제 GPS 복귀를 관리한다.
 *
 * 동작 방식:
 * 선택 좌표를 바로 적용하며 연속 입력은 마지막 좌표까지 순서대로 반영한다.
 * 가상 이동은 적용된 좌표에서 시작하고, 늦게 도착한 최초 GPS 조회는 새 선택을 덮지 않는다.
 */
import { useEffect, useRef, useState } from "react";
import {
  nativeBridge,
  type NativeArrivalTestLocationResult,
} from "@/native-bridge";
import { useUiText } from "@/lib/uiText";
import type { VisitCompletionTarget } from "../models/dayRouteDialogTypes";
import {
  createAutoWalkSteps,
  type TestLocation,
} from "../utils/gpsTestLocation";

export type GpsTestLocationActions = {
  onApply: (
    target: VisitCompletionTarget,
    position: TestLocation,
    options?: {
      showSuccessToast?: boolean;
      notificationWasScheduledEarlier?: boolean;
    }
  ) => Promise<NativeArrivalTestLocationResult | null>;
  onClear: () => Promise<NativeArrivalTestLocationResult | null>;
};

type GpsTestLocationOptions = GpsTestLocationActions & {
  target: VisitCompletionTarget;
  activeLocation: TestLocation | null;
};

type Operation = "apply" | "walk" | "restore" | null;

export function useGpsTestLocation({
  target,
  activeLocation,
  onApply,
  onClear,
}: GpsTestLocationOptions) {
  const text = useUiText();
  const [initialLocation] = useState(activeLocation);
  const [location, setLocation] = useState(initialLocation);
  const [isResolving, setIsResolving] = useState(!initialLocation);
  const [error, setError] = useState<string | null>(null);
  const [operation, setOperation] = useState<Operation>(null);
  const [walkProgress, setWalkProgress] = useState<{
    current: number;
    total: number;
    distanceMeters: number;
  } | null>(null);
  const locationRef = useRef(initialLocation);
  const appliedLocationRef = useRef(initialLocation);
  const operationRef = useRef<Operation>(null);
  const pendingLocationRef = useRef<TestLocation | null>(null);
  const interactionRevisionRef = useRef(0);
  const mountedRef = useRef(false);
  const actionsRef = useRef({ onApply, onClear });

  useEffect(() => {
    actionsRef.current = { onApply, onClear };
  }, [onApply, onClear]);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;
    const revision = interactionRevisionRef.current;
    const isCurrent = () =>
      !cancelled && revision === interactionRevisionRef.current;

    if (!initialLocation) {
      // 테스트 좌표가 네이티브에 남아 있다면 그 좌표를 읽는다. 실제 GPS로 강제 전환하지 않는다.
      const request = nativeBridge.location.getCurrentPosition({
        forceRefresh: true,
      });
      const positionRequest = request ?? Promise.reject(
        new Error(text.dayRoute.gpsTestLocationUnavailable)
      );
      void positionRequest
        .then((position) => {
          if (!isCurrent()) return;
          const nextLocation = { lat: position.lat, lng: position.lng };
          locationRef.current = nextLocation;
          appliedLocationRef.current = nextLocation;
          setLocation(nextLocation);
        })
        .catch(() => {
          if (isCurrent()) setError(text.dayRoute.gpsTestLocationUnavailable);
        })
        .finally(() => {
          if (isCurrent()) setIsResolving(false);
        });
    }

    return () => {
      cancelled = true;
      mountedRef.current = false;
      interactionRevisionRef.current += 1;
      pendingLocationRef.current = null;
    };
  }, [initialLocation, text.dayRoute.gpsTestLocationUnavailable]);

  const updateLocation = (position: TestLocation | null) => {
    locationRef.current = position;
    setLocation(position);
  };
  const updateOperation = (next: Operation) => {
    operationRef.current = next;
    if (mountedRef.current) setOperation(next);
  };

  const handleSelectLocation = async (position: TestLocation) => {
    if (operationRef.current === "walk" || operationRef.current === "restore") {
      return;
    }
    interactionRevisionRef.current += 1;
    setIsResolving(false);
    setError(null);
    setWalkProgress(null);
    updateLocation(position);
    pendingLocationRef.current = position;
    if (operationRef.current === "apply") return;

    updateOperation("apply");
    try {
      while (pendingLocationRef.current && mountedRef.current) {
        const nextPosition = pendingLocationRef.current;
        pendingLocationRef.current = null;
        const result = await actionsRef.current
          .onApply(target, nextPosition, { showSuccessToast: false })
          .catch(() => null);
        if (!mountedRef.current) return;
        if (result?.lat != null && result.lng != null) {
          appliedLocationRef.current = { lat: result.lat, lng: result.lng };
          if (!pendingLocationRef.current) {
            updateLocation(appliedLocationRef.current);
            setError(null);
          }
        } else if (!pendingLocationRef.current) {
          updateLocation(appliedLocationRef.current);
          setError(text.dayRoute.gpsTestMoveFailed);
        }
      }
    } finally {
      updateOperation(null);
    }
  };

  const handleAutoWalk = async () => {
    const start = locationRef.current;
    if (operationRef.current || !start) return;
    const revision = ++interactionRevisionRef.current;
    const isCurrent = () =>
      mountedRef.current && interactionRevisionRef.current === revision;
    const steps = createAutoWalkSteps(start, target.stop.place);
    updateOperation("walk");
    setError(null);
    let notificationWasScheduled = false;

    try {
      for (const [index, step] of steps.entries()) {
        if (!isCurrent()) return;
        const result: NativeArrivalTestLocationResult | null =
          await actionsRef.current
            .onApply(target, step.position, {
              showSuccessToast: index === steps.length - 1,
              notificationWasScheduledEarlier: notificationWasScheduled,
            })
            .catch(() => null);
        if (!isCurrent()) return;
        if (!result || result.lat == null || result.lng == null) {
          setError(text.dayRoute.gpsTestMoveFailed);
          return;
        }
        appliedLocationRef.current = { lat: result.lat, lng: result.lng };
        updateLocation(appliedLocationRef.current);
        setWalkProgress({
          current: index + 1,
          total: steps.length,
          distanceMeters: step.distanceMeters,
        });
        notificationWasScheduled ||= result.notificationScheduled;
        if (index < steps.length - 1) {
          await new Promise<void>((resolve) => window.setTimeout(resolve, 700));
        }
      }
    } finally {
      if (isCurrent()) updateOperation(null);
    }
  };

  const handleRestoreLocation = async () => {
    if (operationRef.current) return;
    interactionRevisionRef.current += 1;
    updateOperation("restore");
    setIsResolving(false);
    setError(null);
    setWalkProgress(null);
    appliedLocationRef.current = null;
    updateLocation(null);
    try {
      const result = await actionsRef.current.onClear().catch(() => null);
      if (!mountedRef.current) return;
      if (result?.lat != null && result.lng != null) {
        appliedLocationRef.current = { lat: result.lat, lng: result.lng };
        updateLocation(appliedLocationRef.current);
      } else {
        setError(text.dayRoute.gpsTestRealLocationUnavailable);
      }
    } finally {
      updateOperation(null);
    }
  };

  return {
    location,
    isResolving,
    error,
    operation,
    walkProgress,
    handleSelectLocation,
    handleAutoWalk,
    handleRestoreLocation,
  };
}
