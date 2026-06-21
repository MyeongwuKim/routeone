import { create } from "zustand";

export type RouteAppendTarget = {
  routeId: string;
  routeTitle: string;
  nextDayIndex: number;
  suggestedStartDate: string | null;
};

type RouteEditFlowState = {
  appendTarget: RouteAppendTarget | null;
  startAppendTarget: (target: RouteAppendTarget) => void;
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
