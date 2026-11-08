import { useLayoutEffect, useRef } from "react";
import { Link, Navigate, useLocation, useSearchParams } from "react-router-dom";
import { MdArrowForward, MdErrorOutline, MdMap, MdRefresh, MdRoute } from "react-icons/md";
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
import type { MapSheetPlace } from "@/types/place";

type CourseListProps = {
  courses: HomeTourCourse[];
  language: AppLanguage;
  text: HomeRecommendationText;
  nextCount: number;
  isLoadingMore: boolean;
  loadMoreFailed: boolean;
  onLoadMore: () => void;
  onPlaceSelect: (place: MapSheetPlace) => void;
  onStartCourse: (places: MapSheetPlace[]) => void;
};

/** 받은 코스는 유지하고, 더 보기 또는 재시도 버튼으로 다음 페이지를 요청한다. */
function HomeRecommendationCourseList({
  courses, language, text, nextCount, isLoadingMore, loadMoreFailed, onLoadMore, onPlaceSelect, onStartCourse,
}: CourseListProps) {
  return <>
    <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">{text.source}</p>
    <div id="home-recommended-courses" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
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
    {nextCount > 0 ? <div className="mt-4 space-y-2">
      {loadMoreFailed && !isLoadingMore ? <p role="status" className="text-center text-sm text-slate-500 dark:text-slate-400">{text.moreError}</p> : null}
      <button
        type="button"
        aria-controls="home-recommended-courses"
        disabled={isLoadingMore}
        onClick={onLoadMore}
        className="flex min-h-11 w-full items-center justify-center rounded-2xl border border-brand-200 bg-white px-4 text-sm font-bold text-brand-800 hover:bg-brand-50 disabled:opacity-60 dark:border-brand-400/25 dark:bg-brand-900/40 dark:text-brand-100 dark:hover:bg-brand-900/60"
      >
        {isLoadingMore ? text.moreLoading : loadMoreFailed ? text.retry : text.moreCourses(nextCount)}
      </button>
    </div> : null}
  </>;
}

/** 홈의 로그인 진입점과 누구나 볼 수 있는 지역별 공식 여행 코스를 표시한다. */
function HomeRecommendationContent() {
  const { selection, area, selectedRegions, language, resultScope, query, courses, totalCount, nextCount, mapHref, actions } = useHomeRecommendations();
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
  const formRef = useRef<HTMLDivElement>(null);
  const recommendationsRef = useRef<HTMLElement>(null);
  const { hash } = useLocation();

  // 앱의 해시 라우터에서도 홈 상단 대신 추천 결과에 초점과 스크롤을 맞춘다.
  useLayoutEffect(() => {
    if (hash !== `#${HOME_RECOMMENDATIONS_ANCHOR}`) return;
    const recommendations = recommendationsRef.current;
    recommendations?.focus({ preventScroll: true });
    recommendations?.scrollIntoView({ block: "start" });
  }, [hash]);

  return (
    <section className="min-h-full bg-[#f7faf9] text-slate-900 dark:bg-[#071718] dark:text-slate-100">
      <div className="mx-auto max-w-5xl px-5 pb-8 pt-[calc(env(safe-area-inset-top)+1rem)] sm:px-8 sm:pt-[calc(env(safe-area-inset-top)+1.5rem)]">
        <header className="flex min-h-11 items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-brand-800 dark:text-brand-200"><img src={`${import.meta.env.BASE_URL}masil-icon.png`} alt="" className="size-6 rounded-md" /><span className="font-trip text-2xl">{text.brand}</span></span>
          {!isAuthenticated ? (
            <button
              type="button"
              onClick={() => requestLogin("home-recommendation-header")}
              className="inline-flex min-h-11 shrink-0 items-center rounded-full px-3 text-xs font-bold text-brand-800 transition hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:text-brand-200 dark:hover:bg-brand-900/40"
            >
              {ui.auth.login}
            </button>
          ) : null}
        </header>
        <div className="mb-6 mt-7 sm:mb-8 sm:mt-10">
          <p className="mb-2 text-xs font-bold tracking-wide text-brand-700 dark:text-brand-300">{text.eyebrow}</p>
          <h1 className="text-[29px] font-bold leading-tight tracking-tight sm:text-4xl">{text.title}</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">{text.description}</p>
        </div>
        <HomeMapEntry href={mapHref} onOpen={actions.prepareMap} text={text} />
        <div className="grid items-start gap-7 lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-9">
          <div ref={formRef} className="scroll-mt-5"><HomeRecommendationForm selection={selection} area={area} text={text} onAreaChange={actions.selectArea} onRegionsChange={actions.selectRegions} /></div>
          <section
            id={HOME_RECOMMENDATIONS_ANCHOR}
            ref={recommendationsRef}
            tabIndex={-1}
            aria-label={text.results}
            aria-live="polite"
            aria-busy={isLoading}
            className="min-w-0 scroll-mt-[calc(env(safe-area-inset-top)+1rem)] focus:outline-none"
          >
            <div className="mb-4">
              <p className="text-xs font-semibold text-brand-700 dark:text-brand-300">
                {regionLabel}{query.data ? ` · ${text.courseCount(totalCount)}` : ""}
              </p>
              <div className="flex items-center justify-between gap-3">
                <h2 className="mt-1 text-xl font-bold">{text.results}</h2>
                <button type="button" onClick={() => formRef.current?.scrollIntoView({ block: "start", behavior: "smooth" })} className="min-h-11 shrink-0 rounded-full border border-brand-200 px-3 text-xs font-bold text-brand-800 dark:border-brand-400/25 dark:text-brand-100">{text.editConditions}</button>
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{text.resultDescription}</p>
            </div>
            {isLoading ? <div role="status">
              <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">{text.loading}</p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">{[0, 1].map(index => <div key={index} aria-hidden="true" className="overflow-hidden rounded-3xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"><div className="skeleton-shimmer h-40 bg-slate-200 dark:bg-slate-800" /><div className="space-y-3 p-5"><div className="skeleton-shimmer h-5 w-2/3 rounded bg-slate-200 dark:bg-slate-800" /><div className="skeleton-shimmer h-4 w-full rounded bg-slate-100 dark:bg-slate-800" /><div className="skeleton-shimmer h-11 rounded-xl bg-brand-50 dark:bg-brand-900/30" /></div></div>)}</div>
            </div> : courses.length > 0 ? <>
              <HomeRecommendationCourseList
                key={resultScope}
                courses={courses}
                language={language}
                text={text}
                nextCount={nextCount}
                isLoadingMore={query.isFetchingNextPage}
                loadMoreFailed={query.isFetchNextPageError}
                onLoadMore={() => void query.fetchNextPage({ cancelRefetch: false })}
                onPlaceSelect={actions.openPlace}
                onStartCourse={actions.startCourse}
              />
              <Link to={mapHref} onClick={actions.prepareMap} className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-700 dark:text-brand-200">{text.mapRegion}<MdArrowForward aria-hidden="true" /></Link>
            </> : <div className="flex min-h-56 flex-col items-center justify-center rounded-3xl border border-dashed border-brand-200 px-5 py-8 text-center sm:min-h-72 dark:border-brand-400/25">
              <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-brand-100/70 text-3xl text-brand-700 dark:bg-brand-900/50 dark:text-brand-200">
                {isError ? <MdErrorOutline aria-hidden="true" /> : <MdRoute aria-hidden="true" />}
              </span>
              <h2 className="text-base font-bold">{isError ? text.error : text.empty}</h2>
              <p className="mt-2 max-w-xs text-sm leading-6 text-slate-500 dark:text-slate-400">{isError ? text.errorDescription : text.emptyDescription}</p>
              {isError ? <button type="button" onClick={() => void query.refetch()} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-brand-200 px-4 text-sm font-semibold text-brand-800 dark:text-brand-100"><MdRefresh aria-hidden="true" />{text.retry}</button> : null}
              <Link to={mapHref} onClick={actions.prepareMap} className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-700 dark:text-brand-200"><MdMap aria-hidden="true" />{text.map}</Link>
            </div>}
          </section>
        </div>
      </div>
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
