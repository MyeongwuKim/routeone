/**
 * 사용 위치: 내 루트 → DAY 일정 → 방문을 마친 날의 하단
 * 용도: 완료한 하루의 사진과 장소를 여행 카드로 바로 열어 저장할 수 있게 한다.
 */
import { MdArrowForward, MdAutoStories } from "react-icons/md";
import { useUiText } from "@/lib/uiText";
import { useRoutePosterPreview } from "../../hooks/useRoutePosterPreview";
import { isVisitedStop } from "../../routeDisplay";
import type { MyRoute, MyRouteDay } from "../../types";
import RoutePosterPreview from "../RoutePosterPreview";

export default function RouteDayMemoryBanner({ route, day }: { route: MyRoute; day: MyRouteDay }) {
  const text = useUiText();
  const poster = useRoutePosterPreview();
  if (!route.isMine || !day.stops.length || !day.stops.every(isVisitedStop)) return null;
  return <>
    <button
      type="button"
      disabled={Boolean(poster.generatingRouteId)}
      onClick={() => void poster.createPoster(route, day.dayIndex)}
      className="flex w-full items-center gap-3 rounded-2xl border border-amber-200 bg-[#fffaf0] p-4 text-left shadow-sm transition active:scale-[.99] disabled:opacity-60 dark:border-amber-300/20 dark:bg-slate-900"
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white text-2xl text-brand-700 shadow-sm dark:bg-slate-800"><MdAutoStories /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-black text-slate-800 dark:text-slate-100">{text.routeHistory.dayMemoryReady(day.dayIndex)}</span>
        <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">{text.routeHistory.dayMemoryDescription}</span>
        <span className="mt-2 flex items-center gap-1 text-xs font-bold text-brand-700 dark:text-brand-300">{poster.generatingRouteId ? text.routeHistory.making : text.routeHistory.openDayMemory}<MdArrowForward /></span>
      </span>
    </button>
    <RoutePosterPreview controller={poster} />
  </>;
}
