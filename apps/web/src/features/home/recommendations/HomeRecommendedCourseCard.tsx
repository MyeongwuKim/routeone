import { useState } from "react";
import { MdArrowForward, MdLandscape } from "react-icons/md";
import type { AppLanguage } from "@/stores/appLanguageStore";
import type { MapSheetCourseStopDescription } from "@/stores/mapSheetStore";
import type { MapSheetPlace } from "@/types/place";
import HomeCourseDetailsDialog from "./HomeCourseDetailsDialog";
import HomeCourseFacts from "./HomeCourseFacts";
import type { HomeRecommendationText } from "./homeRecommendationText";
import type { HomeTourCourse } from "./homeRecommendations";
import { useHomeCoursePreview } from "./useHomeRecommendations";

type Props = {
  course: HomeTourCourse;
  index: number;
  language: AppLanguage;
  text: HomeRecommendationText;
  onPlaceSelect: (place: MapSheetPlace, courseStopDescription: MapSheetCourseStopDescription) => void;
  onStartCourse: (places: MapSheetPlace[]) => void;
};

/** 코스를 짧게 소개하고, 상세를 열면 홈 목록의 높이를 유지한 채 센터 팝업을 표시한다. */
export default function HomeRecommendedCourseCard({ course, index, language, text, onPlaceSelect, onStartCourse }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const { coverRef, image, title, description, distance, duration, theme, markImageFailed } = useHomeCoursePreview(course, language);
  const preview = { image, title, description, distance, duration, theme, markImageFailed };

  return (
    <>
      <article className="home-course-card-enter min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-[#0b211f]" style={{ animationDelay: `${Math.min(index, 4) * 45}ms` }}>
        <div ref={coverRef} className="relative h-40 overflow-hidden bg-gradient-to-br from-brand-100 to-sky-100 sm:h-44 dark:from-brand-900 dark:to-slate-800">
          {image ? <img key={image} src={image} alt="" loading="lazy" onError={() => markImageFailed(image)} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-brand-700/35 dark:text-brand-200/40"><MdLandscape aria-hidden="true" className="text-8xl" /></div>}
        </div>
        <div className="p-4 sm:p-5">
          <h3 lang={preview.title.lang} title={preview.title.text} className="truncate text-lg font-bold tracking-tight text-slate-900 dark:text-white">{preview.title.text}</h3>
          {preview.description.text ? <p lang={preview.description.lang} className="mt-2 truncate text-sm leading-6 text-slate-600 dark:text-slate-300">{preview.description.text}</p> : null}
          <div className="mt-3"><HomeCourseFacts language={language} text={text} facts={preview} /></div>
          <button type="button" aria-haspopup="dialog" onClick={(event) => { event.currentTarget.focus({ preventScroll: true }); setIsOpen(true); }} className="mt-4 flex min-h-11 w-full items-center justify-between rounded-xl bg-brand-50 px-3 py-2 text-sm font-bold text-brand-800 transition hover:bg-brand-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:bg-brand-900/40 dark:text-brand-100">{text.courseOpen}<MdArrowForward aria-hidden="true" className="text-lg" /></button>
        </div>
      </article>
      {isOpen ? <HomeCourseDetailsDialog courseId={course.id} language={language} text={text} preview={preview} onClose={() => setIsOpen(false)} onPlaceSelect={onPlaceSelect} onStartCourse={onStartCourse} /> : null}
    </>
  );
}
