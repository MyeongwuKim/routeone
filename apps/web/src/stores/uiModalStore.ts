/**
 * 용도:
 * 앱 전역 안내 모달의 내용과 닫힘 후 정리 동작을 관리한다.
 *
 * 동작 방식:
 * 모달마다 ID를 발급해 오래된 닫기 요청이 새 모달을 닫지 못하게 하고,
 * 교체·닫기 시 해당 모달의 onDismiss를 한 번 실행한다.
 */
import { create } from "zustand";

type UiModalActionVariant = "primary" | "secondary" | "danger";

export type UiModalAction = {
  label: string;
  variant?: UiModalActionVariant;
  autoClose?: boolean;
  onClick?: () => void;
};

export type UiModalPayload = {
  title: string;
  description?: string;
  detail?: string;
  actions?: UiModalAction[];
  onDismiss?: () => void;
};

type UiModalState = {
  modalId: number;
  isOpen: boolean;
  title: string;
  description: string;
  detail: string;
  actions: UiModalAction[];
  onDismiss: (() => void) | null;
  openModal: (payload: UiModalPayload) => number;
  closeModal: (expectedModalId?: number) => void;
};

const DEFAULT_ACTIONS: UiModalAction[] = [
  {
    label: "확인",
    variant: "primary",
  },
];
let nextModalId = 0;

export const useUiModalStore = create<UiModalState>((set, get) => ({
  modalId: 0,
  isOpen: false,
  title: "",
  description: "",
  detail: "",
  actions: DEFAULT_ACTIONS,
  onDismiss: null,
  openModal: (payload) => {
    const previousOnDismiss = get().isOpen ? get().onDismiss : null;
    nextModalId += 1;

    set({
      modalId: nextModalId,
      isOpen: true,
      title: payload.title,
      description: payload.description ?? "",
      detail: payload.detail ?? "",
      actions: payload.actions?.length ? payload.actions : DEFAULT_ACTIONS,
      onDismiss: payload.onDismiss ?? null,
    });
    previousOnDismiss?.();
    return nextModalId;
  },
  closeModal: (expectedModalId) => {
    if (
      expectedModalId !== undefined &&
      get().modalId !== expectedModalId
    ) {
      return;
    }

    const onDismiss = get().onDismiss;

    set({
      isOpen: false,
      onDismiss: null,
    });
    onDismiss?.();
  },
}));
