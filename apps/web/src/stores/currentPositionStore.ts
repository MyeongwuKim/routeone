import { create } from "zustand";
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
  requestCurrentPosition: (options?: {
    forceRefresh?: boolean;
  }) => Promise<RouteOnePosition>;
};

let pendingPositionRequest: Promise<RouteOnePosition> | null = null;
let pendingFreshPositionRequest: Promise<RouteOnePosition> | null = null;
let latestPositionRequestId = 0;
const CACHED_POSITION_MAX_AGE_MS = 1000 * 60 * 5;

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
      latestPositionRequestId += 1;
      set({
        error: null,
        position,
        status: "success",
      });
    },
    requestCurrentPosition: ({ forceRefresh = false } = {}) => {
      const currentPosition = get().position;

      if (
        currentPosition &&
        !forceRefresh &&
        Date.now() - currentPosition.timestamp <= CACHED_POSITION_MAX_AGE_MS
      ) {
        return Promise.resolve(currentPosition);
      }

      const pendingRequest = forceRefresh
        ? pendingFreshPositionRequest
        : pendingFreshPositionRequest ?? pendingPositionRequest;

      if (pendingRequest) {
        return pendingRequest;
      }

      const requestId = ++latestPositionRequestId;
      set({
        error: null,
        status: "loading",
      });

      const positionRequest = getCurrentPosition({ forceRefresh })
        .then((position) => {
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
            set({
              error: getPositionErrorMessage(error),
              position: null,
              status: "error",
            });
          }
          throw error;
        })
        .finally(() => {
          if (forceRefresh) {
            pendingFreshPositionRequest = null;
          } else {
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
