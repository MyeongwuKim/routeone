import { useMemo, useReducer, type SetStateAction } from "react";
import type {
  ActualStayMinutesTarget,
  EarlyRouteCompletionTarget,
  PhotoPublicationTarget,
  StayMinutesEditTarget,
  VerificationPhotoPreviewTarget,
  VisitCompletionTarget,
  VisitTimesEditTarget,
} from "../models/dayRouteDialogTypes";
import type { MyRouteDay, MyRouteStop } from "../types";

type DayRoutePopupState = {
  activeDayId: string;
  expandedDayIds: Set<string>;
  mapTargetDayId: string | null;
  isOrderEditing: boolean;
  stayMinutesEditTarget: StayMinutesEditTarget | null;
  visitCompletionTarget: VisitCompletionTarget | null;
  visitTimesEditTarget: VisitTimesEditTarget | null;
  verificationPhotoPreviewTarget: VerificationPhotoPreviewTarget | null;
  photoPublicationTarget: PhotoPublicationTarget | null;
  actualStayMinutesTarget: ActualStayMinutesTarget | null;
  earlyRouteCompletionTarget: EarlyRouteCompletionTarget | null;
  orderedStops: MyRouteStop[];
  baseStopIds: string[];
};

type DayRoutePopupAction =
  | { type: "set-active-day-id"; value: string }
  | { type: "set-expanded-day-ids"; value: SetStateAction<Set<string>> }
  | { type: "set-map-target-day"; value: string | null }
  | { type: "set-order-editing"; value: boolean }
  | { type: "set-stay-minutes-edit-target"; value: StayMinutesEditTarget | null }
  | { type: "set-visit-completion-target"; value: VisitCompletionTarget | null }
  | { type: "set-visit-times-edit-target"; value: VisitTimesEditTarget | null }
  | {
      type: "set-verification-photo-preview-target";
      value: VerificationPhotoPreviewTarget | null;
    }
  | {
      type: "set-photo-publication-target";
      value: PhotoPublicationTarget | null;
    }
  | { type: "set-actual-stay-minutes-target"; value: ActualStayMinutesTarget | null }
  | {
      type: "set-early-route-completion-target";
      value: SetStateAction<EarlyRouteCompletionTarget | null>;
    }
  | { type: "set-ordered-stops"; value: SetStateAction<MyRouteStop[]> }
  | { type: "set-base-stop-ids"; value: string[] }
  | { type: "reset-day-editor"; day: MyRouteDay };

function resolveStateAction<T>(value: SetStateAction<T>, currentValue: T): T {
  return typeof value === "function"
    ? (value as (currentValue: T) => T)(currentValue)
    : value;
}

function createDayRoutePopupState(day: MyRouteDay): DayRoutePopupState {
  return {
    activeDayId: day.id,
    expandedDayIds: new Set([day.id]),
    mapTargetDayId: null,
    isOrderEditing: false,
    stayMinutesEditTarget: null,
    visitCompletionTarget: null,
    visitTimesEditTarget: null,
    verificationPhotoPreviewTarget: null,
    photoPublicationTarget: null,
    actualStayMinutesTarget: null,
    earlyRouteCompletionTarget: null,
    orderedStops: day.stops,
    baseStopIds: day.stops.map((stop) => stop.id),
  };
}

function dayRoutePopupReducer(
  state: DayRoutePopupState,
  action: DayRoutePopupAction
): DayRoutePopupState {
  switch (action.type) {
    case "set-active-day-id":
      return { ...state, activeDayId: action.value };
    case "set-expanded-day-ids":
      return {
        ...state,
        expandedDayIds: resolveStateAction(
          action.value,
          state.expandedDayIds
        ),
      };
    case "set-map-target-day":
      return { ...state, mapTargetDayId: action.value };
    case "set-order-editing":
      return { ...state, isOrderEditing: action.value };
    case "set-stay-minutes-edit-target":
      return { ...state, stayMinutesEditTarget: action.value };
    case "set-visit-completion-target":
      return { ...state, visitCompletionTarget: action.value };
    case "set-visit-times-edit-target":
      return { ...state, visitTimesEditTarget: action.value };
    case "set-verification-photo-preview-target":
      return { ...state, verificationPhotoPreviewTarget: action.value };
    case "set-photo-publication-target":
      return { ...state, photoPublicationTarget: action.value };
    case "set-actual-stay-minutes-target":
      return { ...state, actualStayMinutesTarget: action.value };
    case "set-early-route-completion-target":
      return {
        ...state,
        earlyRouteCompletionTarget: resolveStateAction(
          action.value,
          state.earlyRouteCompletionTarget
        ),
      };
    case "set-ordered-stops":
      return {
        ...state,
        orderedStops: resolveStateAction(action.value, state.orderedStops),
      };
    case "set-base-stop-ids":
      return { ...state, baseStopIds: action.value };
    case "reset-day-editor":
      return {
        ...state,
        activeDayId: action.day.id,
        mapTargetDayId: null,
        isOrderEditing: false,
        stayMinutesEditTarget: null,
        visitTimesEditTarget: null,
        verificationPhotoPreviewTarget: null,
        photoPublicationTarget: null,
        actualStayMinutesTarget: null,
        orderedStops: action.day.stops,
        baseStopIds: action.day.stops.map((stop) => stop.id),
      };
    default:
      return state;
  }
}

export function useDayRoutePopupState(day: MyRouteDay) {
  const [state, dispatch] = useReducer(
    dayRoutePopupReducer,
    day,
    createDayRoutePopupState
  );
  const actions = useMemo(
    () => ({
      setActiveDayId: (value: string) =>
        dispatch({ type: "set-active-day-id", value }),
      setExpandedDayIds: (value: SetStateAction<Set<string>>) =>
        dispatch({ type: "set-expanded-day-ids", value }),
      setMapTargetDayId: (value: string | null) =>
        dispatch({ type: "set-map-target-day", value }),
      setIsOrderEditing: (value: boolean) =>
        dispatch({ type: "set-order-editing", value }),
      setStayMinutesEditTarget: (value: StayMinutesEditTarget | null) =>
        dispatch({ type: "set-stay-minutes-edit-target", value }),
      setVisitCompletionTarget: (value: VisitCompletionTarget | null) =>
        dispatch({ type: "set-visit-completion-target", value }),
      setVisitTimesEditTarget: (value: VisitTimesEditTarget | null) =>
        dispatch({ type: "set-visit-times-edit-target", value }),
      setVerificationPhotoPreviewTarget: (
        value: VerificationPhotoPreviewTarget | null
      ) => dispatch({ type: "set-verification-photo-preview-target", value }),
      setPhotoPublicationTarget: (value: PhotoPublicationTarget | null) =>
        dispatch({ type: "set-photo-publication-target", value }),
      setActualStayMinutesTarget: (value: ActualStayMinutesTarget | null) =>
        dispatch({ type: "set-actual-stay-minutes-target", value }),
      setEarlyRouteCompletionTarget: (
        value: SetStateAction<EarlyRouteCompletionTarget | null>
      ) => dispatch({ type: "set-early-route-completion-target", value }),
      setOrderedStops: (value: SetStateAction<MyRouteStop[]>) =>
        dispatch({ type: "set-ordered-stops", value }),
      setBaseStopIds: (value: string[]) =>
        dispatch({ type: "set-base-stop-ids", value }),
      resetDayEditorState: (nextDay: MyRouteDay) =>
        dispatch({ type: "reset-day-editor", day: nextDay }),
    }),
    []
  );

  return { ...state, ...actions };
}
