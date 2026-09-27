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

/** 네이티브 앱 정보 조회 전·성공·실패를 info 존재 여부와 함께 구분하는 상태다. */
export type NativeAppInfoState =
  | { status: "loading"; info: null }
  | { status: "success"; info: NativeAppInfo }
  | { status: "error"; info: null };

type NativeAppInfoStore = {
  /** 최근 유효한 요청의 로딩·성공·오류 결과 */
  appInfoState: NativeAppInfoState;
  /** 기존 정보 표시 여부와 별개로 현재 새 조회가 진행 중인지 나타낸다. */
  isRefreshing: boolean;
  /** 네이티브 앱 정보와 권한을 조회하며 forceRefresh가 아니면 진행 중인 Promise를 재사용한다. */
  refresh: (options?: { forceRefresh?: boolean }) => Promise<NativeAppInfo>;
};

const PERMISSION_LOOKUP_TIMEOUT_MS = 3_000;
let latestRequestId = 0;
let pendingRequest: Promise<NativeAppInfo> | null = null;

export const useNativeAppInfoStore = create<NativeAppInfoStore>((set) => ({
  appInfoState: { status: "loading", info: null },
  isRefreshing: false,
  /**
   * forceRefresh는 진행 중 요청과 별도로 새 요청 번호를 발급하며 이후 도착한 이전 응답을 무시한다.
   * 네이티브가 3초 안에 응답하지 않으면 appInfoState를 error로 바꾸고 Promise를 reject한다.
   */
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
