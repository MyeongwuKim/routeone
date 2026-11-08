import { useCallback, useState } from "react";
import { useStore } from "zustand";
import type { ServiceAreaId } from "@/data/serviceAreas";
import type { AppLanguage } from "@/stores/appLanguageStore";
import type { SharedRouteFilterCandidate } from "../sharedRouteCardModel";
import type { SharedRoutePageMode } from "../sharedRouteListModel";
import {
  EMPTY_SHARED_ROUTE_FILTERS,
  addFilterCandidate,
  removeFilterCandidate,
  toggleFilterCandidate,
  type SharedRouteFilters,
} from "../sharedRouteFilters";
import { createSharedRouteSelectionStore, sharedRouteFeedSelectionStore } from "../stores/sharedRouteSelectionStore";

type FilterDraft = { language: AppLanguage; filters: SharedRouteFilters };

/**
 * 공개 피드는 Zustand에 적용 조건을 보관하고, 좋아요 목록은 별도 인스턴스를 사용한다.
 * 팝업을 열 때 적용 필터를 복사하며, 확인하기 전까지 편집 중인 값은 화면에만 남는다.
 */
export function useSharedRouteFilters(
  language: AppLanguage,
  mode: SharedRoutePageMode,
  defaultAreaId: ServiceAreaId
) {
  const [selectionStore] = useState(() =>
    mode === "feed" ? sharedRouteFeedSelectionStore : createSharedRouteSelectionStore()
  );
  const [draft, setDraft] = useState<FilterDraft | null>(null);
  const areaId = useStore(selectionStore, (state) => state.areaId);
  const applied = useStore(selectionStore, (state) => state.applied);
  const activeFilters = applied?.language === language ? applied.filters : EMPTY_SHARED_ROUTE_FILTERS;
  const currentDraft = draft?.language === language ? draft : null;

  const selectArea = useCallback((nextAreaId: ServiceAreaId | null) => {
    selectionStore.getState().selectArea(nextAreaId);
    setDraft(null);
  }, [selectionStore]);

  /** 기본 시·도를 보고 있었다면 필터 적용 시 그 시·도도 고정해 함께 복원한다. */
  const updateActiveFilters = useCallback((update: (filters: SharedRouteFilters) => SharedRouteFilters) => {
    const { areaId: currentAreaId, updateFilters } = selectionStore.getState();
    updateFilters(currentAreaId ?? (mode === "feed" ? defaultAreaId : null), language, update);
  }, [defaultAreaId, language, mode, selectionStore]);

  const openFilterDialog = useCallback(() => {
    setDraft({ language, filters: activeFilters });
  }, [activeFilters, language]);

  const openFilterDialogWithCandidate = useCallback((filter: SharedRouteFilterCandidate) => {
    setDraft({ language, filters: addFilterCandidate(activeFilters, filter) });
  }, [activeFilters, language]);

  const toggleDraftFilter = useCallback((filter: SharedRouteFilterCandidate) => {
    setDraft((current) => current?.language === language
      ? { ...current, filters: toggleFilterCandidate(current.filters, filter) }
      : current);
  }, [language]);

  const replaceActiveFiltersWithCandidate = useCallback((filter: SharedRouteFilterCandidate) => {
    updateActiveFilters(() => addFilterCandidate(EMPTY_SHARED_ROUTE_FILTERS, filter));
    setDraft(null);
  }, [updateActiveFilters]);

  const applyFilters = useCallback(() => {
    if (!currentDraft) return;
    updateActiveFilters(() => currentDraft.filters);
    setDraft(null);
  }, [currentDraft, updateActiveFilters]);

  const removeActiveFilter = useCallback((filter: SharedRouteFilterCandidate) => {
    updateActiveFilters((filters) => removeFilterCandidate(filters, filter));
  }, [updateActiveFilters]);

  const clearActiveFilters = useCallback(() => {
    updateActiveFilters(() => EMPTY_SHARED_ROUTE_FILTERS);
  }, [updateActiveFilters]);

  const clearDraftFilters = useCallback(() => {
    setDraft((current) => current?.language === language
      ? { ...current, filters: EMPTY_SHARED_ROUTE_FILTERS }
      : current);
  }, [language]);

  const closeFilterDialog = useCallback(() => {
    setDraft(null);
  }, []);

  return {
    areaId,
    selectArea,
    activeFilters,
    draftFilters: currentDraft?.filters ?? EMPTY_SHARED_ROUTE_FILTERS,
    isFilterDialogOpen: currentDraft !== null,
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
