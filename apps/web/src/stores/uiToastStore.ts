import { create } from "zustand";

type UiToastState = {
  message: string | null;
  isVisible: boolean;
  showToast: (message: string, durationMs?: number) => void;
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
