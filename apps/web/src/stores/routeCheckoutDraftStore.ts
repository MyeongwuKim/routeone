import { create } from "zustand";
import { persist, type PersistStorage } from "zustand/middleware";
import {
  isRouteCheckoutDraft,
  type RouteCheckoutDraft,
} from "@/features/route-checkout/models/routeCheckoutDraft";

type DraftPatch = Partial<Pick<RouteCheckoutDraft, "form" | "editor" | "savedPlaces" | "createAttempt">>;
type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type PersistedDraftState = { draft: RouteCheckoutDraft | null };

type RouteCheckoutDraftState = {
  /** 마지막으로 작성한 한 개의 일정. 새 일정 시작·저장 완료·명시 폐기·다른 계정 로그인 시 교체하거나 제거한다. */
  draft: RouteCheckoutDraft | null;
  /** 유효한 작성본 전체를 독립된 스냅샷으로 저장한다. 잘못된 값은 현재 작성본을 덮어쓰지 않는다. */
  saveDraft: (draft: RouteCheckoutDraft) => void;
  /** id가 현재 작성본과 같을 때만 입력·결과 편집·장소·생성 요청을 갱신한다. */
  updateDraft: (id: string, patch: DraftPatch) => void;
  /** id를 지정하면 일치하는 작성본만, 생략하면 현재 작성본을 제거한다. */
  clearDraft: (id?: string) => void;
  /** 비로그인 작성본은 로그인 계정에 승계하고 다른 작성자의 작성본은 제거한다. null은 세션 만료 가능성이 있어 유지한다. */
  reconcileOwner: (userId: string | null) => void;
};

const storageName = "routeone-route-checkout-draft";
const storageVersion = 1;

function createSafeStorage(storage?: DraftStorage): PersistStorage<PersistedDraftState> {
  const getStorage = () => storage ?? globalThis.localStorage;
  return {
    getItem(name) {
      try {
        const raw = getStorage()?.getItem(name);
        if (!raw) return null;
        const stored: unknown = JSON.parse(raw);
        if (typeof stored !== "object" || stored === null || !("version" in stored) || stored.version !== storageVersion || !("state" in stored)) return null;
        const state = stored.state;
        if (typeof state !== "object" || state === null || !("draft" in state)) return null;
        return { version: storageVersion, state: { draft: isRouteCheckoutDraft(state.draft) ? state.draft : null } };
      } catch {
        // WebView 저장 공간 제한·파손 데이터·SSR에서는 빈 상태로 시작하고 화면 사용은 유지한다.
        return null;
      }
    },
    setItem(name, value) {
      try { getStorage()?.setItem(name, JSON.stringify(value)); } catch { /* 현재 메모리 작성본은 유지한다. */ }
    },
    removeItem(name) {
      try { getStorage()?.removeItem(name); } catch { /* 저장 공간에 접근할 수 없어도 화면을 막지 않는다. */ }
    },
  };
}

function snapshotDraft(draft: RouteCheckoutDraft): RouteCheckoutDraft {
  // 호출부의 배열·중첩 객체가 나중에 바뀌어도 저장 완료한 작성본은 영향을 받지 않는다.
  return JSON.parse(JSON.stringify(draft)) as RouteCheckoutDraft;
}

/**
 * 일정 입력·장소·적용 전후 편집을 localStorage에 보관하는 저장소를 만든다.
 * 저장소 접근에 실패해도 메모리 편집을 계속하며, 복원할 때 형식과 버전을 검사한다.
 * storage를 지정하면 해당 기기 저장소를 사용하고, 생략하면 현재 환경의 localStorage를 사용한다.
 */
export function createRouteCheckoutDraftStore(storage?: DraftStorage) {
  return create<RouteCheckoutDraftState>()(
    persist(
      (set) => ({
        draft: null,
        saveDraft: (draft) => {
          if (!isRouteCheckoutDraft(draft)) return;
          set({ draft: snapshotDraft(draft) });
        },
        updateDraft: (id, patch) => set((state) => {
          if (!state.draft || state.draft.id !== id) return state;
          if (Object.entries(patch).every(([key, value]) => JSON.stringify(state.draft?.[key as keyof DraftPatch]) === JSON.stringify(value))) return state;
          const next = { ...state.draft, ...patch, updatedAt: Date.now() };
          return isRouteCheckoutDraft(next) ? { draft: snapshotDraft(next) } : state;
        }),
        clearDraft: (id) => set((state) =>
          id !== undefined && state.draft?.id !== id ? state : { draft: null }
        ),
        reconcileOwner: (userId) => set((state) => {
          if (!state.draft || !userId || state.draft.ownerUserId === userId) return state;
          return { draft: state.draft.ownerUserId === null ? { ...state.draft, ownerUserId: userId } : null };
        }),
      }),
      {
        name: storageName,
        version: storageVersion,
        storage: createSafeStorage(storage),
        partialize: ({ draft }) => ({ draft }),
        merge: (stored, current) => {
          const state = stored as PersistedDraftState | undefined;
          return { ...current, draft: isRouteCheckoutDraft(state?.draft) ? state.draft : null };
        },
      }
    )
  );
}

/** 홈의 이어 만들기와 일정 모달이 함께 읽는 현재 기기의 작성본 저장소다. */
export const useRouteCheckoutDraftStore = createRouteCheckoutDraftStore();
