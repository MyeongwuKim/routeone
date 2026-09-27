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
  /** 모달 하단 버튼에 표시할 문구 */
  label: string;
  /** 버튼 색상과 강조 수준. 생략하면 기본 버튼 스타일을 사용한다. */
  variant?: UiModalActionVariant;
  /** false이면 버튼 동작 후 모달을 유지한다. 생략하거나 true이면 GlobalModal이 자동으로 닫는다. */
  autoClose?: boolean;
  /** 버튼을 누를 때 GlobalModal이 실행하는 동작. 비동기 반환값도 처리한다. */
  onClick?: () => void;
};

export type UiModalPayload = {
  /** 모달 헤더에 표시할 필수 제목 */
  title: string;
  /** 제목 아래에 표시할 요약 설명 */
  description?: string;
  /** 별도 강조 영역에 표시할 추가 정보 */
  detail?: string;
  /** 하단 버튼 목록. 없거나 비어 있으면 기본 확인 버튼을 사용한다. */
  actions?: UiModalAction[];
  /** 모달이 닫히거나 다른 모달로 교체될 때 한 번 실행할 정리 함수 */
  onDismiss?: () => void;
};

type UiModalState = {
  /** 모달을 열 때마다 증가하는 ID. 오래된 비동기 닫기 요청을 구분한다. */
  modalId: number;
  /** GlobalModal 표시 여부 */
  isOpen: boolean;
  /** 현재 모달 제목 */
  title: string;
  /** 현재 모달 요약 설명. 생략 시 빈 문자열 */
  description: string;
  /** 현재 모달 추가 정보. 생략 시 빈 문자열 */
  detail: string;
  /** 현재 모달 하단에 표시할 액션 목록 */
  actions: UiModalAction[];
  /** 현재 모달이 닫히거나 교체될 때 한 번 실행할 정리 함수 */
  onDismiss: (() => void) | null;
  /** 새 ID와 내용을 적용하고 기존 열린 모달의 onDismiss를 실행한 뒤 발급 ID를 반환한다. */
  openModal: (payload: UiModalPayload) => number;
  /** expectedModalId가 현재 ID와 같을 때만 모달을 닫고 onDismiss를 실행한다. */
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
