import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
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
import { MY_ROUTES_QUERY_KEY } from "@/features/my-route/myRouteCache";
import {
  createRouteCompletionPosterCards,
  downloadRouteCompletionPoster,
  getRouteCompletionPosterStats,
  shareRouteCompletionPoster,
  type RouteCompletionPosterCard,
} from "@/features/my-route/routeCompletionPoster";
import {
  getRouteEndDateKey,
  getRouteTimelineState,
  getRouteTitle,
  getSelectableRouteDay,
  getTodayDateKey,
} from "@/features/my-route/routeDisplay";
import type { MyRoute, MyRouteDay } from "@/features/my-route/types";
import { useUiToastStore } from "@/stores/uiToastStore";

type RoutePosterPreview = {
  route: MyRoute;
  cards: RouteCompletionPosterCard[];
  currentIndex: number;
};

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
  const myRoutesQuery = useQuery({
    queryKey: MY_ROUTES_QUERY_KEY,
    queryFn: () => routeApi.myRoutes(),
  });
  const historyRoutes = useMemo(() => {
    const todayKey = getTodayDateKey();

    return (myRoutesQuery.data?.myRoutes ?? [])
      .filter((route) => getRouteTimelineState(route, todayKey) === "past")
      .sort((left, right) =>
        (getRouteEndDateKey(right) ?? "").localeCompare(
          getRouteEndDateKey(left) ?? ""
        )
      );
  }, [myRoutesQuery.data]);
  const selectedRouteDay = useMemo(() => {
    if (!selectedHistoryRoute) {
      return null;
    }

    const route = myRoutesQuery.data?.myRoutes.find(
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
  }, [myRoutesQuery.data, selectedHistoryRoute]);

  const handleSelectHistoryDay = (route: MyRoute, day: MyRouteDay) => {
    setSelectedHistoryRoute({
      routeId: route.id,
      dayId: day.id,
    });
  };

  const handleCreatePoster = async (route: MyRoute) => {
    setPosterGeneratingRouteId(route.id);

    try {
      const cards = await createRouteCompletionPosterCards(route);

      if (cards.length === 0) {
        throw new Error("No poster cards were generated.");
      }

      setPosterPreview({
        route,
        cards,
        currentIndex: 0,
      });
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

  const handleDownloadPoster = () => {
    if (!posterPreview || !selectedPosterCard) {
      return;
    }

    downloadRouteCompletionPoster(
      selectedPosterCard.dataUrl,
      selectedPosterCard.fileName
    );
    showToast(`${selectedPosterCard.label} PNG를 저장했어요.`);
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
        downloadRouteCompletionPoster(
          selectedPosterCard.dataUrl,
          selectedPosterCard.fileName
        );
        showToast("공유를 지원하지 않아 PNG로 저장했어요.");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      console.error(error);
      showToast("포스터 공유를 완료하지 못했어요.");
    }
  };

  useEffect(() => {
    if (selectedHistoryRoute && myRoutesQuery.data && !selectedRouteDay) {
      setSelectedHistoryRoute(null);
    }
  }, [myRoutesQuery.data, selectedHistoryRoute, selectedRouteDay]);

  return (
    <section className="space-y-4 pb-4 text-slate-900">
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
          <p className="text-xs font-black text-brand-700">내 정보</p>
          <h1 className="truncate text-lg font-bold text-slate-900">
            다녀온 루트
          </h1>
        </div>
      </header>

      <div className="rounded-2xl border border-brand-100 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-xl text-brand-700">
            <MdHistory />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900">
              완료했거나 지난 일정
            </p>
            <p className="mt-0.5 text-xs font-semibold text-slate-500">
              {historyRoutes.length}개 루트
            </p>
          </div>
        </div>
      </div>

      {myRoutesQuery.isLoading ? (
        <PotatoLoadingCard
          title="다녀온 루트를 불러오는 중"
          description="완료한 일정과 지난 일정을 확인하고 있어요."
          animation="map-thinking"
          compact
          className="shadow-sm"
        />
      ) : null}

      {myRoutesQuery.isError ? (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
          다녀온 루트를 불러오지 못했어요.
        </div>
      ) : null}

      {!myRoutesQuery.isLoading &&
      !myRoutesQuery.isError &&
      historyRoutes.length === 0 ? (
        <div className="rounded-2xl border border-brand-100 bg-white p-4 text-sm font-semibold text-slate-500 shadow-sm">
          아직 다녀온 루트가 없어요.
        </div>
      ) : null}

      {historyRoutes.length > 0 ? (
        <div className="space-y-2">
          {historyRoutes.map((route) => (
            <MyRouteCard
              key={route.id}
              route={route}
              variant="compact"
              hideTimelineBadge
              onSelectDay={handleSelectHistoryDay}
            />
          ))}
        </div>
      ) : null}

      {selectedRouteDay ? (
        <DayRoutePopup
          route={selectedRouteDay.route}
          day={selectedRouteDay.day}
          onClose={() => setSelectedHistoryRoute(null)}
          isReadOnly
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
