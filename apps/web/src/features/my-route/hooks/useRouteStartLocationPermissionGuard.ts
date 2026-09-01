/**
 * 용도:
 * 여행 시작 직전 위치 권한을 확인하고 권한이 없을 때 사용자의 선택을 받는 훅이다.
 *
 * 동작 방식:
 * 권한이 있으면 기존 시작 동작을 실행하고, 권한이 없으면 설정 이동 또는
 * 위치 기능 없이 시작하는 선택지를 제공한다. 설정에서 돌아왔다고 여행을 자동 시작하지 않는다.
 */
import { useCallback, useRef, useState } from "react";
import { getRouteStartLocationPermissionState } from "../services/routeStartLocationPermissionService";
import type { MyRoute } from "../types";
import { nativeBridge } from "@/native-bridge";
import { useUiText } from "@/lib/uiText";
import { useUiModalStore } from "@/stores/uiModalStore";
import { useUiToastStore } from "@/stores/uiToastStore";

export type RouteStartRequest = {
  route: MyRoute;
  startedAt: string;
  dayStartedAt: string;
};

export type RouteStartOptions = {
  startWithoutLocationPermission: boolean;
};

type UseRouteStartLocationPermissionGuardOptions = {
  isStartPending: boolean;
  onStart: (
    request: RouteStartRequest,
    options: RouteStartOptions
  ) => void;
  onCancel?: (request: RouteStartRequest) => void;
};

export function useRouteStartLocationPermissionGuard({
  isStartPending,
  onStart,
  onCancel,
}: UseRouteStartLocationPermissionGuardOptions) {
  const text = useUiText();
  const openModal = useUiModalStore((state) => state.openModal);
  const showToast = useUiToastStore((state) => state.showToast);
  const permissionLookupInFlightRef = useRef(false);
  const [isPermissionLookupPending, setIsPermissionLookupPending] =
    useState(false);

  const requestRouteStart = useCallback(
    async (request: RouteStartRequest) => {
      if (isStartPending || permissionLookupInFlightRef.current) {
        return;
      }

      permissionLookupInFlightRef.current = true;
      setIsPermissionLookupPending(true);

      try {
        const permissionState =
          await getRouteStartLocationPermissionState();

        if (permissionState !== "denied") {
          onStart(request, {
            startWithoutLocationPermission: false,
          });
          return;
        }

        let didContinueStart = false;
        let didCancelStart = false;
        const cancelStartOnce = () => {
          if (didContinueStart || didCancelStart) {
            return;
          }

          didCancelStart = true;
          onCancel?.(request);
        };

        openModal({
          title: text.myRoute.locationPermissionWarningTitle,
          description: text.myRoute.locationPermissionWarningDescription,
          onDismiss: cancelStartOnce,
          actions: [
            {
              label: text.myRoute.startWithoutLocationPermission,
              variant: "secondary",
              onClick: () => {
                didContinueStart = true;
                onStart(request, {
                  startWithoutLocationPermission: true,
                });
              },
            },
            {
              label: text.myRoute.openLocationSettings,
              variant: "primary",
              onClick: () => {
                cancelStartOnce();
                if (!nativeBridge.permissions.openSettings()) {
                  showToast(text.myRoute.locationSettingsOpenError, 2600);
                }
              },
            },
          ],
        });
      } catch (error) {
        console.warn(
          "[route-start] location permission lookup failed",
          error instanceof Error ? error.message : error
        );
        onCancel?.(request);
        showToast(text.myRoute.locationPermissionLookupError, 2600);
      } finally {
        permissionLookupInFlightRef.current = false;
        setIsPermissionLookupPending(false);
      }
    }, [
      isStartPending,
      onCancel,
      onStart,
      openModal,
      showToast,
      text.myRoute,
    ]
  );

  return {
    isPermissionLookupPending,
    requestRouteStart,
  };
}
