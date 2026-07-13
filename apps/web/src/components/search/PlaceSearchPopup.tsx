import type { RefObject } from "react";
import { IoClose, IoSearch, IoTrashOutline } from "react-icons/io5";
import { PotatoLoadingCard } from "@/components/feedback/PotatoLoadingOverlay";
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
  onSearchSubmit: (keyword: string) => void;
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
  onSearchSubmit,
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
    <section className="fixed inset-0 z-[2300] bg-slate-50 text-slate-900 dark:bg-[#071718] dark:text-slate-100">
      <div className="flex h-full flex-col">
        <div className="border-b border-slate-200 bg-white/95 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] shadow-sm backdrop-blur dark:border-brand-400/20 dark:bg-[#0b211f]/95">
          <div className="flex items-center gap-2">
            <form
              className="flex h-12 min-w-0 flex-1 items-center rounded-full border border-slate-200 bg-slate-50/90 px-4 shadow-[0_8px_18px_rgba(15,23,42,0.06)] dark:border-brand-400/25 dark:bg-slate-950/60 dark:shadow-[0_10px_24px_rgba(0,0,0,0.22)]"
              onSubmit={(event) => {
                event.preventDefault();
                onSearchSubmit(searchKeyword);
              }}
            >
              <input
                ref={searchInputRef}
                value={searchKeyword}
                onChange={(event) => onKeywordChange(event.target.value)}
                enterKeyHint="search"
                placeholder="강원도 명소, 카페, 음식점, 축제 검색"
                className="w-full bg-transparent text-sm font-semibold text-slate-800 placeholder:text-slate-400 outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
              />
              {searchKeyword ? (
                <button
                  type="button"
                  aria-label="검색어 지우기"
                  onClick={() => onKeywordChange("")}
                  className="ml-2 text-slate-400 transition hover:text-slate-700 dark:hover:text-slate-100"
                >
                  <IoClose />
                </button>
              ) : (
                <span className="ml-2 text-slate-400 dark:text-slate-500">
                  <IoSearch />
                </span>
              )}
            </form>
            <button
              type="button"
              aria-label="검색 닫기"
              onClick={onClose}
              className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-xl text-slate-500 shadow-[0_8px_18px_rgba(15,23,42,0.06)] transition hover:bg-slate-50 hover:text-slate-700 dark:border-brand-400/25 dark:bg-slate-950/60 dark:text-slate-200 dark:shadow-[0_10px_24px_rgba(0,0,0,0.22)] dark:hover:bg-[#102a27]"
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
                  selectedClassName="border-brand-500 bg-brand-50 text-brand-700 shadow-sm shadow-brand-100 dark:border-brand-300 dark:bg-brand-400/15 dark:text-brand-100 dark:shadow-brand-950/30"
                  onClick={() => onSearchFilterChange(filter.key)}
                >
                  {filter.label}
                </SelectablePillButton>
              );
            })}
          </div>
        </div>

        <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto bg-slate-50 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 dark:bg-[#071718]">
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
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-brand-300 hover:text-brand-700 dark:border-brand-400/25 dark:bg-[#0b211f] dark:text-slate-200 dark:hover:border-brand-300/60 dark:hover:text-brand-100"
                    >
                      더 보기 {visibleSearchResults.length}/{searchResults.length}
                    </button>
                  ) : null}
                </>
              ) : (
                <PotatoLoadingCard
                  title="검색 결과가 없어요"
                  description="감자가 다른 장소도 꼼꼼히 찾아봤어요."
                  footerText="검색어나 카테고리를 바꿔보세요."
                  animation="searching"
                  compact
                  className="shadow-sm"
                />
              )}
            </div>
          ) : (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  최근 검색
                </p>
                {recentSearches.length > 0 ? (
                  <button
                    type="button"
                    onClick={onRecentSearchClear}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 transition hover:text-rose-600 dark:hover:text-rose-300"
                  >
                    <IoTrashOutline aria-hidden="true" />
                    전체 비우기
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
                <PotatoLoadingCard
                  title="아직 최근 검색어가 없어요"
                  description="감자가 첫 번째 검색을 기다리고 있어요."
                  footerText="장소를 검색하면 여기에 기록돼요."
                  animation="empty"
                  compact
                  className="shadow-sm"
                />
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default PlaceSearchPopup;
