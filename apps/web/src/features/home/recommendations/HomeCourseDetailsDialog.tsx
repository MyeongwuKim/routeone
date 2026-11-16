import { useId } from "react";
import { createPortal } from "react-dom";
import { IoAlertCircleOutline, IoClose } from "react-icons/io5";
import { MdArrowForward, MdChevronRight, MdLandscape } from "react-icons/md";
import { useTourCourseDescription } from "@/hooks/useTourCourseLocalization";
import { getUiText } from "@/lib/uiText";
import type { AppLanguage } from "@/stores/appLanguageStore";
import { useMapSheetStore, type MapSheetCourseStopDescription } from "@/stores/mapSheetStore";
import { useUiModalStore } from "@/stores/uiModalStore";
import type { MapSheetPlace } from "@/types/place";
import HomeCourseFacts from "./HomeCourseFacts";
import type { HomeRecommendationText } from "./homeRecommendationText";
import { useHomeCourseDialog } from "./useHomeCourseDialog";
import { useHomeCourseStops, type useHomeCoursePreview } from "./useHomeRecommendations";

type Props = {
  courseId: string;
  language: AppLanguage;
  text: HomeRecommendationText;
  preview: Pick<ReturnType<typeof useHomeCoursePreview>, "title" | "description" | "image" | "distance" | "duration" | "theme" | "markImageFailed">;
  onClose: () => void;
  onPlaceSelect: (place: MapSheetPlace, description: MapSheetCourseStopDescription) => void;
  onStartCourse: (places: MapSheetPlace[]) => void;
};

type CourseStopProps = {
  stop: NonNullable<ReturnType<typeof useHomeCourseStops>["data"]>[number];
  number: number;
  language: AppLanguage;
  text: HomeRecommendationText;
  onPlaceSelect: (place: MapSheetPlace, description: MapSheetCourseStopDescription, trigger: HTMLButtonElement) => void;
  onUnavailable: (title: string, trigger: HTMLButtonElement) => void;
};

/** 공식 방문 순서와 장소별 설명을 보여주고, 위치가 없는 방문지는 기존 안내로 연결한다. */
function CourseStop({ stop, number, language, text, onPlaceSelect, onUnavailable }: CourseStopProps) {
  const description = useTourCourseDescription(stop.description.contentId, stop.description.text, language);
  const place = stop.place;
  const content = (
    <>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-800 dark:bg-brand-900 dark:text-brand-100">{number}</span>
      <span className="min-w-0 flex-1">
        <span className="block break-words text-sm font-bold leading-6 text-slate-900 dark:text-slate-100">{stop.title}</span>
        {stop.place?.address ? <span className="mt-0.5 block break-words text-xs leading-5 text-slate-500 dark:text-slate-400">{stop.place.address}</span> : null}
        {description.text ? <span lang={description.lang} className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{description.text}</span> : null}
      </span>
    </>
  );

  return (
    <li className="border-b border-slate-100 py-4 first:pt-0 last:border-0 last:pb-0 dark:border-slate-800">
      {place ? (
        <button type="button" aria-label={`${stop.title} · ${text.placeDetails}`} onClick={(event) => onPlaceSelect(place, stop.description, event.currentTarget)} className="flex min-h-14 w-full items-start gap-3 rounded-xl text-left outline-offset-4 transition hover:bg-brand-50/60 focus-visible:outline-2 focus-visible:outline-brand-600 dark:hover:bg-brand-900/30">
          {content}
          <MdChevronRight aria-hidden="true" className="mt-1.5 shrink-0 text-lg text-slate-400" />
        </button>
      ) : (
        <div className="flex min-h-14 w-full items-start gap-3 text-left">
          {content}
          <button type="button" aria-label={`${stop.title} · ${text.placeUnavailable}`} aria-haspopup="dialog" onClick={(event) => onUnavailable(stop.title, event.currentTarget)} className="-mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-xl text-amber-700 hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 dark:text-amber-300 dark:hover:bg-amber-900/30">
            <IoAlertCircleOutline aria-hidden="true" />
          </button>
        </div>
      )}
    </li>
  );
}

/** 소개와 방문 순서를 센터 팝업에서 읽고, 고정된 시작 버튼으로 기존 일정 만들기 흐름에 연결한다. */
export default function HomeCourseDetailsDialog({ courseId, language, text, preview, onClose, onPlaceSelect, onStartCourse }: Props) {
  const titleId = useId();
  const itineraryId = useId();
  const isPlaceOpen = useMapSheetStore(state => state.isOpen);
  const isNoticeOpen = useUiModalStore(state => state.isOpen);
  const { dialogRef, scrollRef, titleRef, suspendForOverlay, trapFocus } = useHomeCourseDialog(isPlaceOpen || isNoticeOpen);
  const query = useHomeCourseStops(courseId, language, true);
  const stops = query.data ?? [];
  const places = stops.flatMap(({ place }) => place ? [place] : []);
  const canStartCourse = stops.length > 0 && places.length === stops.length;

  /** 코스 팝업을 보존한 채 기존 전체 화면 장소 상세를 연다. */
  const handlePlaceSelect: CourseStopProps["onPlaceSelect"] = (place, description, trigger) => {
    suspendForOverlay(trigger);
    onPlaceSelect(place, description);
  };

  /** 위치를 확인하지 못한 방문지는 기존 안내를 표시하고, 닫으면 같은 코스 위치로 돌아온다. */
  const handleUnavailable: CourseStopProps["onUnavailable"] = (title, trigger) => {
    suspendForOverlay(trigger);
    useUiModalStore.getState().openModal({
      title,
      description: text.placeUnavailableDescription,
      detail: text.stopsIncomplete,
      actions: [{ label: getUiText(language).common.confirm }],
    });
  };

  /** 팝업을 닫고 확인된 전체 방문지를 기존 장소 목록에 전달한다. */
  const handleStartCourse = () => {
    onClose();
    onStartCourse(places);
  };

  return createPortal(
    <dialog ref={dialogRef} aria-labelledby={titleId} aria-modal="true" onKeyDown={trapFocus} onCancel={(event) => { event.preventDefault(); onClose(); }} className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none border-0 bg-transparent p-0 text-slate-900 outline-none backdrop:bg-slate-950/50 dark:text-slate-100">
      <div className="flex h-full items-center justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] sm:p-6" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
        <section className="global-modal-panel-enter flex h-[88dvh] max-h-full w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-[#0b211f]">
          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <h2 ref={titleRef} id={titleId} tabIndex={-1} lang={preview.title.lang} className="min-w-0 break-keep pt-1 text-lg font-bold leading-7 tracking-tight outline-none [overflow-wrap:anywhere] sm:text-xl">{preview.title.text}</h2>
            <button type="button" aria-label={getUiText(language).common.close} onClick={onClose} className="-mr-2 -mt-1 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-xl text-slate-500 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:text-slate-300 dark:hover:bg-white/10"><IoClose aria-hidden="true" /></button>
          </header>
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
            <div className="h-44 bg-brand-50 sm:h-52 dark:bg-brand-900/40">
              {preview.image ? <img key={preview.image} src={preview.image} alt="" onError={() => { if (preview.image) preview.markImageFailed(preview.image); }} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-brand-700/35 dark:text-brand-200/40"><MdLandscape aria-hidden="true" className="text-7xl" /></div>}
            </div>
            <div className="px-5 pb-6 pt-5 sm:px-6">
              <HomeCourseFacts language={language} text={text} facts={preview} />
              {preview.description.text ? <section className="mt-6">
                <h3 className="text-base font-bold">{text.courseOverview}</h3>
                <p lang={preview.description.lang} className="mt-2 whitespace-pre-line break-words text-sm leading-7 text-slate-600 dark:text-slate-300">{preview.description.text}</p>
              </section> : null}
              <section className="mt-7" aria-labelledby={itineraryId} aria-busy={query.isPending}>
                <div className="mb-4 flex items-baseline justify-between gap-3">
                  <h3 id={itineraryId} className="text-base font-bold">{text.courseItinerary}</h3>
                  {stops.length > 0 ? <span className="text-xs text-slate-500 dark:text-slate-400">{text.courseStopCount(stops.length)}</span> : null}
                </div>
                {query.isPending ? <div role="status" className="py-1">
                  <span className="sr-only">{text.stopsLoading}</span>
                  <div aria-hidden="true" className="space-y-5 motion-safe:animate-pulse">
                    {[0, 1, 2].map(index => <div key={index} className="flex gap-3">
                      <span className="size-8 shrink-0 rounded-full bg-brand-50 dark:bg-brand-900/40" />
                      <div className="flex-1 space-y-2 pt-1"><div className="h-3 w-2/3 rounded bg-slate-100 dark:bg-slate-800" /><div className="h-2.5 w-full rounded bg-slate-100 dark:bg-slate-800" /><div className="h-2.5 w-4/5 rounded bg-slate-100 dark:bg-slate-800" /></div>
                    </div>)}
                  </div>
                </div> : null}
                {query.isError ? <div className="space-y-3 py-3">
                  <p role="status" className="text-sm text-slate-500 dark:text-slate-400">{text.stopsError}</p>
                  <button type="button" onClick={() => void query.refetch()} className="min-h-11 rounded-xl border border-brand-200 px-4 text-sm font-semibold text-brand-700 hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:border-brand-400/25 dark:text-brand-100 dark:hover:bg-brand-900/30">{text.retry}</button>
                </div> : null}
                {query.isSuccess ? stops.length > 0 ? <ol>{stops.map((stop, index) => <CourseStop key={stop.description.contentId} stop={stop} number={index + 1} language={language} text={text} onPlaceSelect={handlePlaceSelect} onUnavailable={handleUnavailable} />)}</ol> : <p className="py-3 text-sm text-slate-500 dark:text-slate-400">{text.stopsEmpty}</p> : null}
              </section>
            </div>
          </div>
          <footer className="shrink-0 border-t border-slate-100 bg-white px-5 py-4 dark:border-slate-800 dark:bg-[#0b211f]">
            {query.isSuccess && stops.length > 0 && !canStartCourse ? <p className="mb-3 text-xs leading-5 text-slate-500 dark:text-slate-400">{text.stopsIncomplete}</p> : null}
            <button type="button" disabled={!canStartCourse} onClick={handleStartCourse} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white transition enabled:hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-50">{text.startCourse}<MdArrowForward aria-hidden="true" className="text-lg" /></button>
          </footer>
        </section>
      </div>
    </dialog>,
    document.body,
  );
}
