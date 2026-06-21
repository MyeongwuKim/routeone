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
};

type UiModalState = {
  isOpen: boolean;
  title: string;
  description: string;
  detail: string;
  actions: UiModalAction[];
  openModal: (payload: UiModalPayload) => void;
  closeModal: () => void;
};

const DEFAULT_ACTIONS: UiModalAction[] = [
  {
    label: "확인",
    variant: "primary",
  },
];

export const useUiModalStore = create<UiModalState>((set) => ({
  isOpen: false,
  title: "",
  description: "",
  detail: "",
  actions: DEFAULT_ACTIONS,
  openModal: (payload) =>
    set({
      isOpen: true,
      title: payload.title,
      description: payload.description ?? "",
      detail: payload.detail ?? "",
      actions: payload.actions?.length ? payload.actions : DEFAULT_ACTIONS,
    }),
  closeModal: () =>
    set({
      isOpen: false,
    }),
}));
