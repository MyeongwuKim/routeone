import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { IoArrowForward, IoChevronUp } from "react-icons/io5";
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

const EXPANDED_PANEL_HEIGHT_RATIO = 0.42;

/**
 * 지도 아래에서 장소를 연속으로 담고 기존 코스 생성 화면으로 이어간다.
 * 지역·필터별 조회 결과는 부모에서 받고, 담기·취소와 개수 표시는 기존 카트 Store를 사용한다.
 * 목록 본문의 높이를 전환해 지도 영역도 함께 조절한다. 본문을 유지해 목록 위치와 담은 선택을 보존한다.
 */
export default function HomePlaceList({ regionLabel, areaCode, signguCode, scopeKey, results, totalCount, isLoading, error, onLoadMore, onOpenPlace, onOpenCheckout }: Props) {
  const language = useAppLanguageStore(state => state.language);
  const savedPlaces = usePlaceCartStore(state => state.savedPlaces);
  const toggleSavedPlace = usePlaceCartStore(state => state.toggleSavedPlace);
  const text = getHomePlaceListText(language);
  const ui = useUiText();
  // 지도 진입 시에는 목록을 접어 두고, 담은 장소 개수와 코스 만들기는 항상 표시한다.
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedListHeight, setExpandedListHeight] = useState(0);
  const listContentId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const footerRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const items = useMemo(() => buildHomePlaceListItems({
    results, areaCode, signguCode, savedPlaces: savedPlaces.map(item => item.place),
  }), [results, areaCode, signguCode, savedPlaces]);

  useLayoutEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [scopeKey]);

  // 펼친 패널의 비율은 유지하고, 항상 보이는 헤더·푸터를 뺀 본문 높이만 전환한다.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    const parent = panel?.parentElement;
    const header = headerRef.current;
    const footer = footerRef.current;
    if (!panel || !parent || !header || !footer) return;

    const updateListHeight = () => {
      const panelHeight = parent.clientHeight * EXPANDED_PANEL_HEIGHT_RATIO;
      const fixedHeight = header.offsetHeight + footer.offsetHeight + panel.clientTop;
      setExpandedListHeight(Math.max(0, panelHeight - fixedHeight));
    };
    const observer = new ResizeObserver(updateListHeight);
    observer.observe(parent);
    observer.observe(header);
    observer.observe(footer);
    updateListHeight();
    return () => observer.disconnect();
  }, []);

  const handleTogglePlace = (item: HomePlaceListItemModel) => {
    toggleSavedPlace(item.place, item.result.thumbnailUrl, language);
  };

  return (
    <section ref={panelRef} aria-label={text.list} className="relative z-10 flex min-h-0 shrink-0 flex-col border-t border-brand-100 bg-white dark:border-brand-400/20 dark:bg-[#0b211f]">
      <header ref={headerRef} className="mx-auto flex w-full max-w-3xl shrink-0 items-center justify-between gap-3 px-4 py-1.5 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="truncate text-sm font-bold text-slate-900 dark:text-slate-50">{text.title(regionLabel)}</h2>
          <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">{text.count(totalCount)}</span>
        </div>
        <button type="button" aria-expanded={isExpanded} aria-controls={listContentId} onClick={() => setIsExpanded(expanded => !expanded)} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-bold text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:text-brand-200">
          {isExpanded ? text.collapse : text.expand}
          <IoChevronUp aria-hidden="true" className={`motion-safe:transition-transform motion-safe:duration-300 ${isExpanded ? "rotate-180" : ""}`} />
        </button>
      </header>
      <div
        id={listContentId}
        ref={scrollRef}
        inert={!isExpanded}
        aria-hidden={!isExpanded}
        aria-busy={isLoading}
        style={{ height: isExpanded ? expandedListHeight : 0 }}
        className={`min-h-0 shrink-0 overflow-y-auto overscroll-contain px-4 motion-safe:transition-[height,opacity] motion-safe:duration-300 motion-safe:ease-out sm:px-6 ${isExpanded ? "opacity-100" : "opacity-0"}`}
      >
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
      <footer ref={footerRef} className="shrink-0 border-t border-brand-100 px-4 py-3 dark:border-brand-400/20 sm:px-6">
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
