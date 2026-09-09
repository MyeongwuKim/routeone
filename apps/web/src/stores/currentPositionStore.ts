/**
 * 용도:
 * 홈 지도와 장소 상세 등에서 사용하는 현재 위치와 조회 상태를 공유한다.
 *
 * 동작 방식:
 * 네이티브 권한을 확인한 뒤 좌표 캐시를 사용한다. 권한 해제 시 캐시와
 * 진행 중 요청을 무효화하고, 일시적인 GPS 오류일 때만 이전 좌표를 유지한다.
 */
import { create } from "zustand";
import {
  isNativeRuntime,
  isNativeTestAccountMode,
} from "@/native-bridge/runtime";
import { useNativeAppInfoStore } from "./nativeAppInfoStore";
import {
  getCurrentPosition,
  type RouteOnePosition,
} from "@/lib/currentPosition";

export type CurrentPositionStatus =
  | "idle"
  | "loading"
  | "success"
  | "error";

type CurrentPositionState = {
  error: string | null;
  position: RouteOnePosition | null;
  status: CurrentPositionStatus;
  applyPosition: (position: RouteOnePosition) => void;
  clearPosition: () => void;
  invalidatePosition: () => void;
  requestCurrentPosition: (options?: {
    forceRefresh?: boolean;
  }) => Promise<RouteOnePosition>;
};

let pendingPositionRequest: Promise<RouteOnePosition> | null = null;
let pendingFreshPositionRequest: Promise<RouteOnePosition> | null = null;
let latestPositionRequestId = 0;
let positionGeneration = 0;
const CACHED_POSITION_MAX_AGE_MS = 1000 * 60 * 5;
const LOCATION_PERMISSION_ERROR =
  "위치 권한을 허용해야 현재 위치를 확인할 수 있어요.";

function cancelPendingPositions() {
  latestPositionRequestId += 1;
  positionGeneration += 1;
  pendingPositionRequest = null;
  pendingFreshPositionRequest = null;
}

async function checkNativeLocationPermission() {
  await useNativeAppInfoStore.getState().refresh();
  const permission =
    useNativeAppInfoStore.getState().appInfoState.info?.locationPermissionStatus;
  if (permission !== "granted" && permission !== "undetermined") {
    throw new Error(LOCATION_PERMISSION_ERROR);
  }
  return permission;
}

function getPositionErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "현재 위치를 확인하지 못했어요.";
}

export const useCurrentPositionStore = create<CurrentPositionState>(
  (set, get) => ({
    error: null,
    position: null,
    status: "idle",
    applyPosition: (position) => {
      cancelPendingPositions();
      set({
        error: null,
        position,
        status: "success",
      });
    },
    clearPosition: () => {
      cancelPendingPositions();
      set({
        error: null,
        position: null,
        status: "idle",
      });
    },
    invalidatePosition: () => {
      cancelPendingPositions();
      set({ error: LOCATION_PERMISSION_ERROR, position: null, status: "error" });
    },
    requestCurrentPosition: ({ forceRefresh = false } = {}) => {
      const pendingRequest = forceRefresh
        ? pendingFreshPositionRequest
        : pendingFreshPositionRequest ?? pendingPositionRequest;

      if (pendingRequest) {
        return pendingRequest;
      }

      const requestId = ++latestPositionRequestId;
      const generation = positionGeneration;
      const requiresPermission = isNativeRuntime() && !isNativeTestAccountMode();
      const readPosition = () => {
        if (generation !== positionGeneration) {
          throw new Error("현재 위치 요청이 취소되었어요. 다시 시도해 주세요.");
        }
        const currentPosition = get().position;
        if (
          currentPosition &&
          !forceRefresh &&
          Date.now() - currentPosition.timestamp <= CACHED_POSITION_MAX_AGE_MS
        ) {
          return Promise.resolve(currentPosition);
        }
        set({ error: null, status: "loading" });
        return getCurrentPosition({ forceRefresh });
      };

      const positionRequest = (requiresPermission
        ? checkNativeLocationPermission().then(async (permission) => {
            const position = await readPosition();
            if (permission === "undetermined") {
              await useNativeAppInfoStore.getState().refresh();
            }
            return position;
          })
        : readPosition())
        .then((position) => {
          if (generation !== positionGeneration) {
            throw new Error("현재 위치 요청이 취소되었어요. 다시 시도해 주세요.");
          }
          if (requestId === latestPositionRequestId) {
            set({
              error: null,
              position,
              status: "success",
            });
          }
          return position;
        })
        .catch((error: unknown) => {
          if (requestId === latestPositionRequestId) {
            const permission = useNativeAppInfoStore.getState().appInfoState.info
              ?.locationPermissionStatus;
            if (requiresPermission && permission !== "granted") {
              get().invalidatePosition();
              throw error;
            }
            set({
              error: getPositionErrorMessage(error),
              status: "error",
            });
          }
          throw error;
        })
        .finally(() => {
          if (pendingFreshPositionRequest === positionRequest) {
            pendingFreshPositionRequest = null;
          }
          if (pendingPositionRequest === positionRequest) {
            pendingPositionRequest = null;
          }
        });

      if (forceRefresh) {
        pendingFreshPositionRequest = positionRequest;
      } else {
        pendingPositionRequest = positionRequest;
      }

      return positionRequest;
    },
  })
);
