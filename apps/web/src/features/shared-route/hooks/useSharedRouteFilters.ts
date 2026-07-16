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
    removeActiveFilter,
    toggleDraftFilter,
  };
}
