/** 공유 경로의 적용 필터와 필터 팝업 draft를 분리해 열기·토글·적용·초기화 동작을 관리한다. */
import { useCallback, useReducer } from "react";
import type { AppLanguage } from "@/stores/appLanguageStore";
import type { SharedRouteFilterCandidate } from "../sharedRouteCardModel";
import {
  EMPTY_SHARED_ROUTE_FILTERS,
  addFilterCandidate,
  removeFilterCandidate,
  toggleFilterCandidate,
  type SharedRouteFilters,
} from "../sharedRouteFilters";

type SharedRouteFilterState = {
  language: AppLanguage;
  activeFilters: SharedRouteFilters;
  draftFilters: SharedRouteFilters;
  isDialogOpen: boolean;
};

type SharedRouteFilterAction =
  | { type: "open"; language: AppLanguage }
  | {
      type: "open-with-candidate";
      language: AppLanguage;
      filter: SharedRouteFilterCandidate;
    }
  | {
      type: "replace-with-candidate";
      language: AppLanguage;
      filter: SharedRouteFilterCandidate;
    }
  | {
      type: "toggle-draft";
      language: AppLanguage;
      filter: SharedRouteFilterCandidate;
    }
  | { type: "apply"; language: AppLanguage }
  | {
      type: "remove-active";
      language: AppLanguage;
      filter: SharedRouteFilterCandidate;
    }
  | { type: "clear-active"; language: AppLanguage }
  | { type: "clear-draft"; language: AppLanguage }
  | { type: "close"; language: AppLanguage };

function createInitialFilterState(language: AppLanguage): SharedRouteFilterState {
  return {
    language,
    activeFilters: EMPTY_SHARED_ROUTE_FILTERS,
    draftFilters: EMPTY_SHARED_ROUTE_FILTERS,
    isDialogOpen: false,
  };
}

function sharedRouteFilterReducer(
  storedState: SharedRouteFilterState,
  action: SharedRouteFilterAction
): SharedRouteFilterState {
  const state =
    storedState.language === action.language
      ? storedState
      : createInitialFilterState(action.language);

  switch (action.type) {
    case "open":
      return {
        ...state,
        draftFilters: state.activeFilters,
        isDialogOpen: true,
      };
    case "open-with-candidate":
      return {
        ...state,
        draftFilters: addFilterCandidate(state.activeFilters, action.filter),
        isDialogOpen: true,
      };
    case "replace-with-candidate": {
      const filters = addFilterCandidate(
        EMPTY_SHARED_ROUTE_FILTERS,
        action.filter
      );

      return {
        ...state,
        activeFilters: filters,
        draftFilters: filters,
        isDialogOpen: false,
      };
    }
    case "toggle-draft":
      return {
        ...state,
        draftFilters: toggleFilterCandidate(state.draftFilters, action.filter),
      };
    case "apply":
      return {
        ...state,
        activeFilters: state.draftFilters,
        isDialogOpen: false,
      };
    case "remove-active":
      return {
        ...state,
        activeFilters: removeFilterCandidate(
          state.activeFilters,
          action.filter
        ),
      };
    case "clear-active":
      return {
        ...state,
        activeFilters: EMPTY_SHARED_ROUTE_FILTERS,
      };
    case "clear-draft":
      return {
        ...state,
        draftFilters: EMPTY_SHARED_ROUTE_FILTERS,
      };
    case "close":
      return {
        ...state,
        isDialogOpen: false,
      };
    default:
      return state;
  }
}

/**
 * 팝업을 열 때 적용 필터를 draft로 복사하고 적용 전 변경은 목록 조회에 반영하지 않는다.
 * 언어가 바뀌면 이전 언어의 표시값을 유지하지 않고 빈 필터 상태로 다시 시작한다.
 */
export function useSharedRouteFilters(language: AppLanguage) {
  const [storedState, dispatch] = useReducer(
    sharedRouteFilterReducer,
    language,
    createInitialFilterState
  );
  const state =
    storedState.language === language
      ? storedState
      : createInitialFilterState(language);

  const openFilterDialog = useCallback(() => {
    dispatch({ type: "open", language });
  }, [language]);

  const openFilterDialogWithCandidate = useCallback(
    (filter: SharedRouteFilterCandidate) => {
      dispatch({ type: "open-with-candidate", language, filter });
    },
    [language]
  );

  const toggleDraftFilter = useCallback(
    (filter: SharedRouteFilterCandidate) => {
      dispatch({ type: "toggle-draft", language, filter });
    },
    [language]
  );

  const replaceActiveFiltersWithCandidate = useCallback(
    (filter: SharedRouteFilterCandidate) => {
      dispatch({ type: "replace-with-candidate", language, filter });
    },
    [language]
  );

  const applyFilters = useCallback(() => {
    dispatch({ type: "apply", language });
  }, [language]);

  const removeActiveFilter = useCallback(
    (filter: SharedRouteFilterCandidate) => {
      dispatch({ type: "remove-active", language, filter });
    },
    [language]
  );

  const clearActiveFilters = useCallback(() => {
    dispatch({ type: "clear-active", language });
  }, [language]);

  const clearDraftFilters = useCallback(() => {
    dispatch({ type: "clear-draft", language });
  }, [language]);

  const closeFilterDialog = useCallback(() => {
    dispatch({ type: "close", language });
  }, [language]);

  return {
    activeFilters: state.activeFilters,
    draftFilters: state.draftFilters,
    isFilterDialogOpen: state.isDialogOpen,
    applyFilters,
    clearActiveFilters,
    clearDraftFilters,
    closeFilterDialog,
    openFilterDialog,
    openFilterDialogWithCandidate,
    replaceActiveFiltersWithCandidate,
    removeActiveFilter,
    toggleDraftFilter,
  };
}
