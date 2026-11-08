import { IoAdd, IoCheckmark } from "react-icons/io5";
import { localizePlaceCategoryLabel, useUiText } from "@/lib/uiText";
import type { HomePlaceListItemModel } from "../homePlaceListModel";
import type { HomePlaceListText } from "../homePlaceListText";
import type { HomeSearchResult } from "../homeSearchResults";

/** 장소 사진·이름은 상세 열기로, 담기 버튼은 목록을 유지하는 선택·취소로 연결한다. */
export default function HomePlaceListItem({ item, text, onOpen, onToggle }: {
  item: HomePlaceListItemModel;
  text: HomePlaceListText;
  onOpen: (result: HomeSearchResult) => void;
  onToggle: (item: HomePlaceListItemModel) => void;
}) {
  const ui = useUiText();
  const { result, place, isSaved } = item;

  return (
    <li className="flex items-center gap-3 border-b border-slate-100 py-3 last:border-0 dark:border-brand-400/10">
      <button type="button" aria-label={text.details(place.title)} onClick={() => onOpen(result)} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
        <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-50 text-xl dark:bg-brand-900/30">
          {result.thumbnailUrl ? <img src={result.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover" /> : result.icon}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold text-slate-900 dark:text-slate-50">{place.title}</span>
          <span className="mt-1 block text-xs text-brand-700 dark:text-brand-200">
            {localizePlaceCategoryLabel(place.contentTypeLabel, ui)}{result.distanceLabel ? ` · ${result.distanceLabel}` : ""}
          </span>
          <span className="mt-1 block truncate text-xs text-slate-500 dark:text-slate-400">{place.address}</span>
        </span>
      </button>
      <button type="button" aria-label={text.toggle(place.title)} aria-pressed={isSaved} onClick={() => onToggle(item)} className="inline-flex min-h-11 min-w-20 shrink-0 items-center justify-center gap-1 rounded-xl border border-brand-200 bg-white px-3 text-sm font-bold text-brand-700 transition aria-pressed:border-brand-600 aria-pressed:bg-brand-600 aria-pressed:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:border-brand-400/30 dark:bg-transparent dark:text-brand-100 dark:aria-pressed:bg-brand-600">
        {isSaved ? <IoCheckmark aria-hidden="true" /> : <IoAdd aria-hidden="true" />}
        {isSaved ? text.added : text.add}
      </button>
    </li>
  );
}
