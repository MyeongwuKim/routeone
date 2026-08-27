import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  MdClose,
  MdFilterAlt,
  MdOutlinePlace,
  MdSell,
} from "react-icons/md";
import { useUiText } from "@/lib/uiText";
import { useAppLanguageStore } from "@/stores/appLanguageStore";
import type { SharedRouteFilterCandidate } from "../sharedRouteCardModel";
import {
  SHARED_ROUTE_FILTER_PLACE_SOURCE_ENABLED,
  fetchRegionFilterPlaceCategories,
  getActiveFilterCount,
  getLocalizedPlaceCategory,
  getLocalizedRegionName,
  hasFilterCandidate,
  mergePlaceCategories,
  type SharedRouteFilterOptions,
  type SharedRouteFilters,
} from "../sharedRouteFilters";

type SharedRouteFilterDialogProps = {
  filters: SharedRouteFilters;
  tagOptions: string[];
  placeRegions: SharedRouteFilterOptions["placeRegions"];
  onToggle: (filter: SharedRouteFilterCandidate) => void;
  onClear: () => void;
  onClose: () => void;
  onConfirm: () => void;
};

function SharedRouteFilterDialog({
  filters,
  tagOptions,
  placeRegions,
  onToggle,
  onClear,
  onClose,
  onConfirm,
}: SharedRouteFilterDialogProps) {
  const text = useUiText();
  const appLanguage = useAppLanguageStore((state) => state.language);
  const activeFilterCount = getActiveFilterCount(filters);
  const [focusedRegion, setFocusedRegion] = useState<string | null>(
    filters.places[0]?.region ?? filters.regions[0] ?? null
  );
  const resolvedFocusedRegion =
    focusedRegion && filters.regions.includes(focusedRegion)
      ? focusedRegion
      : (filters.regions[0] ?? null);
  const focusedRegionOption = placeRegions.find(
    (placeRegion) => placeRegion.region === resolvedFocusedRegion
  );
  const focusedRegionPlaceCategoriesQuery = useQuery({
    queryKey: [
      "shared-route-filter-places",
      resolvedFocusedRegion,
      appLanguage,
    ],
    enabled: Boolean(
      resolvedFocusedRegion && SHARED_ROUTE_FILTER_PLACE_SOURCE_ENABLED
    ),
    queryFn: () =>
      fetchRegionFilterPlaceCategories(resolvedFocusedRegion ?? "", appLanguage),
    staleTime: 1000 * 60 * 60 * 12,
    gcTime: 1000 * 60 * 60 * 24,
  });
  const focusedRegionCategories = mergePlaceCategories(
    focusedRegionOption?.categories ?? [],
    focusedRegionPlaceCategoriesQuery.data ?? []
  );
  const focusedRegionSelectedCount = filters.places.filter(
    (place) => place.region === resolvedFocusedRegion
  ).length;
  const shouldShowFocusedRegionLoading =
    Boolean(
      resolvedFocusedRegion && SHARED_ROUTE_FILTER_PLACE_SOURCE_ENABLED
    ) &&
    focusedRegionPlaceCategoriesQuery.isFetching &&
    focusedRegionCategories.length === 0;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const renderFilterButton = (filter: SharedRouteFilterCandidate) => {
    const isSelected = hasFilterCandidate(filters, filter);
    const Icon = filter.type === "tag" ? MdSell : MdOutlinePlace;

    return (
      <button
        key={
          filter.type === "place"
            ? `${filter.type}:${filter.region}:${filter.value}`
            : `${filter.type}:${filter.value}`
        }
        type="button"
        aria-pressed={isSelected}
        onClick={() => onToggle(filter)}
        className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-black transition ${
          isSelected
            ? "border-brand-500 bg-brand-600 text-white"
            : "border-slate-200 bg-white text-slate-600 hover:border-brand-300 dark:border-brand-400/25 dark:bg-[#0b211f] dark:text-slate-200"
        }`}
      >
        <Icon className="shrink-0 text-sm" />
        <span className="min-w-0 truncate">{filter.value}</span>
      </button>
    );
  };

  return (
    <div
      className="shared-route-filter-backdrop-enter fixed inset-0 z-[2700] flex items-end justify-center bg-slate-950/50 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center sm:pb-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="shared-route-filter-title"
        className="shared-route-filter-panel-enter flex max-h-[min(82dvh,42rem)] w-full max-w-sm flex-col overflow-hidden rounded-[1.4rem] border border-brand-200 bg-white shadow-2xl dark:border-brand-400/30 dark:bg-[#102a27]"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 p-4 pb-3 dark:border-brand-400/20">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-xl text-brand-700 dark:bg-brand-400/15 dark:text-brand-100">
              <MdFilterAlt />
            </span>
            <div className="min-w-0">
              <h2
                id="shared-route-filter-title"
                className="text-base font-bold text-slate-900 dark:text-white"
              >
                {text.sharedRoute.filterTitle}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {text.sharedRoute.filterDescription}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label={text.sharedRoute.filterClose}
            onClick={onClose}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 dark:border-brand-400/30 dark:bg-[#0b211f] dark:text-slate-200"
          >
            <MdClose />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-4 [-webkit-overflow-scrolling:touch]">
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-black text-slate-800 dark:text-white">
                {text.sharedRoute.tagFilter}
              </p>
              <p className="text-xs font-bold text-slate-400">
                {text.myRoute.count(filters.tags.length)}
              </p>
            </div>
            {tagOptions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {tagOptions.map((tag) =>
                  renderFilterButton({ type: "tag", value: tag })
                )}
              </div>
            ) : (
              <p className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3 text-xs font-semibold text-slate-500 dark:border-brand-400/20 dark:bg-[#0b211f] dark:text-slate-300">
                {text.sharedRoute.noTags}
              </p>
            )}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-black text-slate-800 dark:text-white">
                {text.sharedRoute.regionFilter}
              </p>
              <p className="text-xs font-bold text-slate-400">
                {text.myRoute.count(filters.regions.length)}
              </p>
            </div>
            {placeRegions.length > 0 ? (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {placeRegions.map(({ region }) => {
                    const isSelected = filters.regions.includes(region);

                    return (
                      <button
                        key={region}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => {
                          onToggle({ type: "region", value: region });
                          setFocusedRegion(isSelected ? null : region);
                        }}
                        className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-black transition ${
                          isSelected
                            ? "border-brand-500 bg-brand-600 text-white"
                            : "border-slate-200 bg-white text-slate-600 hover:border-brand-300 dark:border-brand-400/25 dark:bg-[#0b211f] dark:text-slate-200"
                        }`}
                      >
                        <MdOutlinePlace className="shrink-0 text-sm" />
                        <span className="min-w-0 truncate">
                          {getLocalizedRegionName(region, text)}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {resolvedFocusedRegion ? (
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-brand-400/20 dark:bg-[#0b211f]">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="min-w-0 text-xs font-black text-slate-700 dark:text-slate-100">
                        {text.sharedRoute.regionPlaces(
                          getLocalizedRegionName(resolvedFocusedRegion, text)
                        )}
                      </p>
                      <p className="shrink-0 text-[11px] font-bold text-slate-400">
                        {text.sharedRoute.selectedCount(focusedRegionSelectedCount)}
                      </p>
                    </div>
                    {focusedRegionCategories.length > 0 ? (
                      <div className="space-y-4">
                        {focusedRegionCategories.map(({ category, places }) => (
                          <div
                            key={`${resolvedFocusedRegion}:${category}`}
                            className="space-y-2"
                          >
                            <div className="flex items-center gap-2">
                              <p className="shrink-0 text-xs font-black text-slate-700 dark:text-slate-100">
                                {getLocalizedPlaceCategory(category, text)}
                              </p>
                              <span className="h-px flex-1 bg-slate-200 dark:bg-brand-400/20" />
                              <p className="shrink-0 text-[11px] font-bold text-slate-400">
                                {text.sharedRoute.placeCount(places.length)}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {places.map((placeName) =>
                                renderFilterButton({
                                  type: "place",
                                  value: placeName,
                                  region: resolvedFocusedRegion,
                                })
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : shouldShowFocusedRegionLoading ? (
                      <div
                        role="status"
                        className="flex items-center gap-2 py-2 text-xs text-slate-500 dark:text-slate-300"
                      >
                        <span
                          aria-hidden="true"
                          className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent"
                        />
                        {text.sharedRoute.loadingRegionPlaces}
                      </div>
                    ) : (
                      <p className="px-1 py-2 text-xs font-semibold text-slate-500 dark:text-slate-300">
                        {text.sharedRoute.noRegionPlaces}
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3 text-xs font-semibold text-slate-500 dark:border-brand-400/20 dark:bg-[#0b211f] dark:text-slate-300">
                {text.sharedRoute.noPlaces}
              </p>
            )}
          </div>
        </div>

        <div className="grid shrink-0 grid-cols-[auto,1fr] gap-2 border-t border-slate-100 bg-white p-4 dark:border-brand-400/20 dark:bg-[#102a27]">
          <button
            type="button"
            onClick={onClear}
            disabled={activeFilterCount === 0}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-500 disabled:opacity-40 dark:border-brand-400/30 dark:bg-[#0b211f] dark:text-slate-200"
          >
            {text.common.reset}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-2xl border border-brand-500 bg-brand-600 px-4 py-3 text-sm font-bold text-white"
          >
            {text.sharedRoute.apply(activeFilterCount)}
          </button>
        </div>
      </section>
    </div>
  );
}

export default SharedRouteFilterDialog;
