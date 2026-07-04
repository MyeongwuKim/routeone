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
  return (
    <>
      <div className="pointer-events-none absolute inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-20 flex items-center justify-between">
        <button
          type="button"
          aria-label="장소 검색 열기"
          onClick={onOpenSearch}
          className="pointer-events-auto flex h-12 flex-1 items-center rounded-full border border-brand-200 bg-white/95 px-4 text-left shadow-md backdrop-blur"
        >
          <span className="text-base text-brand-500">
            <IoSearch />
          </span>
          <span className="ml-2 w-full truncate text-sm font-semibold text-slate-400">
            강원도 명소 검색
          </span>
        </button>
        <button
          type="button"
          aria-label="담은 장소"
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
                <span>{region.label}</span>
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

export default HomeMapControls;
