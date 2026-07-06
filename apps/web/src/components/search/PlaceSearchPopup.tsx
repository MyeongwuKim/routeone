import type { RefObject } from "react";
import { IoClose, IoSearch } from "react-icons/io5";
import SelectablePillButton from "@/components/inputs/SelectablePillButton";
import PlaceResultCard from "@/components/place/PlaceResultCard";
import RecentSearchItem from "@/components/search/RecentSearchItem";
import type {
  ResolvedMarkerType,
  SearchFilter,
} from "@/lib/gangwonAttractionMap";
import type { GangwonAttraction } from "@/lib/visitKoreaTourApi";

export type PlaceSearchResult = {
  attraction: GangwonAttraction;
  markerType: ResolvedMarkerType;
  rank: number | null;
  distanceLabel: string | null;
  thumbnailUrl: string;
  icon: string;
  touristTrendName: string;
};

type PlaceSearchPopupProps = {
  searchInputRef: RefObject<HTMLInputElement | null>;
  filters: Array<{
    key: SearchFilter;
    label: string;
  }>;
  searchKeyword: string;
  searchFilter: SearchFilter;
  searchResults: PlaceSearchResult[];
  visibleSearchResults: PlaceSearchResult[];
  recentSearches: string[];
  onKeywordChange: (keyword: string) => void;
  onSearchFilterChange: (filter: SearchFilter) => void;
  onClose: () => void;
  onLoadMore: () => void;
  onResultClick: (result: PlaceSearchResult) => void;
  onRecentSearchSelect: (keyword: string) => void;
  onRecentSearchDelete: (keyword: string) => void;
  onRecentSearchClear: () => void;
};

function PlaceSearchPopup({
  searchInputRef,
  filters,
  searchKeyword,
  searchFilter,
  searchResults,
  visibleSearchResults,
  recentSearches,
  onKeywordChange,
  onSearchFilterChange,
  onClose,
  onLoadMore,
  onResultClick,
  onRecentSearchSelect,
  onRecentSearchDelete,
  onRecentSearchClear,
}: PlaceSearchPopupProps) {
  const hasKeyword = Boolean(searchKeyword.trim());

  return (
    <section className="fixed inset-0 z-[2300] bg-[#071f1f] text-slate-100">
      <div className="flex h-full flex-col">
        <div className="border-b border-brand-400/20 bg-[#0b2524]/95 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
          <div className="flex items-center gap-2">
            <div className="flex h-12 min-w-0 flex-1 items-center rounded-full border border-brand-400/35 bg-[#071718] px-4 shadow-[0_10px_24px_rgba(0,0,0,0.22)]">
              <input
                ref={searchInputRef}
                value={searchKeyword}
                onChange={(event) => onKeywordChange(event.target.value)}
                placeholder="강원도 명소, 카페, 음식점, 축제 검색"
                className="w-full bg-transparent text-sm font-semibold text-slate-100 placeholder:text-slate-400 outline-none"
              />
              {searchKeyword ? (
                <button
                  type="button"
                  aria-label="검색어 지우기"
                  onClick={() => onKeywordChange("")}
                  className="ml-2 text-slate-400 transition hover:text-slate-100"
                >
                  <IoClose />
                </button>
              ) : (
                <span className="ml-2 text-slate-400">
                  <IoSearch />
                </span>
              )}
            </div>
            <button
              type="button"
              aria-label="검색 닫기"
              onClick={onClose}
              className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-brand-400/30 bg-[#0f3431] text-xl text-brand-200 shadow-[0_10px_24px_rgba(0,0,0,0.22)] transition hover:bg-[#13423e]"
            >
              <IoClose />
            </button>
          </div>

          <div className="scrollbar-hide mt-3 flex items-center gap-2 overflow-x-auto pr-2">
            {filters.map((filter) => {
              const isActive = searchFilter === filter.key;
              return (
                <SelectablePillButton
                  key={filter.key}
                  selected={isActive}
                  variant="dark"
                  selectedClassName="border-brand-400 bg-brand-600 text-white shadow-sm shadow-brand-900/30"
                  onClick={() => onSearchFilterChange(filter.key)}
                >
                  {filter.label}
                </SelectablePillButton>
              );
            })}
          </div>
        </div>

        <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto bg-[#071f1f] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          {hasKeyword ? (
            <div className="space-y-2">
              {searchResults.length > 0 ? (
                <>
                  {visibleSearchResults.map((item) => (
                    <PlaceResultCard
                      key={`${item.attraction.id}-${item.attraction.contentTypeId}`}
                      title={item.attraction.title}
                      address={item.attraction.address}
                      categoryLabel={item.markerType.contentTypeLabel}
                      thumbnailUrl={item.thumbnailUrl}
                      fallbackIcon={item.icon}
                      distanceLabel={item.distanceLabel}
                      badgeLabel={
                        item.attraction.isTodayFestival
                          ? "오늘 진행 중"
                          : item.rank
                            ? `예측 집중률 ${item.rank}위`
                            : null
                      }
                      onClick={() => onResultClick(item)}
                    />
                  ))}
                  {visibleSearchResults.length < searchResults.length ? (
                    <button
                      type="button"
                      onClick={onLoadMore}
                      className="w-full rounded-2xl border border-brand-400/30 bg-[#0b2524] px-4 py-3 text-sm font-semibold text-brand-200 shadow-sm transition hover:bg-[#10332f]"
                    >
                      더 보기 {visibleSearchResults.length}/{searchResults.length}
                    </button>
                  ) : null}
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-brand-400/35 bg-[#0b2524] px-4 py-8 text-center text-sm font-semibold text-slate-300">
                  검색 결과가 없습니다.
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-400">최근 검색</p>
                {recentSearches.length > 0 ? (
                  <button
                    type="button"
                    onClick={onRecentSearchClear}
                    className="text-xs font-semibold text-slate-400 transition hover:text-slate-100"
                  >
                    전체 삭제
                  </button>
                ) : null}
              </div>
              {recentSearches.length > 0 ? (
                <div className="space-y-2">
                  {recentSearches.map((keyword) => (
                    <RecentSearchItem
                      key={keyword}
                      keyword={keyword}
                      onSelect={onRecentSearchSelect}
                      onDelete={onRecentSearchDelete}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-brand-400/35 bg-[#0b2524] px-4 py-8 text-center text-sm font-semibold text-slate-300">
                  최근 검색어가 없습니다.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default PlaceSearchPopup;
