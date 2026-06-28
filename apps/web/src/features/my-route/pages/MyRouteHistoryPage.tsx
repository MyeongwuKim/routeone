import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { MdArrowBack, MdHistory } from "react-icons/md";
import { routeApi } from "@/api/routeApi";
import { PotatoLoadingCard } from "@/components/feedback/PotatoLoadingOverlay";
import DayRoutePopup from "@/features/my-route/components/DayRoutePopup";
import MyRouteCard from "@/features/my-route/components/MyRouteCard";
import { MY_ROUTES_QUERY_KEY } from "@/features/my-route/myRouteCache";
import {
  getRouteEndDateKey,
  getRouteTimelineState,
  getSelectableRouteDay,
  getTodayDateKey,
} from "@/features/my-route/routeDisplay";
import type { MyRoute, MyRouteDay } from "@/features/my-route/types";

function MyRouteHistoryPage() {
  const navigate = useNavigate();
  const [selectedHistoryRoute, setSelectedHistoryRoute] = useState<{
    routeId: string;
    dayId: string;
  } | null>(null);
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
        />
      ) : null}
    </section>
  );
}

export default MyRouteHistoryPage;
