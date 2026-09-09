/**
 * 용도:
 * 앱 버전과 위치·알림·카메라·사진 권한을 모든 화면에서 공유한다.
 *
 * 동작 방식:
 * 동시에 들어온 조회는 합치고, 앱 복귀 후 시작한 조회보다 늦게 도착한
 * 이전 응답과 제한 시간을 넘긴 응답은 상태에 반영하지 않는다.
 */
import { create } from "zustand";
import { getNativeAppInfo } from "@/native-bridge/appInfo";
import type { NativeAppInfo } from "@/native-bridge/types";

export type NativeAppInfoState =
  | { status: "loading"; info: null }
  | { status: "success"; info: NativeAppInfo }
  | { status: "error"; info: null };

type NativeAppInfoStore = {
  appInfoState: NativeAppInfoState;
  isRefreshing: boolean;
  refresh: (options?: { forceRefresh?: boolean }) => Promise<NativeAppInfo>;
};

const PERMISSION_LOOKUP_TIMEOUT_MS = 3_000;
let latestRequestId = 0;
let pendingRequest: Promise<NativeAppInfo> | null = null;

export const useNativeAppInfoStore = create<NativeAppInfoStore>((set) => ({
  appInfoState: { status: "loading", info: null },
  isRefreshing: false,
  refresh: ({ forceRefresh = false } = {}) => {
    if (pendingRequest && !forceRefresh) {
      return pendingRequest;
    }

    const requestId = ++latestRequestId;
    set({ isRefreshing: true });
    let timeoutId: ReturnType<typeof setTimeout>;
    const request = Promise.race([
      getNativeAppInfo(),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error("Native permission lookup timed out"));
        }, PERMISSION_LOOKUP_TIMEOUT_MS);
      }),
    ])
      .then((info) => {
        if (requestId === latestRequestId) {
          set({
            appInfoState: { status: "success", info },
            isRefreshing: false,
          });
        }
        return info;
      })
      .catch((error: unknown) => {
        if (requestId === latestRequestId) {
          set({
            appInfoState: { status: "error", info: null },
            isRefreshing: false,
          });
        }
        throw error;
      })
      .finally(() => {
        clearTimeout(timeoutId);
        if (pendingRequest === request) {
          pendingRequest = null;
        }
      });

    pendingRequest = request;
    return request;
  },
}));
