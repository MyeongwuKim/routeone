/**
 * 용도:
 * 기존 여행 경로에 새 일정을 추가할 대상 경로와 다음 일차 정보를 공유한다.
 * 내 경로 화면에서 시작한 추가 작업을 홈의 장소 선택과 경로 생성 모달까지 이어갈 때 사용한다.
 *
 * 동작 방식:
 * startAppendTarget이 경로 ID·제목·추가할 일차·추천 시작일을 보관한다.
 * 추가가 끝나거나 취소되면 clearAppendTarget으로 편집 문맥을 제거한다.
 */
import { create } from "zustand";

export type RouteAppendTarget = {
  /** 새 일차를 추가할 기존 경로 ID */
  routeId: string;
  /** 일정 만들기 화면에서 추가 대상을 안내할 경로 제목 */
  routeTitle: string;
  /** 기존 마지막 일차 다음에 생성할 1부터 시작하는 일차 번호 */
  nextDayIndex: number;
  /** 추가 일정의 날짜 기본값. 기존 경로에 날짜가 없으면 null */
  suggestedStartDate: string | null;
};

type RouteEditFlowState = {
  /** 기존 경로에 DAY를 추가하는 중이면 대상 문맥, 일반 일정 만들기 흐름이면 null */
  appendTarget: RouteAppendTarget | null;
  /** 대상 경로와 다음 DAY 정보를 저장해 홈의 장소 선택부터 일정 만들기까지 유지한다. */
  startAppendTarget: (target: RouteAppendTarget) => void;
  /** 추가 완료 또는 취소 후 appendTarget을 null로 되돌린다. */
  clearAppendTarget: () => void;
};

export const useRouteEditFlowStore = create<RouteEditFlowState>((set) => ({
  appendTarget: null,
  startAppendTarget: (target) =>
    set({
      appendTarget: target,
    }),
  clearAppendTarget: () =>
    set({
      appendTarget: null,
    }),
}));
