import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  useInfiniteQuery,
  type InfiniteData,
} from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  MdArrowBack,
  MdClose,
  MdDownload,
  MdHistory,
  MdShare,
} from "react-icons/md";
import { routeApi } from "@/api/routeApi";
import { PotatoLoadingCard } from "@/components/feedback/PotatoLoadingOverlay";
import DayRoutePopup from "@/features/my-route/components/DayRoutePopup";
import MyRouteCard from "@/features/my-route/components/MyRouteCard";
import { MY_ROUTE_HISTORY_QUERY_KEY } from "@/features/my-route/myRouteCache";
import {
  createRouteCompletionPosterCards,
  downloadRouteCompletionPoster,
  getRouteCompletionPosterStats,
  shareRouteCompletionPoster,
  type RouteCompletionPosterCard,
} from "@/features/my-route/routeCompletionPoster";
import {
  getDateKeyDiffInDays,
  getRouteEndDateKey,
  getRouteTitle,
  getSelectableRouteDay,
  getTodayDateKey,
} from "@/features/my-route/routeDisplay";
import type { MyRoute, MyRouteDay } from "@/features/my-route/types";
import type { MyRouteHistoryConnectionQuery } from "@/generated/graphql";
import { useUiToastStore } from "@/stores/uiToastStore";

type RoutePosterPreview = {
  route: MyRoute;
  cards: RouteCompletionPosterCard[];
  currentIndex: number;
};

const PAST_ROUTE_COMPLETION_GRACE_DAYS = 7;
const MY_ROUTE_HISTORY_PAGE_SIZE = 12;

type MyRouteHistoryInfiniteData = InfiniteData<
  MyRouteHistoryConnectionQuery,
  string | null
>;

function getHistoryRoutesFromInfiniteData(
  data: MyRouteHistoryInfiniteData | undefined
) {
  return (
    data?.pages.flatMap(
      (page) => page.myRouteHistoryConnection.nodes
    ) ?? []
  );
}

function canCompletePastRoute(route: MyRoute, todayKey = getTodayDateKey()) {
  const endDateKey = getRouteEndDateKey(route);

  if (!endDateKey) {
    return false;
  }

  const daysSinceEnd = getDateKeyDiffInDays(todayKey, endDateKey);

  return (
    daysSinceEnd >= 0 && daysSinceEnd <= PAST_ROUTE_COMPLETION_GRACE_DAYS
  );
}

function RoutePosterPreviewModal({
  preview,
  onClose,
  onSelectCard,
  onDownload,
  onShare,
}: {
  preview: RoutePosterPreview;
  onClose: () => void;
  onSelectCard: (index: number) => void;
  onDownload: () => void;
  onShare: () => void;
}) {
  const currentCard =
    preview.cards[preview.currentIndex] ?? preview.cards[0] ?? null;

  if (!currentCard) {
    return null;
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[3200] flex flex-col bg-[#f6ead4] text-slate-900"
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-amber-900/10 bg-[#fff7df]/95 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] shadow-sm">
        <div className="min-w-0">
          <p className="text-xs font-black text-brand-700">DAY 포스터</p>
          <h2 className="truncate text-base font-black text-slate-900">
            {getRouteTitle(preview.route)} · {currentCard.label}
          </h2>
        </div>
        <button
          type="button"
          aria-label="닫기"
          onClick={onClose}
          className="flex size-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-xl text-slate-700 shadow-sm transition active:scale-95"
        >
          <MdClose />
        </button>
      </header>

      {preview.cards.length > 1 ? (
        <div className="flex shrink-0 gap-2 overflow-x-auto border-b border-amber-900/10 bg-[#fff7df]/80 px-4 py-3">
          {preview.cards.map((card, index) => {
            const isSelected = index === preview.currentIndex;

            return (
              <button
                key={card.fileName}
                type="button"
                onClick={() => onSelectCard(index)}
                className={`h-9 shrink-0 rounded-full px-4 text-xs font-black transition active:scale-95 ${
                  isSelected
                    ? "bg-brand-600 text-white shadow-sm"
                    : "border border-brand-100 bg-white text-brand-700"
                }`}
              >
                {card.label}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto flex max-w-[440px] justify-center">
          <img
            src={currentCard.dataUrl}
            alt={`${currentCard.label} 포스터 미리보기`}
            className="h-auto w-full rounded-[18px] border border-amber-950/15 bg-white shadow-[0_20px_48px_rgba(84,52,10,0.25)]"
          />
        </div>
      </div>

      <footer className="flex shrink-0 gap-2 border-t border-amber-900/10 bg-[#fff7df]/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <button
          type="button"
          onClick={onShare}
          className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full border border-brand-200 bg-white text-sm font-black text-brand-700 shadow-sm transition active:scale-95"
        >
          <MdShare className="text-lg" />
          공유
        </button>
        <button
          type="button"
          onClick={onDownload}
          className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-brand-600 text-sm font-black text-white shadow-sm transition active:scale-95"
        >
          <MdDownload className="text-lg" />
          저장
        </button>
      </footer>
    </div>,
    document.body
  );
}

function RoutePosterGeneratingModal() {
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-live="polite"
      className="fixed inset-0 z-[3300] flex items-center justify-center bg-slate-950/35 px-4 backdrop-blur-[2px]"
    >
      <PotatoLoadingCard
        title="감자가 DAY 카드를 변환 중..."
        description="폴라로이드 사진을 PNG로 굽고 있어요."
        footerText="잠시만 기다려주세요"
        animation="map-rendering"
      />
    </div>,
    document.body
  );
}

function MyRouteHistoryPage() {
  const navigate = useNavigate();
  const showToast = useUiToastStore((state) => state.showToast);
  const [selectedHistoryRoute, setSelectedHistoryRoute] = useState<{
    routeId: string;
    dayId: string;
  } | null>(null);
  const [posterGeneratingRouteId, setPosterGeneratingRouteId] = useState<
    string | null
  >(null);
  const [posterPreview, setPosterPreview] =
    useState<RoutePosterPreview | null>(null);
  const todayKey = useMemo(() => getTodayDateKey(), []);
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null);
  const historyRoutesQuery = useInfiniteQuery({
    queryKey: [...MY_ROUTE_HISTORY_QUERY_KEY, todayKey],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      routeApi.myRouteHistoryConnection({
        limit: MY_ROUTE_HISTORY_PAGE_SIZE,
        cursor: pageParam,
        today: todayKey,
      }),
    getNextPageParam: (lastPage) => {
      const { pageInfo } = lastPage.myRouteHistoryConnection;

      return pageInfo.hasNextPage ? pageInfo.endCursor : undefined;
    },
  });
  const historyRoutes = useMemo(
    () =>
      getHistoryRoutesFromInfiniteData(
        historyRoutesQuery.data as MyRouteHistoryInfiniteData | undefined
      ),
    [historyRoutesQuery.data]
  );
  const selectedRouteDay = useMemo(() => {
    if (!selectedHistoryRoute) {
      return null;
    }

    const route = historyRoutes.find(
      (candidateRoute) => candidateRoute.id === selectedHistoryRoute.routeId
    );

    if (!route) {
      return null;
    }

    const day =
      route.days.find(
        (candidateDay) => candidateDay.id === selectedHistoryRoute.dayId
      ) ?? getSelectableRouteDay(route);

    return day
      ? {
          route,
          day,
        }
      : null;
  }, [historyRoutes, selectedHistoryRoute]);
  const canCompleteSelectedHistoryRoute = selectedRouteDay
    ? canCompletePastRoute(selectedRouteDay.route)
    : false;

  useEffect(() => {
    const target = loadMoreTriggerRef.current;

    if (!target || !historyRoutesQuery.hasNextPage) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const isVisible = entries.some((entry) => entry.isIntersecting);

        if (
          isVisible &&
          historyRoutesQuery.hasNextPage &&
          !historyRoutesQuery.isFetchingNextPage
        ) {
          void historyRoutesQuery.fetchNextPage();
        }
      },
      {
        rootMargin: "180px 0px",
      }
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [
    historyRoutesQuery.fetchNextPage,
    historyRoutesQuery.hasNextPage,
    historyRoutesQuery.isFetchingNextPage,
  ]);

  const handleSelectHistoryDay = (route: MyRoute, day: MyRouteDay) => {
    setSelectedHistoryRoute({
      routeId: route.id,
      dayId: day.id,
    });
  };

  const handleCreatePoster = async (route: MyRoute) => {
    setPosterGeneratingRouteId(route.id);

    try {
      const routeResult = await routeApi.routeById(route.id);
      const posterRoute = routeResult.route ?? route;
      const cards = await createRouteCompletionPosterCards(posterRoute);

      if (cards.length === 0) {
        throw new Error("No poster cards were generated.");
      }

      const missingPhotoCount = cards.reduce(
        (sum, card) => sum + card.missingPhotoCount,
        0
      );

      setPosterPreview({
        route: posterRoute,
        cards,
        currentIndex: 0,
      });

      if (missingPhotoCount > 0) {
        showToast(`사진 ${missingPhotoCount}장을 카드에 넣지 못했어요.`);
      }
    } catch (error) {
      console.error(error);
      showToast("DAY 포스터를 만들지 못했어요.");
    } finally {
      setPosterGeneratingRouteId(null);
    }
  };

  const handleSelectPosterCard = (index: number) => {
    setPosterPreview((preview) => {
      if (!preview) {
        return preview;
      }

      return {
        ...preview,
        currentIndex: Math.max(0, Math.min(preview.cards.length - 1, index)),
      };
    });
  };

  const selectedPosterCard = posterPreview
    ? posterPreview.cards[posterPreview.currentIndex] ?? null
    : null;

  const handleDownloadPoster = async () => {
    if (!posterPreview || !selectedPosterCard) {
      return;
    }

    try {
      const saveResult = await downloadRouteCompletionPoster(
        selectedPosterCard.dataUrl,
        selectedPosterCard.fileName,
        `${getRouteTitle(posterPreview.route)} ${selectedPosterCard.label}`
      );

      if (saveResult.mode === "native" && !saveResult.completed) {
        return;
      }

      showToast(
        saveResult.mode === "native"
          ? "포토카드 저장/공유를 완료했어요."
          : `${selectedPosterCard.label} PNG 다운로드를 시작했어요.`
      );
    } catch (error) {
      console.error(error);
      showToast("포토카드를 저장하지 못했어요.");
    }
  };

  const handleSharePoster = async () => {
    if (!posterPreview || !selectedPosterCard) {
      return;
    }

    try {
      const didShare = await shareRouteCompletionPoster(
        selectedPosterCard.dataUrl,
        selectedPosterCard.fileName,
        `${getRouteTitle(posterPreview.route)} ${selectedPosterCard.label}`
      );

      if (!didShare) {
        const saveResult = await downloadRouteCompletionPoster(
          selectedPosterCard.dataUrl,
          selectedPosterCard.fileName,
          `${getRouteTitle(posterPreview.route)} ${selectedPosterCard.label}`
        );

        if (saveResult.mode === "native" && !saveResult.completed) {
          return;
        }

        showToast(
          saveResult.mode === "native"
            ? "포토카드 저장/공유를 완료했어요."
            : "공유를 지원하지 않아 PNG 다운로드를 시작했어요."
        );
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      console.error(error);
      showToast("포스터 공유를 완료하지 못했어요.");
    }
  };

  return (
    <section className="space-y-4 pb-4 text-slate-900 dark:text-slate-100">
      <header className="flex items-center gap-3">
        <button
          type="button"
          aria-label="내 정보로 돌아가기"
          onClick={() => navigate("/me")}
          className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-xl text-brand-700 shadow-sm transition hover:bg-brand-100 dark:border-brand-400/30 dark:bg-[#0f3431] dark:text-brand-200 dark:shadow-[0_10px_24px_rgba(0,0,0,0.22)] dark:hover:bg-[#13423e]"
        >
          <MdArrowBack />
        </button>
        <div className="min-w-0">
          <p className="text-xs font-black text-brand-700 dark:text-brand-200">
            내 정보
          </p>
          <h1 className="truncate text-lg font-bold text-slate-900 dark:text-white">
            다녀온 루트
          </h1>
        </div>
      </header>

      <div className="rounded-2xl border border-brand-100 bg-white p-4 shadow-sm dark:border-brand-400/25 dark:bg-[#071f1d] dark:shadow-[0_16px_34px_rgba(0,0,0,0.28)]">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-xl text-brand-700 dark:bg-brand-400/15 dark:text-brand-100">
            <MdHistory />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              완료했거나 지난 일정
            </p>
            <p className="mt-0.5 text-xs font-semibold text-slate-500 dark:text-slate-200/75">
              불러온 {historyRoutes.length}개 루트 · 종료 후 7일 보정 가능
            </p>
          </div>
        </div>
      </div>

      {historyRoutesQuery.isError ? (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-semibold text-rose-700 dark:border-rose-400/30 dark:bg-rose-950/30 dark:text-rose-200">
          다녀온 루트를 불러오지 못했어요.
        </div>
      ) : null}

      {historyRoutesQuery.isLoading ? (
        <div className="flex min-h-[calc(100dvh-18rem)] flex-col justify-center">
          <PotatoLoadingCard
            title="기록 찾는 중"
            animation="running"
            compact
            className="shadow-sm"
          />
        </div>
      ) : null}

      {!historyRoutesQuery.isLoading &&
      !historyRoutesQuery.isError &&
      historyRoutes.length === 0 ? (
        <div className="flex min-h-[calc(100dvh-18rem)] flex-col justify-center">
          <PotatoLoadingCard
            title="아직 다녀온 루트가 없어요."
            description="감자가 빈 여행 기록을 보고 있어요."
            footerText="일정을 완료하면 여기에 모여요."
            animation="empty"
            compact
            className="shadow-sm"
          />
        </div>
      ) : null}

      {historyRoutes.length > 0 ? (
        <div className="space-y-3 px-px pb-1 pt-1">
          {historyRoutes.map((route) => (
            <MyRouteCard
              key={route.id}
              route={route}
              variant="history"
              hideTimelineBadge
              onSelectDay={handleSelectHistoryDay}
            />
          ))}

          {historyRoutesQuery.hasNextPage ? (
            <div ref={loadMoreTriggerRef} className="h-8" aria-hidden="true" />
          ) : null}

          {historyRoutesQuery.isFetchingNextPage ? (
            <div className="py-2">
              <PotatoLoadingCard
                title="다음 기록 찾는 중"
                animation="running"
                compact
                className="shadow-sm"
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {selectedRouteDay ? (
        <DayRoutePopup
          route={selectedRouteDay.route}
          day={selectedRouteDay.day}
          onClose={() => setSelectedHistoryRoute(null)}
          isReadOnly
          allowVisitCompletion={canCompleteSelectedHistoryRoute}
          visitCompletionMode="retrospective"
          enableVerificationPhotoPreview
          readOnlyPosterAction={
            getRouteCompletionPosterStats(selectedRouteDay.route).canCreate
              ? {
                  label:
                    posterGeneratingRouteId === selectedRouteDay.route.id
                      ? "제작 중"
                      : "DAY 카드",
                  ariaLabel: `${getRouteTitle(
                    selectedRouteDay.route
                  )} DAY 포스터 만들기`,
                  disabled: posterGeneratingRouteId === selectedRouteDay.route.id,
                  onClick: () => handleCreatePoster(selectedRouteDay.route),
                }
              : undefined
          }
        />
      ) : null}

      {posterPreview ? (
        <RoutePosterPreviewModal
          preview={posterPreview}
          onClose={() => setPosterPreview(null)}
          onSelectCard={handleSelectPosterCard}
          onDownload={handleDownloadPoster}
          onShare={handleSharePoster}
        />
      ) : null}

      {posterGeneratingRouteId ? <RoutePosterGeneratingModal /> : null}
    </section>
  );
}

export default MyRouteHistoryPage;
