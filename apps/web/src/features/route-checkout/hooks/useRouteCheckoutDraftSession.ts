import { useState } from "react";
import { useAuthUserStore } from "@/stores/authUserStore";
import { useRouteCheckoutDraftStore } from "@/stores/routeCheckoutDraftStore";
import type { SavedPlaceItem } from "@/stores/placeCartStore";
import {
  getCheckoutPlacesKey,
  getDraftContextKey,
  type RouteCheckoutDraft,
  type RouteCheckoutDraftContext,
} from "../models/routeCheckoutDraft";
import { createRouteCheckoutState } from "../models/routeCheckoutState";
import { getTodayDateValue, type CartFlowStep } from "../models/routeCheckoutFlow";
import type { PlannedRouteDay, RouteStartLocation } from "../models/routePlanTypes";

type Options = {
  context: RouteCheckoutDraftContext;
  resumeDraft: boolean;
  savedPlaces: SavedPlaceItem[];
  initialStep: CartFlowStep;
  initialRoutePlan?: PlannedRouteDay[] | null;
  initialTravelStartDate?: string | null;
  initialTripDays?: number;
  currentLocation: RouteStartLocation | null;
  onRemovePlace: (placeId: string) => void;
  onClearPlaces: () => void;
};

/**
 * 같은 저장 문맥의 초안을 복원하고, 홈에서 명시적으로 이어갈 때는 초안의 장소 스냅샷도 사용한다.
 * 담은 장소가 달라지면 날짜·템포는 유지하되 이전 장소에 대한 결과 편집과 저장 시도 ID는 버린다.
 * 다른 계정의 초안은 복원하지 않으며, 지난 날짜의 초안은 날짜 선택부터 다시 확인한다.
 */
export function useRouteCheckoutDraftSession(options: Options) {
  const [session] = useState(() => {
    const stored = useRouteCheckoutDraftStore.getState().draft;
    const ownerUserId = useAuthUserStore.getState().user?.id ?? null;
    const canRead = stored && (!stored.ownerUserId || stored.ownerUserId === ownerUserId);
    const restored = canRead && (options.resumeDraft ||
      getDraftContextKey(stored.context) === getDraftContextKey(options.context)) ? stored : null;
    const samePlaces = restored && getCheckoutPlacesKey(restored.savedPlaces) === getCheckoutPlacesKey(options.savedPlaces);
    const keepEditor = options.resumeDraft || samePlaces;
    const form = restored ? { ...restored.form } : createRouteCheckoutState({
      initialStep: options.initialStep,
      initialTravelStartDate: options.initialTravelStartDate,
      initialTripDays: options.initialTripDays,
      initialStartLocation: options.currentLocation,
      initialStartLocationSource: options.initialRoutePlan ? "shared-route" : "current-location",
    });
    if (form.step !== "cart" && form.travelStartDate && form.travelStartDate < getTodayDateValue()) {
      form.step = "schedule";
    }
    const draft: RouteCheckoutDraft = {
      id: restored?.id ?? (typeof globalThis.crypto?.randomUUID === "function"
        ? globalThis.crypto.randomUUID()
        : `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`),
      ownerUserId,
      context: restored?.context ?? options.context,
      savedPlaces: options.resumeDraft && restored ? restored.savedPlaces : options.savedPlaces,
      initialRoutePlan: restored && keepEditor ? restored.initialRoutePlan : options.initialRoutePlan ?? null,
      initialStep: restored?.initialStep ?? options.initialStep,
      form,
      editor: restored && keepEditor ? restored.editor : null,
      createAttempt: restored && keepEditor ? restored.createAttempt : null,
      updatedAt: Date.now(),
    };
    return { draft, restoredPlaces: options.resumeDraft && restored ? restored.savedPlaces : null };
  });
  const [restoredPlaces, setRestoredPlaces] = useState(session.restoredPlaces);

  /** 이어서 만들기에서는 기존 카트를 바꾸지 않고 복원한 장소 목록에서만 제거한다. */
  const removePlace = (placeId: string) => {
    if (restoredPlaces) setRestoredPlaces(restoredPlaces.filter((item) => item.id !== placeId));
    else options.onRemovePlace(placeId);
  };

  /** 전체 삭제·저장 완료 시 초안을 지우고, 동일한 새 일정의 카트만 함께 비운다. */
  const clearPlaces = () => {
    useRouteCheckoutDraftStore.getState().clearDraft(session.draft.id);
    if (restoredPlaces) {
      setRestoredPlaces([]);
      if (session.draft.context.mode === "new" &&
        getCheckoutPlacesKey(session.draft.savedPlaces) === getCheckoutPlacesKey(options.savedPlaces)) {
        options.onClearPlaces();
      }
    } else options.onClearPlaces();
  };

  return {
    draft: session.draft,
    savedPlaces: restoredPlaces ?? options.savedPlaces,
    removePlace,
    clearPlaces,
  };
}
