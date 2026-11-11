import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, Navigate, useLocation, useSearchParams } from "react-router-dom";
import { MdArrowForward, MdArrowUpward, MdErrorOutline, MdLanguage, MdMap, MdRefresh } from "react-icons/md";
import HomeRecommendationForm from "@/features/home/recommendations/HomeRecommendationForm";
import HomeRecommendedCourseCard from "@/features/home/recommendations/HomeRecommendedCourseCard";
import HomeMapEntry from "@/features/home/recommendations/HomeMapEntry";
import { getHomeRecommendationText, type HomeRecommendationText } from "@/features/home/recommendations/homeRecommendationText";
import { useHomeRecommendations } from "@/features/home/recommendations/useHomeRecommendations";
import { HOME_RECOMMENDATIONS_ANCHOR, type HomeTourCourse } from "@/features/home/recommendations/homeRecommendations";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useLoginRequest } from "@/hooks/useLoginRequest";
import { useUiText } from "@/lib/uiText";
import type { AppLanguage } from "@/stores/appLanguageStore";
import type { MapSheetCourseStopDescription } from "@/stores/mapSheetStore";
import type { MapSheetPlace } from "@/types/place";

const courseGridClassName = "grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2";
const courseSpinnerClassName = "size-3.5 shrink-0 rounded-full border-2 border-brand-200 border-t-brand-600 motion-safe:animate-spin dark:border-brand-800 dark:border-t-brand-300";

type CourseListProps = {
  courses: HomeTourCourse[];
  language: AppLanguage;
  text: HomeRecommendationText;
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMoreFailed: boolean;
  onLoadMore: () => void;
  onPlaceSelect: (place: MapSheetPlace, courseStopDescription: MapSheetCourseStopDescription) => void;
  onStartCourse: (places: MapSheetPlace[]) => void;
};

/** 기존 카드를 유지한 채 다음 페이지를 붙이고, 이동하는 버튼 영역은 스크롤 기준에서 제외한다. */
function HomeRecommendationCourseList({
  courses, language, text, hasMore, isLoadingMore, loadMoreFailed, onLoadMore, onPlaceSelect, onStartCourse,
}: CourseListProps) {
  return <>
    <div id="home-recommended-courses" className={courseGridClassName}>
      {courses.map((course, index) => (
        <HomeRecommendedCourseCard
          key={course.id}
          course={course}
          index={index}
          language={language}
          text={text}
          onPlaceSelect={onPlaceSelect}
          onStartCourse={onStartCourse}
        />
      ))}
    </div>
    {hasMore ? <div className="mt-4 space-y-2 [overflow-anchor:none]">
      <button
        type="button"
        aria-controls="home-recommended-courses"
        disabled={isLoadingMore}
        onClick={onLoadMore}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-brand-200 bg-white px-4 text-sm font-bold text-brand-800 enabled:hover:bg-brand-50 disabled:cursor-wait dark:border-brand-400/25 dark:bg-brand-900/40 dark:text-brand-100 dark:enabled:hover:bg-brand-900/60"
      >
        {isLoadingMore ? <span aria-hidden="true" className={courseSpinnerClassName} /> : null}
        {isLoadingMore ? text.moreLoading : loadMoreFailed ? text.moreRetry : text.moreCourses}
      </button>
      {loadMoreFailed && !isLoadingMore ? <p role="status" className="text-center text-sm text-slate-500 dark:text-slate-400">{text.moreError}</p> : null}
    </div> : null}
  </>;
}

/** 홈의 로그인 진입점과 누구나 볼 수 있는 지역별 공식 여행 코스를 표시한다. */
function HomeRecommendationContent() {
  const { selection, area, selectedRegions, language, resultScope, query, courses, mapHref, actions } = useHomeRecommendations();
  const text = getHomeRecommendationText(language);
  const ui = useUiText();
  const { isAuthenticated } = useAuthSession();
  const requestLogin = useLoginRequest();
  const areaLabel = ui.labels.regions[area.label] ?? area.label;
  const regionNames = selectedRegions.map(({ label }) => ui.labels.regions[label] ?? label);
  const regionLabel = regionNames.length > 2
    ? `${areaLabel} · ${text.selectedDistrictCount(regionNames.length)}`
    : regionNames.join(", ") || areaLabel;
  const isLoading = query.isPending || (query.isFetching && !query.data);
  const isError = query.isError && !query.data;
  const [showBackToTop, setShowBackToTop] = useState(false);
  const homeRef = useRef<HTMLElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const recommendationsRef = useRef<HTMLElement>(null);
  const { hash, search } = useLocation();

  // 앱의 해시 라우터에서도 홈 상단 대신 추천 결과에 초점과 스크롤을 맞춘다.
  useLayoutEffect(() => {
    if (hash !== `#${HOME_RECOMMENDATIONS_ANCHOR}`) return;
    const recommendations = recommendationsRef.current;
    recommendations?.focus({ preventScroll: true });
    recommendations?.scrollIntoView({ block: "start" });
  }, [hash]);

  // 처음부터 선택 영역이 화면 아래에 있는 경우는 제외하고, 위로 벗어났을 때만 버튼을 표시한다.
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry) {
        setShowBackToTop(!entry.isIntersecting && entry.boundingClientRect.bottom <= (entry.rootBounds?.top ?? 0));
      }
    });
    observer.observe(form);
    return () => observer.disconnect();
  }, []);

  const handleBackToTop = () => {
    const home = homeRef.current;
    if (!home) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    home.focus({ preventScroll: true });
    home.scrollIntoView({ block: "start", behavior: reduceMotion ? "instant" : "smooth" });
  };

  return (
    <section ref={homeRef} tabIndex={-1} aria-label={ui.nav.home} className="min-h-full bg-[#f7faf9] text-slate-900 focus:outline-none dark:bg-[#071718] dark:text-slate-100">
      <div className="mx-auto max-w-5xl px-5 pb-8 pt-[calc(env(safe-area-inset-top)+1rem)] sm:px-8 sm:pt-[calc(env(safe-area-inset-top)+1.5rem)]">
        <header className="flex min-h-11 items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-brand-800 dark:text-brand-200"><img src={`${import.meta.env.BASE_URL}masil-icon.png`} alt="" className="size-6 rounded-md" /><span className="font-trip text-2xl">{text.brand}</span></span>
          <div className="flex shrink-0 items-center gap-1">
            {!isAuthenticated ? (
              <button
                type="button"
                onClick={() => requestLogin("home-recommendation-header")}
                className="inline-flex min-h-11 shrink-0 items-center rounded-full px-3 text-xs font-bold text-brand-800 transition hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:text-brand-200 dark:hover:bg-brand-900/40"
              >
                {ui.auth.login}
              </button>
            ) : null}
            <Link
              to={{ pathname: "/home/language", search }}
              aria-label={ui.routeShell.languageTitle}
              className="inline-flex size-11 items-center justify-center rounded-full border border-brand-200 bg-white text-xl text-brand-800 transition hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:border-brand-400/25 dark:bg-brand-900/40 dark:text-brand-200 dark:hover:bg-brand-900/60"
            >
              <MdLanguage aria-hidden="true" />
            </Link>
          </div>
        </header>
        <div className="mb-6 mt-7 sm:mb-8 sm:mt-10">
          <p className="mb-2 text-xs font-bold tracking-wide text-brand-700 dark:text-brand-300">{text.eyebrow}</p>
          <h1 className="text-[29px] font-bold leading-tight tracking-tight sm:text-4xl">{text.title}</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">{text.description}</p>
        </div>
        <HomeMapEntry href={mapHref} onOpen={actions.prepareMap} text={text} />
        <div className="grid items-start gap-7 lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-9">
          <div ref={formRef}><HomeRecommendationForm selection={selection} area={area} text={text} onAreaChange={actions.selectArea} onRegionsChange={actions.selectRegions} /></div>
          <section
            id={HOME_RECOMMENDATIONS_ANCHOR}
            ref={recommendationsRef}
            tabIndex={-1}
            aria-label={text.results}
            aria-live="polite"
            className="min-w-0 scroll-mt-[calc(env(safe-area-inset-top)+1rem)] focus:outline-none"
          >
            <div className="mb-4">
              <p className="text-xs font-semibold text-brand-700 dark:text-brand-300">
                {regionLabel}{query.data ? ` · ${text.courseCount(courses.length, query.hasNextPage)}` : ""}
              </p>
              <h2 className="mt-1 text-xl font-bold">{text.results}</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{text.resultDescription}</p>
            </div>
            <div className="mb-4 flex min-h-4 items-center justify-between gap-2">
              <p className="text-xs text-slate-500 dark:text-slate-400">{text.source}</p>
              <span role="status" className="inline-flex shrink-0">
                {isLoading ? <>
                  <span className="sr-only">{text.loading}</span>
                  <span aria-hidden="true" className={courseSpinnerClassName} />
                </> : null}
              </span>
            </div>
            <div aria-busy={isLoading}>
              {isLoading ? (
                <div className={courseGridClassName} aria-hidden="true">
                  {[0, 1].map((index) => (
                    <div key={index} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-[#0b211f]">
                      <div className="relative h-40 bg-gradient-to-br from-brand-50 to-sky-50 sm:h-44 dark:from-brand-900/60 dark:to-slate-800">
                        <div className="absolute left-4 top-4 h-6 w-20 rounded-full bg-white/70 dark:bg-white/10" />
                      </div>
                      <div className="p-4 sm:p-5">
                        <div className="flex h-7 items-center">
                          <div className="h-4 w-2/3 rounded-full bg-slate-100 dark:bg-white/10" />
                        </div>
                        <div className="mt-4 h-11 rounded-xl bg-brand-50/70 dark:bg-brand-900/40" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : courses.length > 0 ? <>
                <HomeRecommendationCourseList
                  key={resultScope}
                  courses={courses}
                  language={language}
                  text={text}
                  hasMore={query.hasNextPage}
                  isLoadingMore={query.isFetchingNextPage}
                  loadMoreFailed={query.isFetchNextPageError}
                  onLoadMore={() => void query.fetchNextPage({ cancelRefetch: false })}
                  onPlaceSelect={actions.openPlace}
                  onStartCourse={actions.startCourse}
                />
                <Link to={mapHref} onClick={actions.prepareMap} className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-700 [overflow-anchor:none] dark:text-brand-200">{text.mapRegion}<MdArrowForward aria-hidden="true" /></Link>
              </> : <div className="flex min-h-56 flex-col items-center justify-center rounded-3xl border border-dashed border-brand-200 px-5 py-8 text-center sm:min-h-72 dark:border-brand-400/25">
                {isError ? (
                  <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-brand-100/70 text-3xl text-brand-700 dark:bg-brand-900/50 dark:text-brand-200">
                    <MdErrorOutline aria-hidden="true" />
                  </span>
                ) : null}
                <h2 className="text-base font-bold">{isError ? text.error : text.empty}</h2>
                <p className="mt-2 max-w-xs text-sm leading-6 text-slate-500 dark:text-slate-400">{isError ? text.errorDescription : text.emptyDescription}</p>
                {isError ? <button type="button" onClick={() => void query.refetch()} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-brand-200 px-4 text-sm font-semibold text-brand-800 dark:text-brand-100"><MdRefresh aria-hidden="true" />{text.retry}</button> : null}
                <Link to={mapHref} onClick={actions.prepareMap} className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-700 dark:text-brand-200"><MdMap aria-hidden="true" />{text.map}</Link>
              </div>}
            </div>
          </section>
        </div>
      </div>
      {showBackToTop ? (
        <button
          type="button"
          aria-label={text.backToTop}
          title={text.backToTop}
          onClick={handleBackToTop}
          className="fixed right-4 bottom-[calc(var(--bottom-tab-offset)+1rem)] z-30 inline-flex size-12 items-center justify-center rounded-full border border-brand-200 bg-white text-xl text-brand-800 shadow-md transition hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 sm:right-6 dark:border-brand-400/30 dark:bg-[#0f3431] dark:text-brand-100 dark:hover:bg-brand-900"
        >
          <MdArrowUpward aria-hidden="true" />
        </button>
      ) : null}
    </section>
  );
}

/**
 * 진입 경로: 하단 홈 탭. 지역별 공식 여행 코스를 펼쳐 방문 순서와 장소 상세를 보거나 일정 만들기로 이동한다.
 * 지역을 바꾸면 선택 메뉴를 유지한 채 결과만 갱신한다. 기존 축제 알림 URL은 검색 조건을 유지한 채 지도로 연결한다.
 */
export default function HomeRecommendationPage() {
  const [params] = useSearchParams();
  if (params.has("festivalRegion")) return <Navigate to={`/home/map?${params}`} replace />;
  // 이전 홈의 도보·대중교통 선택 URL도 지역은 유지하되 지원하지 않는 이동수단 조건을 제거한다.
  if (params.has("transport")) {
    const nextParams = new URLSearchParams(params);
    nextParams.delete("transport");
    const search = nextParams.toString();
    return <Navigate to={`/home${search ? `?${search}` : ""}`} replace />;
  }
  return <HomeRecommendationContent />;
}
