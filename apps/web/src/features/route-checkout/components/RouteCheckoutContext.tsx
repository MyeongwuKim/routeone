
import {
  useCallback,
  useMemo,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useUiText } from "@/lib/uiText";
import { useRouteCheckoutDraftStore } from "@/stores/routeCheckoutDraftStore";
import type { SavedPlaceItem } from "@/stores/placeCartStore";
import { getCheckoutPlacesKey, type RouteCheckoutDraft, type RouteCreateAttempt } from "../models/routeCheckoutDraft";
import type { RouteEditorState } from "../models/routeResultEditorState";
import type {
  RouteStartLocation,
  TravelTempo,
} from "../models/routePlanTypes";
import {
  getTodayDate,
  parseDateValue,
  toTimeMinutes,
  type CartFlowStep,
} from "../models/routeCheckoutFlow";
import {
  routeCheckoutReducer,
  type RouteCheckoutAction,
  type RouteStartLocationSource,
} from "../models/routeCheckoutState";
import { RouteCheckoutContext } from "../hooks/useRouteCheckout";

type RouteCheckoutProviderProps = {
  children: ReactNode;
  /** 모달을 열 때 확정한 저장 문맥과 복원 상태. 같은 모달 안에서는 ID를 유지한다. */
  draft: RouteCheckoutDraft;
  savedPlaces: SavedPlaceItem[];
};

/** 입력·결과 편집을 한 초안 ID로 보관하며, 저장·명시 삭제 후에는 늦은 변경으로 초안을 되살리지 않는다. */
export function RouteCheckoutProvider({
  children,
  draft,
  savedPlaces,
}: RouteCheckoutProviderProps) {
  const text = useUiText();
  const [isSavingRoute, setIsSavingRoute] = useState(false);
  const isSaveRequestInFlightRef = useRef(false);
  const [state, dispatch] = useReducer(routeCheckoutReducer, draft.form);
  const [editorState, setEditor] = useState(draft.editor);
  const [createAttempt, setAttempt] = useState(draft.createAttempt);
  const didInitializeDraft = useRef(false);
  const placesKey = getCheckoutPlacesKey(savedPlaces);
  const previousPlacesKey = useRef(placesKey);
  const [editorPlacesKey, setEditorPlacesKey] = useState(placesKey);
  const appendTarget = draft.context.mode === "append" ? draft.context.target : null;

  // 결과 자식이 새 장소로 마운트되기 전에 예전 장소의 편집 상태를 초기화한다.
  if (editorPlacesKey !== placesKey) {
    setEditorPlacesKey(placesKey);
    setEditor(null);
    setAttempt(null);
  }

  // 입력 직후 저장해 앱 종료 시 지연 저장을 기다리다 변경분을 잃지 않게 한다.
  useLayoutEffect(() => {
    const store = useRouteCheckoutDraftStore.getState();
    const didPlacesChange = previousPlacesKey.current !== placesKey;
    previousPlacesKey.current = placesKey;
    if (!didInitializeDraft.current) {
      store.saveDraft({ ...draft, form: state, savedPlaces });
      didInitializeDraft.current = true;
    } else {
      store.updateDraft(draft.id, {
        form: state, savedPlaces,
        ...(didPlacesChange ? { editor: null, createAttempt: null } : {}),
      });
    }
  }, [draft, placesKey, savedPlaces, state]);

  /** 적용 전 편집과 취소 기준을 함께 보관해 결과 단계를 나갔다 돌아와도 유지한다. */
  const setEditorState = useCallback((editor: RouteEditorState) => {
    setEditor(editor);
    useRouteCheckoutDraftStore.getState().updateDraft(draft.id, { editor });
  }, [draft.id]);
  /** 생성 요청을 보내기 전에 재시도 식별자를 동기 저장한다. */
  const setCreateAttempt = useCallback((attempt: RouteCreateAttempt) => {
    setAttempt(attempt);
    useRouteCheckoutDraftStore.getState().updateDraft(draft.id, { createAttempt: attempt });
  }, [draft.id]);
  /** 저장 성공 또는 명시 폐기 시 이 모달의 초안만 삭제한다. */
  const clearDraft = useCallback(() => {
    useRouteCheckoutDraftStore.getState().clearDraft(draft.id);
  }, [draft.id]);
  const isRouteSaveInFlight = useCallback(
    () => isSaveRequestInFlightRef.current,
    []
  );
  const startSavingRoute = useCallback(() => {
    if (isSaveRequestInFlightRef.current) {
      return false;
    }

    isSaveRequestInFlightRef.current = true;
    setIsSavingRoute(true);
    return true;
  }, []);
  const finishSavingRoute = useCallback(() => {
    isSaveRequestInFlightRef.current = false;
    setIsSavingRoute(false);
  }, []);
  const dispatchWhenEditable = useCallback((action: RouteCheckoutAction) => {
    if (!isSaveRequestInFlightRef.current) {
      dispatch(action);
    }
  }, []);
  const {
    step,
    travelStartDate,
    tripDays,
    dailyStartTime,
    scheduleEndTime,
    tempo,
    startLocationSelection,
  } = state;
  const setStep = useCallback(
    (value: CartFlowStep) => dispatchWhenEditable({ type: "set-step", value }),
    [dispatchWhenEditable]
  );
  const setTravelStartDate = useCallback(
    (value: string) =>
      dispatchWhenEditable({ type: "set-travel-start-date", value }),
    [dispatchWhenEditable]
  );
  const setTripDays = useCallback(
    (value: number) => dispatchWhenEditable({ type: "set-trip-days", value }),
    [dispatchWhenEditable]
  );
  const setDailyStartTime = useCallback(
    (value: string) =>
      dispatchWhenEditable({ type: "set-daily-start-time", value }),
    [dispatchWhenEditable]
  );
  const setScheduleEndTime = useCallback(
    (value: string) =>
      dispatchWhenEditable({ type: "set-schedule-end-time", value }),
    [dispatchWhenEditable]
  );
  const setTempo = useCallback(
    (value: TravelTempo | null) =>
      dispatchWhenEditable({ type: "set-tempo", value }),
    [dispatchWhenEditable]
  );
  const setStartLocation = useCallback(
    (location: RouteStartLocation, source: RouteStartLocationSource) =>
      dispatchWhenEditable({
        type: "set-start-location",
        value: { location, source },
      }),
    [dispatchWhenEditable]
  );

  const startDate = parseDateValue(travelStartDate);
  const hasValidStartDate = Boolean(startDate);
  const isFutureStartDate = startDate ? startDate >= getTodayDate() : false;
  const hasValidTripDays = Number.isFinite(tripDays) && tripDays >= 1;
  const dailyStartMinutes = toTimeMinutes(dailyStartTime);
  const scheduleEndMinutes = toTimeMinutes(scheduleEndTime);
  const hasValidTimes = dailyStartMinutes >= 0 && scheduleEndMinutes >= 0;
  const isDailyTimeOrderValid = scheduleEndMinutes > dailyStartMinutes;
  const isScheduleValid =
    hasValidStartDate &&
    isFutureStartDate &&
    hasValidTripDays &&
    hasValidTimes &&
    isDailyTimeOrderValid;
  const scheduleValidationMessage = !hasValidStartDate
    ? text.cart.validationStartDateRequired
    : !isFutureStartDate
      ? text.cart.validationStartDateFuture
      : !hasValidTripDays
        ? text.cart.validationTripDaysRequired
        : !hasValidTimes
          ? text.cart.validationTimeInvalid
          : !isDailyTimeOrderValid
            ? text.cart.validationTimeOrder
            : "";

  const value = useMemo(
    () => ({
      draftId: draft.id,
      appendTarget,
      editorState,
      setEditorState,
      createAttempt,
      setCreateAttempt,
      clearDraft,
      isSavingRoute,
      isRouteSaveInFlight,
      startSavingRoute,
      finishSavingRoute,
      step,
      setStep,
      travelStartDate,
      setTravelStartDate,
      tripDays,
      setTripDays,
      dailyStartTime,
      setDailyStartTime,
      scheduleEndTime,
      setScheduleEndTime,
      tempo,
      setTempo,
      startLocation: startLocationSelection?.location ?? null,
      startLocationSource: startLocationSelection?.source ?? null,
      setStartLocation,
      dailyStartMinutes,
      scheduleEndMinutes,
      isScheduleValid,
      scheduleValidationMessage,
    }),
    [
      draft.id,
      appendTarget,
      editorState,
      setEditorState,
      createAttempt,
      setCreateAttempt,
      clearDraft,
      dailyStartMinutes,
      dailyStartTime,
      finishSavingRoute,
      isRouteSaveInFlight,
      isSavingRoute,
      isScheduleValid,
      scheduleEndMinutes,
      scheduleEndTime,
      scheduleValidationMessage,
      setDailyStartTime,
      setScheduleEndTime,
      setStartLocation,
      setStep,
      setTempo,
      setTravelStartDate,
      setTripDays,
      startSavingRoute,
      startLocationSelection,
      step,
      tempo,
      travelStartDate,
      tripDays,
    ]
  );

  return (
    <RouteCheckoutContext.Provider value={value}>
      {children}
    </RouteCheckoutContext.Provider>
  );
}
