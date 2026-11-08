import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { IoArrowForward, IoChevronDown, IoChevronUp } from "react-icons/io5";
import { useAppLanguageStore } from "@/stores/appLanguageStore";
import { usePlaceCartStore } from "@/stores/placeCartStore";
import { useUiText } from "@/lib/uiText";
import { buildHomePlaceListItems, type HomePlaceListItemModel } from "../homePlaceListModel";
import { getHomePlaceListText } from "../homePlaceListText";
import type { HomeSearchResult } from "../homeSearchResults";
import HomePlaceListItem from "./HomePlaceListItem";

type Props = {
  regionLabel: string;
  areaCode: string;
  signguCode: string;
  /** 지역·분류·검색어가 바뀔 때만 목록 스크롤을 처음으로 되돌리는 키 */
  scopeKey: string;
  results: HomeSearchResult[];
  totalCount: number;
  isLoading: boolean;
  error: string | null;
  onLoadMore: () => void;
  onOpenPlace: (result: HomeSearchResult) => void;
  onOpenCheckout: () => void;
};

/**
 * 지도 아래에서 장소를 연속으로 담고 기존 코스 생성 화면으로 이어간다.
 * 지역·필터별 조회 결과는 부모에서 받고, 담기·취소와 개수 표시는 기존 카트 Store를 사용한다.
 * 목록을 접으면 지도 영역을 넓히며, 다시 펼칠 때 목록 위치와 담은 선택은 유지한다.
 */
export default function HomePlaceList({ regionLabel, areaCode, signguCode, scopeKey, results, totalCount, isLoading, error, onLoadMore, onOpenPlace, onOpenCheckout }: Props) {
  const language = useAppLanguageStore(state => state.language);
  const savedPlaces = usePlaceCartStore(state => state.savedPlaces);
  const toggleSavedPlace = usePlaceCartStore(state => state.toggleSavedPlace);
  const text = getHomePlaceListText(language);
  const ui = useUiText();
  // 지도 진입 시에는 목록을 접어 두고, 담은 장소 개수와 코스 만들기는 항상 표시한다.
  const [isExpanded, setIsExpanded] = useState(false);
  const listContentId = useId();
  const scrollRef = useRef<HTMLDivElement>(null);
  const preservedScrollTopRef = useRef(0);
  const items = useMemo(() => buildHomePlaceListItems({
    results, areaCode, signguCode, savedPlaces: savedPlaces.map(item => item.place),
  }), [results, areaCode, signguCode, savedPlaces]);

  useLayoutEffect(() => {
    preservedScrollTopRef.current = 0;
    scrollRef.current?.scrollTo({ top: 0 });
  }, [scopeKey]);

  useLayoutEffect(() => {
    if (isExpanded) {
      scrollRef.current?.scrollTo({ top: preservedScrollTopRef.current });
    }
  }, [isExpanded]);

  const handleToggleExpanded = () => {
    if (isExpanded) {
      preservedScrollTopRef.current = scrollRef.current?.scrollTop ?? 0;
    }
    setIsExpanded(expanded => !expanded);
  };

  const handleTogglePlace = (item: HomePlaceListItemModel) => {
    toggleSavedPlace(item.place, item.result.thumbnailUrl, language);
  };

  return (
    <section aria-label={text.list} className={`relative z-10 flex min-h-0 shrink-0 flex-col border-t border-brand-100 bg-white dark:border-brand-400/20 dark:bg-[#0b211f] ${isExpanded ? "basis-[42%]" : "basis-auto"}`}>
      <header className="mx-auto flex w-full max-w-3xl shrink-0 items-center justify-between gap-3 px-4 py-1.5 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="truncate text-sm font-bold text-slate-900 dark:text-slate-50">{text.title(regionLabel)}</h2>
          <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">{text.count(totalCount)}</span>
        </div>
        <button type="button" aria-expanded={isExpanded} aria-controls={listContentId} onClick={handleToggleExpanded} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-bold text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:text-brand-200">
          {isExpanded ? text.collapse : text.expand}
          {isExpanded ? <IoChevronDown aria-hidden="true" /> : <IoChevronUp aria-hidden="true" />}
        </button>
      </header>
      <div id={listContentId} ref={scrollRef} hidden={!isExpanded} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6" aria-busy={isLoading}>
        <div className="mx-auto max-w-3xl">
          {items.length > 0 ? <>
            <ul>{items.map(item => <HomePlaceListItem key={item.place.id} item={item} text={text} onOpen={onOpenPlace} onToggle={handleTogglePlace} />)}</ul>
            {results.length < totalCount ? <button type="button" onClick={onLoadMore} className="my-2 min-h-11 w-full rounded-xl border border-brand-200 px-4 text-sm font-semibold text-brand-700 dark:border-brand-400/25 dark:text-brand-100">{ui.search.more(results.length, totalCount)}</button> : null}
          </> : isLoading ? <div role="status" className="py-4 text-sm text-slate-500 dark:text-slate-400">
            <p>{text.loading}</p>
            <div aria-hidden="true" className="mt-3 space-y-3">{[0, 1].map(index => <div key={index} className="skeleton-shimmer h-16 rounded-xl bg-slate-100 dark:bg-brand-900/30" />)}</div>
          </div> : <div role="status" className="py-5 text-center text-sm text-slate-600 dark:text-slate-300">
            <p>{error ? text.error : text.empty}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{error ?? text.emptyDescription}</p>
          </div>}
        </div>
      </div>
      <footer className="shrink-0 border-t border-brand-100 px-4 py-3 dark:border-brand-400/20 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <p aria-live="polite" aria-atomic="true" className="text-sm font-bold text-slate-700 dark:text-slate-200">{text.selected(savedPlaces.length)}</p>
          <button type="button" onClick={onOpenCheckout} disabled={savedPlaces.length === 0} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-bold text-white disabled:opacity-40">
            {text.checkout}<IoArrowForward aria-hidden="true" />
          </button>
        </div>
      </footer>
    </section>
  );
}
