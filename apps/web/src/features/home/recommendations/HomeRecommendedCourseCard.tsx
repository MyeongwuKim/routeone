import { useState } from "react";
import { MdArrowForward, MdChevronRight, MdExpandLess, MdExpandMore, MdLandscape } from "react-icons/md";
import type { AppLanguage } from "@/stores/appLanguageStore";
import type { MapSheetPlace } from "@/types/place";
import type { HomeRecommendationText } from "./homeRecommendationText";
import type { HomeTourCourse } from "./homeRecommendations";
import { useHomeCourseCover, useHomeCourseStops } from "./useHomeRecommendations";

type Props = {
  course: HomeTourCourse;
  index: number;
  language: AppLanguage;
  text: HomeRecommendationText;
  onPlaceSelect: (place: MapSheetPlace) => void;
  onStartCourse: (places: MapSheetPlace[]) => void;
};

type CourseStopProps = {
  title: string;
  place: MapSheetPlace | null;
  number: number;
  detailsLabel: string;
  onPlaceSelect: Props["onPlaceSelect"];
};

/** 공식 방문 순서를 표시하고, 좌표가 확인된 방문지만 기존 장소 상세로 연결한다. */
function CourseStop({ title, place, number, detailsLabel, onPlaceSelect }: CourseStopProps) {
  const rowClassName = "flex min-h-14 w-full items-center gap-3 rounded-xl px-1 py-2 text-left";
  const content = (
    <>
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-800 dark:bg-brand-900 dark:text-brand-100">{number}</span>
      <span className="min-w-0 flex-1">
        <span className="block break-words text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</span>
        {place?.address ? <span className="mt-1 block truncate text-xs text-slate-500 dark:text-slate-400">{place.address}</span> : null}
      </span>
    </>
  );

  return (
    <li>
      {place ? (
        <button
          type="button"
          onClick={() => onPlaceSelect(place)}
          aria-label={`${title} · ${detailsLabel}`}
          className={`${rowClassName} hover:bg-brand-50 dark:hover:bg-brand-900/30`}
        >
          {content}
          <MdChevronRight aria-hidden="true" className="shrink-0 text-slate-400" />
        </button>
      ) : <div className={rowClassName}>{content}</div>}
    </li>
  );
}

/** 접힌 카드에도 대표 사진을 표시하고, 펼치면 방문지 상세를 순서대로 보여준다. */
export default function HomeRecommendedCourseCard({
  course,
  index,
  language,
  text,
  onPlaceSelect,
  onStartCourse,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const { coverRef, image, markImageFailed } = useHomeCourseCover(course);
  const query = useHomeCourseStops(course.id, language, isOpen);
  const stops = query.data ?? [];
  const places = stops.flatMap(({ place }) => place ? [place] : []);
  const canStartCourse = stops.length > 0 && places.length === stops.length;
  const detailsId = `home-course-${course.id}`;

  return (
    <article
      className="home-course-card-enter min-w-0 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-[#0b211f]"
      style={{ animationDelay: `${Math.min(index, 4) * 45}ms` }}
    >
      <div ref={coverRef} className="relative h-40 overflow-hidden bg-gradient-to-br from-brand-100 to-sky-100 sm:h-44 dark:from-brand-900 dark:to-slate-800">
        {image
          ? <img key={image} src={image} alt="" loading="lazy" onError={() => markImageFailed(image)} className="h-full w-full object-cover" />
          : <div className="flex h-full items-center justify-center text-brand-700/35 dark:text-brand-200/40"><MdLandscape aria-hidden="true" className="text-8xl" /></div>}
        <span className="absolute left-4 top-4 rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-brand-800 shadow-sm">COURSE {String(index + 1).padStart(2, "0")}</span>
      </div>
      <div className="p-4 sm:p-5">
        <h3 className="break-words text-lg font-bold tracking-tight text-slate-900 dark:text-white">{course.title}</h3>
        <button type="button" aria-expanded={isOpen} aria-controls={detailsId} onClick={() => setIsOpen(open => !open)} className="mt-4 flex min-h-11 w-full items-center justify-between rounded-xl bg-brand-50 px-3 py-2 text-sm font-bold text-brand-800 transition hover:bg-brand-100 dark:bg-brand-900/40 dark:text-brand-100">
          {isOpen ? text.courseClose : text.courseOpen}{isOpen ? <MdExpandLess aria-hidden="true" className="text-xl" /> : <MdExpandMore aria-hidden="true" className="text-xl" />}
        </button>
        <div id={detailsId} hidden={!isOpen} className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-700">
          {isOpen && query.isPending ? (
            <p role="status" className="text-sm text-slate-500 dark:text-slate-400">{text.stopsLoading}</p>
          ) : null}
          {isOpen && query.isError ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p role="status" className="text-sm text-slate-500 dark:text-slate-400">{text.stopsError}</p>
              <button type="button" onClick={() => void query.refetch()} className="min-h-11 rounded-xl border border-brand-200 px-3 text-xs font-bold text-brand-700 hover:bg-brand-50 dark:border-brand-400/25 dark:text-brand-100 dark:hover:bg-brand-900/30">{text.retry}</button>
            </div>
          ) : null}
          {isOpen && query.isSuccess ? (
            stops.length > 0 ? (
              <>
                <ol className="space-y-1">
                  {stops.map(({ title, place }, stopIndex) => (
                    <CourseStop
                      key={`${title}-${stopIndex}`}
                      title={title}
                      place={place}
                      number={stopIndex + 1}
                      detailsLabel={text.placeDetails}
                      onPlaceSelect={onPlaceSelect}
                    />
                  ))}
                </ol>
                {!canStartCourse ? <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">{text.stopsIncomplete}</p> : null}
                <button
                  type="button"
                  disabled={!canStartCourse}
                  onClick={() => onStartCourse(places)}
                  className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-3 py-2 text-sm font-bold text-white transition enabled:hover:bg-brand-700 disabled:opacity-50"
                >
                  {text.startCourse}
                  <MdArrowForward aria-hidden="true" className="text-lg" />
                </button>
              </>
            ) : <p className="text-sm text-slate-500 dark:text-slate-400">{text.stopsEmpty}</p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
