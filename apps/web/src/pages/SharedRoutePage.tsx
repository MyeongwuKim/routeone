import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useInfiniteQuery,
  useQuery,
} from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { FaHeart, FaRegHeart } from "react-icons/fa";
import {
  MdArrowBack,
  MdClose,
  MdFilterAlt,
  MdOutlinePlace,
  MdSell,
} from "react-icons/md";
import { routeApi } from "@/api/routeApi";
import { PotatoLoadingCard } from "@/components/feedback/PotatoLoadingOverlay";
import RouteListSkeleton from "@/components/feedback/RouteListSkeleton";
import { DropdownSelect } from "@/components/inputs";
import type { GangwonRegionLabel } from "@/data/gangwonRegions";
import DayRoutePopup from "@/features/my-route/components/DayRoutePopup";
import RouteCheckoutModal from "@/features/route-checkout/components/RouteCheckoutModal";
import type { PlannedRouteDay } from "@/features/route-checkout/models/routePlanTypes";
import SharedRouteCard from "@/features/shared-route/components/SharedRouteCard";
import SharedRouteFilterDialog from "@/features/shared-route/components/SharedRouteFilterDialog";
import SharedRouteDetailSkeleton from "@/features/shared-route/components/SharedRouteDetailSkeleton";
import {
  createSavedPlacesFromRoutePlan,
  getRoutePlanStartLocation,
  getRoutePlanTripDays,
} from "@/features/shared-route/sharedRouteCheckout";
import {
  DEFAULT_FILTER_REGION,
  getActiveFilterCount,
  getFilterLabel,
  getNearestGangwonRegion,
  getSharedRouteFilterOptions,
  routeMatchesFilters,
} from "@/features/shared-route/sharedRouteFilters";
import {
  getRouteDetailPlaceLocalizationCandidates,
  getSharedRoutePlaceLocalizationCandidates,
  getSharedRoutePlaceLocalizationKey,
  localizeRouteDetailPlaces,
  localizeSharedRoutePlaces,
} from "@/features/shared-route/sharedRouteLocalization";
import {
  SHARED_ROUTE_PAGE_SIZE,
  getRouteSortTime,
  getSharedRoutePageCopy,
  getSharedRouteSortOptions,
  type SharedRoutePageMode,
  type SharedRouteSortKey,
} from "@/features/shared-route/sharedRouteListModel";
import {
  getSharedRouteConnection,
  getSharedRouteInfiniteList,
  type SharedRouteInfiniteData,
} from "@/features/shared-route/queries/sharedRouteCache";
import {
  getRouteDetailQueryKey,
  LIKED_SHARED_ROUTES_QUERY_KEY,
  SHARED_ROUTES_QUERY_KEY,
} from "@/features/shared-route/queries/sharedRouteQueryKeys";
import { useSharedRouteLike } from "@/features/shared-route/hooks/useSharedRouteLike";
import { useSharedRouteFilters } from "@/features/shared-route/hooks/useSharedRouteFilters";
import { getSortedRouteDays } from "@/features/my-route/routeDisplay";
import { getCurrentPosition } from "@/lib/currentPosition";
import { localizeTourPlaces } from "@/lib/placeLocalization";
import { useAppLanguageStore } from "@/stores/appLanguageStore";
import { useUiText } from "@/lib/uiText";

type SharedRoutePageProps = {
  mode?: SharedRoutePageMode;
};

function SharedRoutePage({ mode = "feed" }: SharedRoutePageProps) {
  const text = useUiText();
  const appLanguage = useAppLanguageStore((state) => state.language);
  const navigate = useNavigate();
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [checkoutRoutePlan, setCheckoutRoutePlan] = useState<
    PlannedRouteDay[] | null
  >(null);
  const [sortKey, setSortKey] = useState<SharedRouteSortKey>("shared-desc");
  const {
    activeFilters,
    draftFilters,
    isFilterDialogOpen,
    applyFilters: handleApplyFilters,
    clearActiveFilters: handleClearActiveFilters,
    clearDraftFilters: handleClearDraftFilters,
    closeFilterDialog,
    openFilterDialog,
    openFilterDialogWithCandidate,
    removeActiveFilter: handleRemoveActiveFilter,
    toggleDraftFilter: handleToggleDraftFilter,
  } = useSharedRouteFilters(appLanguage);
  const [defaultFilterRegion, setDefaultFilterRegion] =
    useState<GangwonRegionLabel>(DEFAULT_FILTER_REGION);
  const routeListScrollRef = useRef<HTMLDivElement>(null);
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null);
  const handleOpenRoute = useCallback(
    (route: { id: string }) => setSelectedRouteId(route.id),
    []
  );
  const pageCopy = getSharedRoutePageCopy(text, mode);
  const sortOptions = useMemo(() => getSharedRouteSortOptions(text), [text]);
  const routeListQueryKey =
    mode === "liked" ? LIKED_SHARED_ROUTES_QUERY_KEY : SHARED_ROUTES_QUERY_KEY;
  const routeListQuery = useInfiniteQuery({
    queryKey: routeListQueryKey,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) =>
      mode === "liked"
        ? routeApi.likedSharedRouteConnection({
            limit: SHARED_ROUTE_PAGE_SIZE,
            cursor: pageParam,
          })
        : routeApi.sharedRouteConnection({
            limit: SHARED_ROUTE_PAGE_SIZE,
            cursor: pageParam,
          }),
    getNextPageParam: (lastPage) => {
      const pageInfo = getSharedRouteConnection(lastPage, mode).pageInfo;

      return pageInfo.hasNextPage ? pageInfo.endCursor : undefined;
    },
  });
  const {
    fetchNextPage: fetchNextRoutePage,
    hasNextPage: hasNextRoutePage,
    isFetchingNextPage: isFetchingNextRoutePage,
    isFetchNextPageError: isNextRoutePageError,
  } = routeListQuery;
  const routes = useMemo(
    () =>
      getSharedRouteInfiniteList(
        routeListQuery.data as SharedRouteInfiniteData | undefined,
        mode
      ),
    [routeListQuery.data, mode]
  );
  const {
    likedRouteIds,
    pendingLikeRouteIds,
    toggleLike: handleToggleLike,
  } = useSharedRouteLike({ routes, mode });
  const routePlaceLocalizationCandidates = useMemo(
    () => getSharedRoutePlaceLocalizationCandidates(routes),
    [routes]
  );
  const routePlaceLocalizationKey = useMemo(
    () => getSharedRoutePlaceLocalizationKey(routePlaceLocalizationCandidates),
    [routePlaceLocalizationCandidates]
  );
  const routePlaceLocalizationQuery = useQuery({
    queryKey: [
      "shared-route-place-localizations",
      appLanguage,
      routePlaceLocalizationKey,
    ],
    enabled:
      appLanguage === "en" && routePlaceLocalizationCandidates.length > 0,
    queryFn: () =>
      localizeTourPlaces(routePlaceLocalizationCandidates, appLanguage, {
        retryUncached: true,
        retryAttempts: 3,
      }),
  });
  const displayRoutes = useMemo(
    () =>
      appLanguage === "en"
        ? localizeSharedRoutePlaces(
            routes,
            routePlaceLocalizationQuery.data ?? []
          )
        : routes,
    [appLanguage, routePlaceLocalizationQuery.data, routes]
  );
  const filterOptions = useMemo(
    () => getSharedRouteFilterOptions(displayRoutes, text),
    [displayRoutes, text]
  );
  const activeFilterCount = getActiveFilterCount(activeFilters);
  const filteredRoutes = useMemo(() => {
    return displayRoutes
      .filter((route) => routeMatchesFilters(route, activeFilters, text))
      .sort((left, right) => {
        if (sortKey === "likes-desc" || sortKey === "likes-asc") {
          const likeCountDifference =
            sortKey === "likes-desc"
              ? right.likeCount - left.likeCount
              : left.likeCount - right.likeCount;

          return (
            likeCountDifference ||
            getRouteSortTime(right) - getRouteSortTime(left)
          );
        }

        const sharedTimeDifference =
          sortKey === "shared-desc"
            ? getRouteSortTime(right) - getRouteSortTime(left)
            : getRouteSortTime(left) - getRouteSortTime(right);

        return sharedTimeDifference || right.likeCount - left.likeCount;
      });
  }, [activeFilters, displayRoutes, sortKey, text]);
  const canShowEmptyRoutes =
    !routeListQuery.isLoading &&
    !routeListQuery.isError &&
    !hasNextRoutePage &&
    !isFetchingNextRoutePage;
  const shouldSearchMoreForActiveFilters =
    activeFilterCount > 0 &&
    displayRoutes.length > 0 &&
    filteredRoutes.length === 0 &&
    Boolean(hasNextRoutePage) &&
    !isFetchingNextRoutePage &&
    !isNextRoutePageError;
  const shouldShowBottomLoadingCard =
    isFetchingNextRoutePage ||
    shouldSearchMoreForActiveFilters;
  const selectedRouteQuery = useQuery({
    queryKey: getRouteDetailQueryKey(selectedRouteId),
    enabled: Boolean(selectedRouteId),
    queryFn: async () => {
      if (!selectedRouteId) {
        throw new Error(text.sharedRoute.selectedRouteMissing);
      }

      const result = await routeApi.routeById(selectedRouteId);

      if (!result.route) {
        throw new Error(text.sharedRoute.routeNotFound);
      }

      return result;
    },
  });
  const selectedRoute = selectedRouteQuery.data?.route ?? null;
  const selectedRoutePlaceLocalizationCandidates = useMemo(
    () => getRouteDetailPlaceLocalizationCandidates(selectedRoute),
    [selectedRoute]
  );
  const selectedRoutePlaceLocalizationKey = useMemo(
    () =>
      getSharedRoutePlaceLocalizationKey(selectedRoutePlaceLocalizationCandidates),
    [selectedRoutePlaceLocalizationCandidates]
  );
  const selectedRoutePlaceLocalizationQuery = useQuery({
    queryKey: [
      "shared-route-detail-place-localizations",
      selectedRouteId,
      appLanguage,
      selectedRoutePlaceLocalizationKey,
    ],
    enabled:
      appLanguage === "en" &&
      selectedRoutePlaceLocalizationCandidates.length > 0,
    queryFn: () =>
      localizeTourPlaces(selectedRoutePlaceLocalizationCandidates, appLanguage, {
        retryUncached: true,
        retryAttempts: 3,
      }),
  });
  const reusableRoutePlaceLocalizationIds = useMemo(
    () =>
      new Set(
        (routePlaceLocalizationQuery.data ?? []).map((place) => place.id)
      ),
    [routePlaceLocalizationQuery.data]
  );
  const hasReusableSelectedRouteLocalizations =
    selectedRoutePlaceLocalizationCandidates.length > 0 &&
    selectedRoutePlaceLocalizationCandidates.every((place) =>
      reusableRoutePlaceLocalizationIds.has(place.id)
    );
  const selectedRouteLocalizedPlaces = useMemo(() => {
    const localizedById = new Map(
      [
        ...(selectedRoutePlaceLocalizationQuery.data ?? []),
        ...(routePlaceLocalizationQuery.data ?? []),
      ].map((place) => [place.id, place])
    );

    return [...localizedById.values()];
  }, [
    routePlaceLocalizationQuery.data,
    selectedRoutePlaceLocalizationQuery.data,
  ]);
  const isSelectedRouteLocalizationLoading =
    appLanguage === "en" &&
    selectedRoutePlaceLocalizationCandidates.length > 0 &&
    !hasReusableSelectedRouteLocalizations &&
    selectedRoutePlaceLocalizationQuery.isFetching;
  const displaySelectedRoute = useMemo(
    () =>
      appLanguage === "en"
        ? localizeRouteDetailPlaces(
            selectedRoute,
            selectedRouteLocalizedPlaces
          )
        : selectedRoute,
    [appLanguage, selectedRoute, selectedRouteLocalizedPlaces]
  );
  const selectedRouteDay = displaySelectedRoute
    ? (getSortedRouteDays(displaySelectedRoute)[0] ?? null)
    : null;
  const checkoutSavedPlaces = useMemo(
    () => (checkoutRoutePlan ? createSavedPlacesFromRoutePlan(checkoutRoutePlan) : []),
    [checkoutRoutePlan]
  );
  const checkoutCandidatePlaces = useMemo(
    () => checkoutSavedPlaces.map((item) => item.place),
    [checkoutSavedPlaces]
  );
  const checkoutStartLocation = useMemo(
    () => (checkoutRoutePlan ? getRoutePlanStartLocation(checkoutRoutePlan) : null),
    [checkoutRoutePlan]
  );
  const checkoutTripDays = useMemo(
    () => (checkoutRoutePlan ? getRoutePlanTripDays(checkoutRoutePlan) : 1),
    [checkoutRoutePlan]
  );

  useEffect(() => {
    let isMounted = true;

    getCurrentPosition()
      .then((position) => {
        if (!isMounted) {
          return;
        }

        setDefaultFilterRegion(
          getNearestGangwonRegion({
            lat: position.lat,
            lng: position.lng,
          })
        );
      })
      .catch(() => {
        if (isMounted) {
          setDefaultFilterRegion(DEFAULT_FILTER_REGION);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const root = routeListScrollRef.current;
    const target = loadMoreTriggerRef.current;

    if (!target || !hasNextRoutePage || isNextRoutePageError) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const isVisible = entries.some((entry) => entry.isIntersecting);

        if (
          isVisible &&
          hasNextRoutePage &&
          !isFetchingNextRoutePage &&
          !isNextRoutePageError
        ) {
          void fetchNextRoutePage();
        }
      },
      {
        root,
        rootMargin: "180px 0px",
      }
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [
    fetchNextRoutePage,
    hasNextRoutePage,
    isFetchingNextRoutePage,
    isNextRoutePageError,
  ]);

  useEffect(() => {
    if (!shouldSearchMoreForActiveFilters) {
      return;
    }

    void fetchNextRoutePage();
  }, [fetchNextRoutePage, shouldSearchMoreForActiveFilters]);

  const handleRequestCheckoutFromSharedRoute = (
    routePlan: PlannedRouteDay[]
  ) => {
    setCheckoutRoutePlan(routePlan);
  };
  const handleCloseCheckout = () => {
    setCheckoutRoutePlan(null);
  };

  return (
    <section className="flex h-full min-h-0 flex-col gap-3">
      {mode === "liked" ? (
        <header className="flex items-center gap-3">
          <button
            type="button"
            aria-label={text.sharedRoute.likedBackAria}
            onClick={() => navigate("/me")}
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-xl text-brand-700 shadow-sm transition hover:bg-brand-100 dark:border-brand-400/30 dark:bg-[#0f3431] dark:text-brand-200 dark:shadow-[0_10px_24px_rgba(0,0,0,0.22)] dark:hover:bg-[#13423e]"
          >
            <MdArrowBack />
          </button>
          <div className="min-w-0">
            <p className="text-xs font-black text-brand-700">
              {text.routeShell.myInfoTitle}
            </p>
            <h1 className="truncate text-lg font-bold text-slate-900">
              {text.sharedRoute.likedTitle}
            </h1>
          </div>
        </header>
      ) : null}

      {mode === "liked" ? (
        <div className="rounded-2xl border border-brand-200 bg-white p-4 shadow-sm dark:border-brand-400/25 dark:bg-slate-950/40">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-xl text-brand-700 dark:bg-brand-400/15 dark:text-brand-100">
              <FaHeart />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {pageCopy.title}
              </p>
              <p className="mt-0.5 text-xs font-semibold text-slate-500 dark:text-slate-300">
                {pageCopy.description}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <DropdownSelect
            ariaLabel={text.sharedRoute.sortAria}
            options={sortOptions}
            value={sortKey}
            onChange={setSortKey}
            className="w-40 shrink-0"
            buttonClassName="min-h-10 rounded-full px-3 py-2 text-xs"
            menuClassName="left-0 right-auto"
          />
          <button
            type="button"
            onClick={openFilterDialog}
            className={`inline-flex min-h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-xs font-black transition ${
              activeFilterCount > 0
                ? "border-brand-500 bg-brand-600 text-white"
                : "border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-400/30 dark:bg-brand-400/10 dark:text-brand-100"
            }`}
          >
            <MdFilterAlt className="shrink-0 text-sm" />
            <span className="truncate">
              {text.sharedRoute.filterButton(activeFilterCount)}
            </span>
          </button>
        </div>

        {activeFilterCount > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {activeFilters.tags.map((tag) => (
              <button
                key={`tag:${tag}`}
                type="button"
                onClick={() =>
                  handleRemoveActiveFilter({ type: "tag", value: tag })
                }
                className="inline-flex max-w-full items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1.5 text-[11px] font-black text-brand-700 dark:border-brand-400/30 dark:bg-brand-400/10 dark:text-brand-100"
              >
                <MdSell className="shrink-0 text-xs" />
                <span className="min-w-0 truncate">
                  {getFilterLabel({ type: "tag", value: tag }, text)}
                </span>
                <MdClose className="shrink-0 text-xs" />
              </button>
            ))}
            {activeFilters.places.map((place) => (
              <button
                key={`place:${place.region}:${place.name}`}
                type="button"
                onClick={() =>
                  handleRemoveActiveFilter({
                    type: "place",
                    value: place.name,
                    region: place.region,
                  })
                }
                className="inline-flex max-w-full items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-black text-slate-600 dark:border-brand-400/25 dark:bg-[#0b211f] dark:text-slate-200"
              >
                <MdOutlinePlace className="shrink-0 text-xs" />
                <span className="min-w-0 truncate">
                  {getFilterLabel(
                    {
                      type: "place",
                      value: place.name,
                      region: place.region,
                    },
                    text
                  )}
                </span>
                <MdClose className="shrink-0 text-xs" />
              </button>
            ))}
            <button
              type="button"
              onClick={handleClearActiveFilters}
              className="inline-flex items-center rounded-full px-2.5 py-1.5 text-[11px] font-black text-slate-400 transition hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-200"
            >
              {text.sharedRoute.clearActiveFilters}
            </button>
          </div>
        ) : null}
      </div>

      <div
        ref={routeListScrollRef}
        className="scrollbar-hide min-h-0 flex-1 space-y-3 overflow-y-auto px-px pb-4 pt-1"
      >
        {routeListQuery.isError && routes.length === 0 ? (
          <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-semibold text-rose-700 dark:border-rose-400/30 dark:bg-rose-950/30 dark:text-rose-200">
            <p>{pageCopy.error}</p>
            <button
              type="button"
              onClick={() => void routeListQuery.refetch()}
              className="mt-3 rounded-full bg-rose-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-rose-700 disabled:cursor-wait disabled:opacity-60"
              disabled={routeListQuery.isFetching}
            >
              {text.common.retry}
            </button>
          </div>
        ) : null}

        {routeListQuery.isLoading && routes.length === 0 ? (
          <RouteListSkeleton variant="shared" />
        ) : null}

        {canShowEmptyRoutes && routes.length === 0 ? (
          <div className="flex min-h-full flex-col justify-center">
            <PotatoLoadingCard
              title={pageCopy.empty}
              description={
                mode === "liked"
                  ? text.sharedRoute.emptyLikedDescription
                  : text.sharedRoute.emptyFeedDescription
              }
              footerText={
                mode === "liked"
                  ? text.sharedRoute.emptyLikedFooter
                  : text.sharedRoute.emptyFeedFooter
              }
              animation="empty"
              compact
              className="shadow-sm"
            />
          </div>
        ) : null}

        {canShowEmptyRoutes && routes.length > 0 && filteredRoutes.length === 0 ? (
          <div className="flex min-h-full flex-col justify-center">
            <PotatoLoadingCard
              title={text.sharedRoute.noFilteredTitle}
              description={text.sharedRoute.noFilteredDescription}
              footerText={text.sharedRoute.noFilteredFooter}
              animation="empty"
              compact
              className="shadow-sm"
            />
          </div>
        ) : null}

        {filteredRoutes.map((route) => (
          <SharedRouteCard
            key={route.id}
            route={route}
            isLiked={likedRouteIds.has(route.id) || route.likedByMe}
            isLikePending={pendingLikeRouteIds.has(route.id)}
            onToggleLike={handleToggleLike}
            onOpen={handleOpenRoute}
            onRequestFilter={openFilterDialogWithCandidate}
          />
        ))}

        {hasNextRoutePage ? (
          <div ref={loadMoreTriggerRef} className="h-8" aria-hidden="true" />
        ) : null}

        {shouldShowBottomLoadingCard ? (
          <div className="py-2">
            <PotatoLoadingCard
              title={
                activeFilterCount > 0 && filteredRoutes.length === 0
                  ? text.sharedRoute.searchingConditions
                  : text.sharedRoute.loadingNext
              }
              animation="running"
              compact
              className="shadow-sm"
            />
          </div>
        ) : null}

        {isNextRoutePageError ? (
          <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-center text-sm font-semibold text-rose-700 dark:border-rose-400/30 dark:bg-rose-950/30 dark:text-rose-200">
            <p>{pageCopy.error}</p>
            <button
              type="button"
              onClick={() => void fetchNextRoutePage()}
              className="mt-3 rounded-full bg-rose-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-rose-700 disabled:cursor-wait disabled:opacity-60"
              disabled={isFetchingNextRoutePage}
            >
              {text.common.retry}
            </button>
          </div>
        ) : null}
      </div>
      {isFilterDialogOpen ? (
        <SharedRouteFilterDialog
          filters={draftFilters}
          tagOptions={filterOptions.tags}
          placeRegions={filterOptions.placeRegions}
          defaultRegion={defaultFilterRegion}
          onToggle={handleToggleDraftFilter}
          onClear={handleClearDraftFilters}
          onClose={closeFilterDialog}
          onConfirm={handleApplyFilters}
        />
      ) : null}
      {selectedRouteId &&
      (selectedRouteQuery.isLoading || isSelectedRouteLocalizationLoading) ? (
        <SharedRouteDetailSkeleton onClose={() => setSelectedRouteId(null)} />
      ) : null}
      {selectedRouteId && selectedRouteQuery.isError ? (
        <div className="fixed inset-0 z-[2300] flex items-center justify-center bg-white px-4 dark:bg-[#071718]">
          <div className="w-full max-w-sm rounded-2xl border border-rose-100 bg-rose-50 p-4 text-center shadow-sm dark:border-rose-400/30 dark:bg-rose-950/30">
            <p className="text-sm font-bold text-rose-700 dark:text-rose-200">
              {text.sharedRoute.detailError}
            </p>
            <div className="mt-3 flex justify-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedRouteId(null)}
                className="rounded-full border border-rose-200 bg-white px-4 py-2 text-xs font-bold text-rose-700 dark:border-rose-400/30 dark:bg-rose-950/30 dark:text-rose-100"
              >
                {text.common.close}
              </button>
              <button
                type="button"
                onClick={() => void selectedRouteQuery.refetch()}
                className="rounded-full bg-brand-600 px-4 py-2 text-xs font-bold text-white disabled:cursor-wait disabled:opacity-60"
                disabled={selectedRouteQuery.isFetching}
              >
                {text.common.retry}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {displaySelectedRoute &&
      selectedRouteDay &&
      !isSelectedRouteLocalizationLoading ? (
        <DayRoutePopup
          route={displaySelectedRoute}
          day={selectedRouteDay}
          isReadOnly
          headerLabel="SHARED ROUTE"
          headerBadge={
            displaySelectedRoute.isMine ? text.sharedRoute.mineBadge : undefined
          }
          enableStartPreview
          enableVerificationPhotoPreview
          onRequestCheckout={handleRequestCheckoutFromSharedRoute}
          readOnlyFooterAction={
            displaySelectedRoute.isMine
              ? {
                  label: String(displaySelectedRoute.likeCount),
                  ariaLabel: text.sharedRoute.ownRouteLikeAria(
                    displaySelectedRoute.likeCount
                  ),
                  icon: <FaHeart className="text-lg" />,
                  isActive: true,
                  disabled: true,
                  onClick: () => undefined,
                }
              : {
                  label: String(displaySelectedRoute.likeCount),
                  ariaLabel:
                    likedRouteIds.has(displaySelectedRoute.id) ||
                    displaySelectedRoute.likedByMe
                      ? text.sharedRoute.unlikeAria(
                          displaySelectedRoute.likeCount
                        )
                      : text.sharedRoute.likeAria(displaySelectedRoute.likeCount),
                  icon:
                    likedRouteIds.has(displaySelectedRoute.id) ||
                    displaySelectedRoute.likedByMe ? (
                      <FaHeart className="text-lg" />
                    ) : (
                      <FaRegHeart className="text-lg" />
                    ),
                  isActive:
                    likedRouteIds.has(displaySelectedRoute.id) ||
                    displaySelectedRoute.likedByMe,
                  disabled: pendingLikeRouteIds.has(displaySelectedRoute.id),
                  onClick: () => void handleToggleLike(displaySelectedRoute),
                }
          }
          onClose={() => setSelectedRouteId(null)}
        />
      ) : null}
      <RouteCheckoutModal
        isOpen={Boolean(checkoutRoutePlan)}
        savedPlaces={checkoutSavedPlaces}
        insertCandidatePlaces={checkoutCandidatePlaces}
        currentLocation={checkoutStartLocation}
        initialStep="schedule"
        initialTripDays={checkoutTripDays}
        initialRoutePlan={checkoutRoutePlan}
        onClose={handleCloseCheckout}
        onSelectPlace={() => undefined}
        onRemovePlace={() => undefined}
        onClearPlaces={handleCloseCheckout}
        onRequestSearchPlace={() => {
          handleCloseCheckout();
          navigate("/");
        }}
      />
    </section>
  );
}

export default SharedRoutePage;
