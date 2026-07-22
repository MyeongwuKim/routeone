import {
  IoBagHandleOutline,
  IoCafeOutline,
  IoLocationSharp,
  IoMapOutline,
  IoRestaurantOutline,
  IoSearch,
  IoTicketOutline,
} from "react-icons/io5";
import SelectablePillButton from "@/components/inputs/SelectablePillButton";
import type { SearchFilter } from "@/lib/gangwonAttractionMap";
import { useUiText } from "@/lib/uiText";

type RegionOption = {
  label: string;
  sigunguCode: string;
};

type SearchFilterOption = {
  key: SearchFilter;
  label: string;
};

type HomeMapControlsProps = {
  regions: ReadonlyArray<RegionOption>;
  selectedSigunguCode: string;
  selectedRegionLabel: string;
  festivalCountBySigunguCode: Map<string, number>;
  filters: ReadonlyArray<SearchFilterOption>;
  selectedFilter: SearchFilter;
  savedPlaceCount: number;
  isSavedPlaceCountLoading: boolean;
  onOpenSearch: () => void;
  onOpenSavedList: () => void;
  onSelectRegion: (sigunguCode: string) => void;
  onSelectFilter: (filter: SearchFilter) => void;
};

const REGION_SKELETON_WIDTHS = ["w-14", "w-20", "w-16", "w-20", "w-16"];
const FILTER_SKELETON_WIDTHS = ["w-20", "w-24", "w-24", "w-20", "w-20"];

function SearchFilterIcon({ filter }: { filter: SearchFilter }) {
  if (filter === "all") {
    return <IoMapOutline className="text-sm" />;
  }

  if (filter === "tourist") {
    return <IoLocationSharp className="text-sm" />;
  }

  if (filter === "food") {
    return <IoRestaurantOutline className="text-sm" />;
  }

  if (filter === "cafe") {
    return <IoCafeOutline className="text-sm" />;
  }

  return <IoTicketOutline className="text-sm" />;
}

function HomeMapControls({
  regions,
  selectedSigunguCode,
  selectedRegionLabel,
  festivalCountBySigunguCode,
  filters,
  selectedFilter,
  savedPlaceCount,
  isSavedPlaceCountLoading,
  onOpenSearch,
  onOpenSavedList,
  onSelectRegion,
  onSelectFilter,
}: HomeMapControlsProps) {
  const text = useUiText();

  return (
    <>
      <div className="pointer-events-none absolute inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-20 flex items-center justify-between">
        <button
          type="button"
          aria-label={text.home.openSearchAria}
          onClick={onOpenSearch}
          className="pointer-events-auto flex h-12 flex-1 items-center rounded-full border border-brand-200 bg-white/95 px-4 text-left shadow-md backdrop-blur"
        >
          <span className="text-base text-brand-500">
            <IoSearch />
          </span>
          <span className="ml-2 w-full truncate text-sm font-semibold text-slate-400">
            {text.home.searchPrompt(selectedRegionLabel)}
          </span>
        </button>
        <button
          type="button"
          aria-label={text.home.savedPlacesAria}
          onClick={onOpenSavedList}
          className="pointer-events-auto ml-2 inline-flex h-12 items-center gap-2 rounded-full border border-brand-500 bg-brand-600/95 px-3 text-xs font-semibold text-white shadow"
        >
          <IoBagHandleOutline className="text-sm" />
          <span>{isSavedPlaceCountLoading ? "…" : savedPlaceCount}</span>
        </button>
      </div>

      <div className="scrollbar-hide pointer-events-auto absolute inset-x-0 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.4rem)] z-20 overflow-x-auto px-3 pb-1">
        <div className="flex w-max min-w-full gap-2 pr-3">
          {regions.map((region) => {
            const isActive = selectedSigunguCode === region.sigunguCode;
            const festivalCount =
              festivalCountBySigunguCode.get(region.sigunguCode) ?? 0;

            return (
              <SelectablePillButton
                key={region.sigunguCode || "all"}
                selected={isActive}
                onClick={() => onSelectRegion(region.sigunguCode)}
              >
                <span>{text.labels.regions[region.label] ?? region.label}</span>
                {festivalCount > 0 ? (
                  <span
                    className={`inline-flex h-5 items-center rounded-full px-1.5 text-[10px] font-bold ${
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-rose-50 text-rose-700"
                    }`}
                  >
                    🎉 {festivalCount}
                  </span>
                ) : null}
              </SelectablePillButton>
            );
          })}
        </div>
      </div>

      <div className="scrollbar-hide pointer-events-auto absolute inset-x-0 top-[calc(max(0.75rem,env(safe-area-inset-top))+6.1rem)] z-20 overflow-x-auto px-3 pb-1">
        <div className="flex w-max min-w-full gap-2 pr-3">
          {filters.map((filter) => {
            const isActive = selectedFilter === filter.key;
            return (
              <SelectablePillButton
                key={filter.key}
                selected={isActive}
                icon={<SearchFilterIcon filter={filter.key} />}
                onClick={() => onSelectFilter(filter.key)}
              >
                {filter.label}
              </SelectablePillButton>
            );
          })}
        </div>
      </div>
    </>
  );
}

export function HomeMapControlsSkeleton() {
  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-20 flex items-center justify-between"
      >
        <div className="skeleton-shimmer h-12 flex-1 rounded-full border border-white/80 bg-white/95 shadow-md" />
        <div className="skeleton-shimmer ml-2 h-12 w-16 rounded-full border border-brand-200 bg-brand-100/95 shadow" />
      </div>

      <div
        aria-hidden="true"
        className="scrollbar-hide pointer-events-none absolute inset-x-0 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.4rem)] z-20 overflow-hidden px-3 pb-1"
      >
        <div className="flex w-max min-w-full gap-2 pr-3">
          {REGION_SKELETON_WIDTHS.map((widthClassName, index) => (
            <div
              key={`region-skeleton-${index}`}
              className={`skeleton-shimmer h-8 shrink-0 rounded-full border shadow-sm ${
                index === 0
                  ? "w-14 border-brand-500 bg-brand-500/85"
                  : `${widthClassName} border-brand-100 bg-white/95`
              }`}
            />
          ))}
        </div>
      </div>

      <div
        aria-hidden="true"
        className="scrollbar-hide pointer-events-none absolute inset-x-0 top-[calc(max(0.75rem,env(safe-area-inset-top))+6.1rem)] z-20 overflow-hidden px-3 pb-1"
      >
        <div className="flex w-max min-w-full gap-2 pr-3">
          {FILTER_SKELETON_WIDTHS.map((widthClassName, index) => (
            <div
              key={`filter-skeleton-${index}`}
              className={`skeleton-shimmer h-8 shrink-0 rounded-full border shadow-sm ${
                index === 0
                  ? "w-20 border-brand-500 bg-brand-500/85"
                  : `${widthClassName} border-brand-100 bg-white/95`
              }`}
            />
          ))}
        </div>
      </div>
    </>
  );
}

export default HomeMapControls;
