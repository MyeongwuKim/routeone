/** 일정 만들기 단계와 입력값, 저장 잠금을 하위 단계 컴포넌트에 전달하는 Context 진입점이다. */
import { createContext, useContext } from "react";
import type {
  RouteStartLocation,
  TravelTempo,
} from "../models/routePlanTypes";
import type { CartFlowStep } from "../models/routeCheckoutFlow";
import type { RouteStartLocationSource } from "../models/routeCheckoutState";
import type { RouteAppendTarget } from "@/stores/routeEditFlowStore";
import type { RouteCreateAttempt } from "../models/routeCheckoutDraft";
import type { RouteEditorState } from "../models/routeResultEditorState";

export type RouteCheckoutContextValue = {
  /** 현재 작성 중인 초안과 API 저장 대상을 구분하는 값 */
  draftId: string;
  appendTarget: RouteAppendTarget | null;
  editorState: RouteEditorState | null;
  setEditorState: (state: RouteEditorState) => void;
  createAttempt: RouteCreateAttempt | null;
  setCreateAttempt: (attempt: RouteCreateAttempt) => void;
  clearDraft: () => void;
  isSavingRoute: boolean;
  isRouteSaveInFlight: () => boolean;
  startSavingRoute: () => boolean;
  finishSavingRoute: () => void;
  step: CartFlowStep;
  setStep: (step: CartFlowStep) => void;
  travelStartDate: string;
  setTravelStartDate: (value: string) => void;
  tripDays: number;
  setTripDays: (value: number) => void;
  dailyStartTime: string;
  setDailyStartTime: (value: string) => void;
  scheduleEndTime: string;
  setScheduleEndTime: (value: string) => void;
  tempo: TravelTempo | null;
  setTempo: (value: TravelTempo | null) => void;
  startLocation: RouteStartLocation | null;
  startLocationSource: RouteStartLocationSource | null;
  setStartLocation: (
    location: RouteStartLocation,
    source: RouteStartLocationSource
  ) => void;
  dailyStartMinutes: number;
  scheduleEndMinutes: number;
  isScheduleValid: boolean;
  scheduleValidationMessage: string;
};

export const RouteCheckoutContext =
  createContext<RouteCheckoutContextValue | null>(null);

/** RouteCheckoutProvider 내부의 일정 편집 상태를 반환하며 Provider 밖에서 호출하면 즉시 예외를 던진다. */
export function useRouteCheckout() {
  const context = useContext(RouteCheckoutContext);
  if (!context) {
    throw new Error("useRouteCheckout must be used within RouteCheckoutProvider");
  }
  return context;
}
