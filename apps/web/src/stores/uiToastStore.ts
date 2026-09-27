/**
 * 용도:
 * 저장 완료나 오류처럼 잠시 보여주는 전역 토스트 문구와 노출 상태를 공유한다.
 * 어느 화면에서 호출하더라도 최상위 TopToast 하나가 동일한 방식으로 메시지를 표시할 때 사용한다.
 *
 * 동작 방식:
 * showToast 호출마다 기존 타이머를 취소하고 새 메시지의 진입·자동 닫힘 시간을 설정한다.
 * 닫힘 애니메이션이 끝난 뒤 메시지를 비우며 hideToast는 즉시 상태와 타이머를 정리한다.
 */
import { create } from "zustand";

type UiToastState = {
  /** TopToast에 표시할 현재 문구. 닫힘 애니메이션까지 끝나면 null */
  message: string | null;
  /** 진입·닫힘 애니메이션에서 사용하는 실제 노출 상태 */
  isVisible: boolean;
  /** 기존 예약을 취소하고 메시지를 표시한 뒤 durationMs 후 닫힘을 시작한다. */
  showToast: (message: string, durationMs?: number) => void;
  /** 예약된 진입·닫힘 작업을 취소하고 메시지와 노출 상태를 즉시 초기화한다. */
  hideToast: () => void;
};

let hideTimer: ReturnType<typeof setTimeout> | null = null;
let enterTimer: ReturnType<typeof setTimeout> | null = null;

export const useUiToastStore = create<UiToastState>((set) => ({
  message: null,
  isVisible: false,
  showToast: (message, durationMs = 1800) => {
    if (enterTimer) {
      clearTimeout(enterTimer);
      enterTimer = null;
    }
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }

    set({ message, isVisible: false });

    enterTimer = setTimeout(() => {
      set({ isVisible: true });
      enterTimer = null;
    }, 16);

    hideTimer = setTimeout(() => {
      set({ isVisible: false });
      hideTimer = setTimeout(() => {
        set({ message: null });
      }, 430);
    }, durationMs);
  },
  hideToast: () => {
    if (enterTimer) {
      clearTimeout(enterTimer);
      enterTimer = null;
    }
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
    set({ isVisible: false, message: null });
  },
}));
