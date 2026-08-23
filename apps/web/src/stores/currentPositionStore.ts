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
  requestCurrentPosition: (options?: {
    forceRefresh?: boolean;
  }) => Promise<RouteOnePosition>;
};

let pendingPositionRequest: Promise<RouteOnePosition> | null = null;
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
    requestCurrentPosition: ({ forceRefresh = false } = {}) => {
      const currentPosition = get().position;

      if (
        currentPosition &&
        !forceRefresh &&
        Date.now() - currentPosition.timestamp <= CACHED_POSITION_MAX_AGE_MS
      ) {
        return Promise.resolve(currentPosition);
      }

      if (pendingPositionRequest) {
        return pendingPositionRequest;
      }

      set({
        error: null,
        status: "loading",
      });

      pendingPositionRequest = getCurrentPosition()
        .then((position) => {
          set({
            error: null,
            position,
            status: "success",
          });
          return position;
        })
        .catch((error: unknown) => {
          set({
            error: getPositionErrorMessage(error),
            position: null,
            status: "error",
          });
          throw error;
        })
        .finally(() => {
          pendingPositionRequest = null;
        });

      return pendingPositionRequest;
    },
  })
);
