import { Link } from "react-router-dom";
import { MdArrowForward, MdMap } from "react-icons/md";
import type { HomeRecommendationText } from "./homeRecommendationText";

/** 홈 첫 화면에서 기존 장소 지도로 바로 들어간다. 현재 선택한 지역은 기존 지도 준비 동작으로 전달한다. */
export default function HomeMapEntry({ href, onOpen, text }: {
  href: string;
  onOpen: () => void;
  text: HomeRecommendationText;
}) {
  return (
    <Link to={href} onClick={onOpen} className="mb-6 flex min-h-24 items-center gap-4 rounded-3xl border border-brand-200 bg-brand-50 px-4 py-4 transition hover:border-brand-400 hover:bg-brand-100 sm:mb-8 sm:px-5 dark:border-brand-400/30 dark:bg-brand-900/40 dark:hover:bg-brand-900/60">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand-600 text-2xl text-white">
        <MdMap aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-bold text-brand-900 dark:text-brand-100">{text.mapEntryTitle}</span>
        <span className="mt-1 block text-xs leading-5 text-brand-800/80 dark:text-brand-200/80">{text.mapEntryDescription}</span>
      </span>
      <MdArrowForward aria-hidden="true" className="shrink-0 text-xl text-brand-700 dark:text-brand-200" />
    </Link>
  );
}
