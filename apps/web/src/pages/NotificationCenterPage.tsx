import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { IoClose } from "react-icons/io5";
import {
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import {
  MdCelebration,
  MdChevronRight,
  MdExpandLess,
  MdExpandMore,
  MdLocationOn,
  MdNotificationsNone,
  MdOutlineRoute,
} from "react-icons/md";
import {
  notificationApi,
  NOTIFICATION_INBOX_FIRST_PAGE_QUERY_KEY,
  NOTIFICATION_INBOX_INFINITE_QUERY_KEY,
  NOTIFICATION_INBOX_PAGE_SIZE,
  type NotificationInboxPageParam,
} from "@/api/notificationApi";
import { PotatoLoadingCard } from "@/components/feedback/PotatoLoadingOverlay";
import { festivalApi } from "@/api/festivalApi";
import {
  GANGWON_REGIONS,
  GANGWON_SIGNGU_ADMIN_CODES,
} from "@/data/gangwonRegions";
import { formatFestivalPeriod } from "@/lib/festivalDate";
import type {
  FestivalNotificationKind,
  GangwonFestivalsQuery,
  NotificationInboxQuery,
  RouteReviewNotificationKind,
} from "@/generated/graphql";
import {
  createMapSheetPlaceFromAttraction,
  resolveMarkerType,
} from "@/lib/gangwonAttractionMap";
import { UI_LAYER_CLASS } from "@/lib/uiLayers";
import { useUiText } from "@/lib/uiText";
import type { GangwonAttraction } from "@/lib/visitKoreaTourApi";
import type { NativeFestivalNotificationKind } from "@/native-bridge";
import { useAppLanguageStore } from "@/stores/appLanguageStore";
import { useMapSheetStore } from "@/stores/mapSheetStore";
import { useUiToastStore } from "@/stores/uiToastStore";

const FESTIVAL_PREVIEW_COUNT = 3;
type NotificationInboxItem =
  NotificationInboxQuery["notificationInbox"]["items"][number];
type NotificationInboxInfiniteData = InfiniteData<
  NotificationInboxQuery,
  NotificationInboxPageParam
>;
type FestivalNotificationInboxItem = NotificationInboxItem & {
  type: "FESTIVAL_SUMMARY";
  festivalKind: FestivalNotificationKind;
  regionCode: string;
  regionLabel: string;
  dateKey: string;
};
type RouteArrivalNotificationInboxItem = NotificationInboxItem & {
  type: "ROUTE_ARRIVAL";
  routeId: string;
  dayId: string;
  stopId: string;
  placeTitle: string;
};
type RouteReviewNotificationInboxItem = NotificationInboxItem & {
  type: "ROUTE_REVIEW";
  routeReviewKind: RouteReviewNotificationKind;
  routeId: string;
  routeTitle: string;
  dayId: string;
  correctionDeadlineAt: string;
};
type SupportedNotificationInboxItem =
  | FestivalNotificationInboxItem
  | RouteArrivalNotificationInboxItem
  | RouteReviewNotificationInboxItem;

function isFestivalNotificationInboxItem(
  item: NotificationInboxItem
): item is FestivalNotificationInboxItem {
  return (
    item.type === "FESTIVAL_SUMMARY" &&
    Boolean(
      item.festivalKind &&
        item.regionCode &&
        item.regionLabel &&
        item.dateKey &&
        item.festivalTitles.length > 0
    )
  );
}

function isRouteArrivalNotificationInboxItem(
  item: NotificationInboxItem
): item is RouteArrivalNotificationInboxItem {
  return (
    item.type === "ROUTE_ARRIVAL" &&
    Boolean(item.routeId && item.dayId && item.stopId && item.placeTitle)
  );
}

function isRouteReviewNotificationInboxItem(
  item: NotificationInboxItem
): item is RouteReviewNotificationInboxItem {
  return (
    item.type === "ROUTE_REVIEW" &&
    Boolean(
      item.routeReviewKind &&
        item.routeId &&
        item.routeTitle &&
        item.dayId &&
        item.correctionDeadlineAt
    )
  );
}

function isSupportedNotificationInboxItem(
  item: NotificationInboxItem
): item is SupportedNotificationInboxItem {
  return (
    isFestivalNotificationInboxItem(item) ||
    isRouteArrivalNotificationInboxItem(item) ||
    isRouteReviewNotificationInboxItem(item)
  );
}

function getUiFestivalNotificationKind(
  kind: FestivalNotificationKind
): NativeFestivalNotificationKind {
  return kind.toLowerCase() as NativeFestivalNotificationKind;
}

function markNotificationPageRead(
  page: NotificationInboxQuery,
  readAt: string
): NotificationInboxQuery {
  return {
    ...page,
    unreadNotificationCount: 0,
    notificationInbox: {
      ...page.notificationInbox,
      items: page.notificationInbox.items.map((item) =>
        item.readAt
          ? item
          : {
              ...item,
              readAt,
            }
      ),
    },
  };
}

function createFestivalAttraction(
  festival: GangwonFestivalsQuery["gangwonFestivals"][number]
): GangwonAttraction {
  const eventStartDate = festival.startDate.replaceAll("-", "");
  const eventEndDate = festival.endDate.replaceAll("-", "");

  return {
    id: festival.id,
    title: festival.title,
    address: festival.address,
    lat: festival.lat,
    lng: festival.lng,
    contentTypeId: "15",
    lclsSystm1: "",
    lclsSystm2: "",
    lclsSystm3: "",
    firstImage: festival.imageUrl,
    secondImage: "",
    eventStartDate,
    eventEndDate,
    isTodayFestival: false,
    tourApiSigunguCode: festival.regionCode,
  };
}

function addDateKeyDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    return dateKey;
  }

  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getFallbackFestivalLookupEndDate(
  item: FestivalNotificationInboxItem
) {
  if (item.festivalKind === "MONTHLY") {
    return addDateKeyDays(item.dateKey, 30);
  }

  if (
    item.festivalKind === "WEEKLY" ||
    item.festivalKind === "TEST"
  ) {
    return addDateKeyDays(item.dateKey, 6);
  }

  return item.dateKey;
}

function FestivalNotificationItem({
  item,
  isFocused,
  openingFestivalId,
  onOpenFestival,
}: {
  item: FestivalNotificationInboxItem;
  isFocused: boolean;
  openingFestivalId: string | null;
  onOpenFestival: (
    item: FestivalNotificationInboxItem,
    festivalIndex: number
  ) => void;
}) {
  const text = useUiText();
  const appLanguage = useAppLanguageStore((state) => state.language);
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(isFocused);
  const region = GANGWON_REGIONS.find(
    (candidate) => candidate.sigunguCode === item.regionCode
  );
  const regionLabel = region
    ? (text.labels.regions[region.label] ?? region.label)
    : item.regionLabel;
  const kindLabel =
    text.notifications.kinds[getUiFestivalNotificationKind(item.festivalKind)];
  const visibleFestivalIndexes = Array.from(
    {
      length: isExpanded
        ? item.festivalTitles.length
        : Math.min(item.festivalTitles.length, FESTIVAL_PREVIEW_COUNT),
    },
    (_, index) => index
  );
  const hiddenFestivalCount =
    item.festivalTitles.length - visibleFestivalIndexes.length;

  const openFestivalSearch = () => {
    const searchParams = new URLSearchParams({
      festivalRegion: item.regionCode,
      festivalDate: item.dateKey,
      source: "festival-inbox",
    });

    navigate(`/home?${searchParams.toString()}`);
  };

  return (
    <article
      id={`notification-${item.notificationKey}`}
      className={`overflow-hidden rounded-lg border bg-white shadow-sm transition dark:bg-[#071f1d] ${
        isFocused
          ? "border-brand-500 ring-2 ring-brand-200 dark:border-brand-300 dark:ring-brand-400/25"
          : "border-brand-100 dark:border-brand-400/25"
      }`}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-xl text-rose-500 dark:bg-rose-400/15 dark:text-rose-200">
          <MdCelebration aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-black text-brand-700 dark:bg-brand-400/15 dark:text-brand-100">
              {kindLabel}
            </span>
            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-300">
              {text.notifications.formatDate(item.dateKey)}
            </span>
          </div>
          <h2 className="mt-1.5 text-sm font-black text-slate-900 dark:text-white">
            {text.notifications.summaryTitle(
              regionLabel,
              item.festivalTitles.length
            )}
          </h2>
        </div>
      </div>

      <div className="border-t border-brand-50 dark:border-brand-400/15">
        {visibleFestivalIndexes.map((festivalIndex) => {
          const festivalTitle = item.festivalTitles[festivalIndex];
          const festivalPeriod = formatFestivalPeriod(
            item.festivalStartDates[festivalIndex],
            item.festivalEndDates[festivalIndex],
            appLanguage
          );
          const festivalId = item.festivalIds[festivalIndex] ?? null;
          const isOpening = Boolean(
            festivalId && festivalId === openingFestivalId
          );

          return (
            <button
              key={`${item.id}:${festivalTitle}`}
              type="button"
              aria-label={text.notifications.openFestivalAria(festivalTitle)}
              aria-busy={isOpening}
              disabled={isOpening}
              onClick={() => onOpenFestival(item, festivalIndex)}
              className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 hover:bg-brand-50/70 active:bg-brand-100/70 disabled:cursor-wait disabled:bg-brand-50/70 dark:border-brand-400/10 dark:hover:bg-brand-400/10 dark:disabled:bg-brand-400/10"
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-black text-slate-500 dark:bg-slate-900 dark:text-slate-200">
                {festivalIndex + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-slate-700 dark:text-slate-100">
                  {festivalTitle}
                </span>
                {festivalPeriod ? (
                  <span className="mt-1 block text-xs font-semibold text-brand-700 dark:text-brand-200">
                    {festivalPeriod}
                  </span>
                ) : null}
              </span>
              {isOpening ? (
                <span className="size-4 shrink-0 animate-spin rounded-full border-2 border-brand-100 border-t-brand-600 dark:border-brand-400/20 dark:border-t-brand-200" />
              ) : (
                <MdChevronRight className="shrink-0 text-xl text-slate-300 dark:text-slate-500" />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-brand-50 bg-slate-50/70 px-3 py-2 dark:border-brand-400/15 dark:bg-slate-950/30">
        <button
          type="button"
          onClick={() => openFestivalSearch()}
          className="px-2 py-1.5 text-xs font-black text-brand-700 transition hover:text-brand-800 dark:text-brand-200"
        >
          {text.notifications.viewAll}
        </button>

        {item.festivalTitles.length > FESTIVAL_PREVIEW_COUNT ? (
          <button
            type="button"
            aria-expanded={isExpanded}
            onClick={() => setIsExpanded((current) => !current)}
            className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-bold text-slate-500 transition hover:text-slate-700 dark:text-slate-300 dark:hover:text-white"
          >
            {isExpanded
              ? text.notifications.collapse
              : text.notifications.showMore(hiddenFestivalCount)}
            {isExpanded ? <MdExpandLess /> : <MdExpandMore />}
          </button>
        ) : null}
      </div>
    </article>
  );
}

function RouteArrivalNotificationItem({
  item,
  isFocused,
}: {
  item: RouteArrivalNotificationInboxItem;
  isFocused: boolean;
}) {
  const text = useUiText();
  const navigate = useNavigate();
  const routeLabel = item.routeTitle?.trim() || item.placeTitle;

  return (
    <button
      id={`notification-${item.notificationKey}`}
      type="button"
      aria-label={text.notifications.openRouteAria(routeLabel)}
      onClick={() =>
        navigate(
          `/my-route?${new URLSearchParams({
            routeId: item.routeId,
            dayId: item.dayId,
            stopId: item.stopId,
            source: "notification-inbox",
          }).toString()}`
        )
      }
      className={`flex w-full items-start gap-3 rounded-lg border bg-white px-4 py-4 text-left shadow-sm transition hover:bg-brand-50/60 dark:bg-[#071f1d] dark:hover:bg-brand-400/10 ${
        isFocused
          ? "border-brand-500 ring-2 ring-brand-200 dark:border-brand-300 dark:ring-brand-400/25"
          : "border-brand-100 dark:border-brand-400/25"
      }`}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-xl text-sky-600 dark:bg-sky-400/15 dark:text-sky-200">
        <MdLocationOn />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-bold text-slate-400 dark:text-slate-300">
          {text.notifications.formatTimestamp(item.availableAt)}
        </span>
        <span className="mt-1 block text-sm font-black text-slate-900 dark:text-white">
          {text.notifications.arrivalTitle(item.placeTitle)}
        </span>
        <span className="mt-1 block text-xs font-semibold text-slate-500 dark:text-slate-300">
          {text.notifications.arrivalDescription}
        </span>
      </span>
      <MdChevronRight className="mt-4 shrink-0 text-xl text-slate-300 dark:text-slate-500" />
    </button>
  );
}

function RouteReviewNotificationItem({
  item,
  isFocused,
}: {
  item: RouteReviewNotificationInboxItem;
  isFocused: boolean;
}) {
  const text = useUiText();
  const navigate = useNavigate();
  const title =
    item.routeReviewKind === "COMPLETED"
      ? text.notifications.routeReviewCompletedTitle(item.routeTitle)
      : item.routeReviewKind === "UNSTARTED"
        ? text.notifications.routeReviewUnstartedTitle(item.routeTitle)
        : text.notifications.routeReviewIncompleteTitle(item.routeTitle);

  return (
    <button
      id={`notification-${item.notificationKey}`}
      type="button"
      aria-label={text.notifications.openRouteAria(item.routeTitle)}
      onClick={() =>
        navigate(
          `/me/routes?${new URLSearchParams({
            routeId: item.routeId,
            dayId: item.dayId,
            source: "notification-inbox",
          }).toString()}`
        )
      }
      className={`flex w-full items-start gap-3 rounded-lg border bg-white px-4 py-4 text-left shadow-sm transition hover:bg-brand-50/60 dark:bg-[#071f1d] dark:hover:bg-brand-400/10 ${
        isFocused
          ? "border-brand-500 ring-2 ring-brand-200 dark:border-brand-300 dark:ring-brand-400/25"
          : "border-brand-100 dark:border-brand-400/25"
      }`}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-xl text-amber-600 dark:bg-amber-400/15 dark:text-amber-200">
        <MdOutlineRoute />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-bold text-slate-400 dark:text-slate-300">
          {text.notifications.formatTimestamp(item.availableAt)}
        </span>
        <span className="mt-1 block text-sm font-black text-slate-900 dark:text-white">
          {title}
        </span>
        <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500 dark:text-slate-300">
          {text.notifications.routeReviewDescription(
            item.correctionDeadlineAt
          )}
        </span>
      </span>
      <MdChevronRight className="mt-4 shrink-0 text-xl text-slate-300 dark:text-slate-500" />
    </button>
  );
}

function NotificationCenterPage() {
  const text = useUiText();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const openSheet = useMapSheetStore((state) => state.openSheet);
  const showToast = useUiToastStore((state) => state.showToast);
  const [searchParams] = useSearchParams();
  const focusedNotificationId =
    searchParams.get("notificationId")?.trim() ?? "";
  const isMarkAllPendingRef = useRef(false);
  const festivalDetailRequestRef = useRef(0);
  const focusedNotificationScrolledRef = useRef<string | null>(null);
  const inboxScrollRef = useRef<HTMLDivElement>(null);
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null);
  const [openingFestivalId, setOpeningFestivalId] = useState<string | null>(
    null
  );
  const notificationInboxQuery = useInfiniteQuery({
    queryKey: NOTIFICATION_INBOX_INFINITE_QUERY_KEY,
    initialPageParam: null as NotificationInboxPageParam,
    queryFn: ({ pageParam }) =>
      notificationApi.inbox({
        first: NOTIFICATION_INBOX_PAGE_SIZE,
        after: pageParam,
      }),
    getNextPageParam: (lastPage) => {
      const { pageInfo } = lastPage.notificationInbox;

      return pageInfo.hasNextPage && pageInfo.endCursor
        ? pageInfo.endCursor
        : undefined;
    },
    staleTime: 30_000,
  });
  const {
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
  } = notificationInboxQuery;
  const firstNotificationPage = notificationInboxQuery.data?.pages[0];
  const items = useMemo(() => {
    const notificationIds = new Set<string>();

    return (notificationInboxQuery.data?.pages ?? [])
      .flatMap((page) => page.notificationInbox.items)
      .filter(isSupportedNotificationInboxItem)
      .filter((item) => {
        if (notificationIds.has(item.id)) {
          return false;
        }

        notificationIds.add(item.id);
        return true;
      });
  }, [notificationInboxQuery.data?.pages]);
  const isFocusedNotificationLoaded = Boolean(
    focusedNotificationId &&
      items.some((item) => item.notificationKey === focusedNotificationId)
  );
  const isResolvingFocusedNotification =
    Boolean(focusedNotificationId) &&
    !isFocusedNotificationLoaded &&
    Boolean(hasNextPage);
  const { mutate: markRead } = useMutation({
    mutationFn: () => notificationApi.markRead(),
    onSuccess: () => {
      const readAt = new Date().toISOString();

      queryClient.setQueryData<NotificationInboxQuery>(
        NOTIFICATION_INBOX_FIRST_PAGE_QUERY_KEY,
        (currentData) =>
          currentData
            ? markNotificationPageRead(currentData, readAt)
            : currentData
      );
      queryClient.setQueryData<NotificationInboxInfiniteData>(
        NOTIFICATION_INBOX_INFINITE_QUERY_KEY,
        (currentData) =>
          currentData
            ? {
                ...currentData,
                pages: currentData.pages.map((page) =>
                  markNotificationPageRead(page, readAt)
                ),
              }
            : currentData
      );
    },
    onSettled: () => {
      isMarkAllPendingRef.current = false;
    },
  });

  useEffect(() => {
    if (
      !firstNotificationPage?.unreadNotificationCount ||
      isMarkAllPendingRef.current
    ) {
      return;
    }

    isMarkAllPendingRef.current = true;
    markRead();
  }, [
    firstNotificationPage?.unreadNotificationCount,
    markRead,
  ]);

  useEffect(() => {
    if (!focusedNotificationId) {
      focusedNotificationScrolledRef.current = null;
      return;
    }

    if (
      focusedNotificationScrolledRef.current === focusedNotificationId
    ) {
      return;
    }

    const focusedNotificationElement = document.getElementById(
      `notification-${focusedNotificationId}`
    );

    if (!focusedNotificationElement) {
      if (hasNextPage && !isFetchingNextPage && !isFetchNextPageError) {
        void fetchNextPage();
      }
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      focusedNotificationElement.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
      focusedNotificationScrolledRef.current = focusedNotificationId;
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [
    fetchNextPage,
    focusedNotificationId,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    items,
  ]);

  useEffect(
    () => () => {
      festivalDetailRequestRef.current += 1;
    },
    []
  );

  useEffect(() => {
    const root = inboxScrollRef.current;
    const target = loadMoreTriggerRef.current;

    if (
      !target ||
      !hasNextPage ||
      isFetchNextPageError ||
      isResolvingFocusedNotification
    ) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const isVisible = entries.some((entry) => entry.isIntersecting);

        if (
          isVisible &&
          hasNextPage &&
          !isFetchingNextPage &&
          !isFetchNextPageError &&
          !isResolvingFocusedNotification
        ) {
          void fetchNextPage();
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
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    isResolvingFocusedNotification,
  ]);

  const handleOpenFestival = useCallback(
    async (
      item: FestivalNotificationInboxItem,
      festivalIndex: number
    ) => {
      const festivalId = item.festivalIds[festivalIndex]?.trim() ?? "";
      const festivalTitle =
        item.festivalTitles[festivalIndex]?.trim() ?? "";
      const festivalStartDate =
        item.festivalStartDates[festivalIndex]?.trim() ?? "";
      const hasFestivalStartDate =
        /^\d{4}-\d{2}-\d{2}$/.test(festivalStartDate);
      const lookupStartDate = hasFestivalStartDate
        ? festivalStartDate
        : item.dateKey;
      const lookupEndDate = hasFestivalStartDate
        ? festivalStartDate
        : getFallbackFestivalLookupEndDate(item);

      if (!festivalId || !festivalTitle) {
        showToast(text.notifications.festivalDetailLoadError, 2600);
        return;
      }

      const requestId = festivalDetailRequestRef.current + 1;
      festivalDetailRequestRef.current = requestId;
      setOpeningFestivalId(festivalId);

      try {
        const result = await queryClient.fetchQuery({
          queryKey: [
            "gangwon-festivals",
            "notification-detail",
            lookupStartDate,
            lookupEndDate,
          ],
          queryFn: () =>
            festivalApi.list(lookupStartDate, lookupEndDate),
          staleTime: 1000 * 60 * 60 * 6,
        });

        if (festivalDetailRequestRef.current !== requestId) {
          return;
        }

        const festival =
          result.gangwonFestivals.find(
            (candidate) =>
              candidate.id === festivalId &&
              candidate.regionCode === item.regionCode
          ) ??
          result.gangwonFestivals.find(
            (candidate) =>
              candidate.regionCode === item.regionCode &&
              candidate.title.trim() === festivalTitle
          );

        if (!festival) {
          throw new Error("Festival detail was not found.");
        }

        const attraction = createFestivalAttraction(festival);
        const markerType = resolveMarkerType(attraction, {});

        openSheet(
          createMapSheetPlaceFromAttraction({
            attraction,
            markerType,
            signguCode:
              GANGWON_SIGNGU_ADMIN_CODES[festival.regionCode] ?? "",
            touristTrendName: festival.title,
            topRank: null,
          }),
          {
            mode: "full-popup",
          }
        );
      } catch {
        if (festivalDetailRequestRef.current === requestId) {
          showToast(text.notifications.festivalDetailLoadError, 2600);
        }
      } finally {
        if (festivalDetailRequestRef.current === requestId) {
          setOpeningFestivalId(null);
        }
      }
    },
    [openSheet, queryClient, showToast, text]
  );

  const orderedItems = items;

  const handleClose = () => {
    if (location.key === "default") {
      navigate("/home", { replace: true });
      return;
    }

    navigate(-1);
  };

  const renderInboxContent = () => {
    if (notificationInboxQuery.isLoading) {
      return (
        <section
          aria-busy="true"
          className="h-full space-y-3 overflow-hidden px-px"
        >
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="h-44 animate-pulse rounded-lg border border-brand-100 bg-white dark:border-brand-400/25 dark:bg-[#071f1d]"
            />
          ))}
        </section>
      );
    }

    if (notificationInboxQuery.isError && !notificationInboxQuery.data) {
      return (
        <section className="flex h-full min-h-72 flex-col items-center justify-center px-6 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-rose-50 text-3xl text-rose-500 dark:bg-rose-400/15 dark:text-rose-200">
            <MdNotificationsNone />
          </span>
          <h2 className="mt-4 text-base font-black text-slate-900 dark:text-white">
            {text.notifications.loadError}
          </h2>
          <button
            type="button"
            onClick={() => void notificationInboxQuery.refetch()}
            className="mt-4 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-700"
          >
            {text.common.retry}
          </button>
        </section>
      );
    }

    if (orderedItems.length === 0 && !hasNextPage && !isFetchingNextPage) {
      return (
        <section className="flex h-full min-h-72 flex-col justify-center">
          <PotatoLoadingCard
            title={text.notifications.emptyTitle}
            description={text.notifications.emptyDescription}
            animation="empty"
            compact
            className="shadow-sm"
          />
        </section>
      );
    }

    return (
      <section className="space-y-3 px-px">
        {orderedItems.map((item) =>
          item.type === "FESTIVAL_SUMMARY" ? (
            <FestivalNotificationItem
              key={item.id}
              item={item}
              isFocused={item.notificationKey === focusedNotificationId}
              openingFestivalId={openingFestivalId}
              onOpenFestival={handleOpenFestival}
            />
          ) : item.type === "ROUTE_ARRIVAL" ? (
            <RouteArrivalNotificationItem
              key={item.id}
              item={item}
              isFocused={item.notificationKey === focusedNotificationId}
            />
          ) : (
            <RouteReviewNotificationItem
              key={item.id}
              item={item}
              isFocused={item.notificationKey === focusedNotificationId}
            />
          )
        )}

        {hasNextPage ? (
          <div ref={loadMoreTriggerRef} className="h-8" aria-hidden="true" />
        ) : null}

        {isFetchingNextPage ? (
          <div
            role="status"
            aria-busy="true"
            className="flex justify-center py-3"
          >
            <span className="size-5 animate-spin rounded-full border-2 border-brand-100 border-t-brand-600 dark:border-brand-400/20 dark:border-t-brand-200" />
          </div>
        ) : null}

        {isFetchNextPageError ? (
          <div className="rounded-lg border border-rose-100 bg-rose-50 p-4 text-center text-sm font-semibold text-rose-700 dark:border-rose-400/30 dark:bg-rose-950/30 dark:text-rose-200">
            <p>{text.notifications.loadError}</p>
            <button
              type="button"
              onClick={() => void fetchNextPage()}
              disabled={isFetchingNextPage}
              className="mt-3 rounded-full bg-rose-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-rose-700 disabled:cursor-wait disabled:opacity-60"
            >
              {text.common.retry}
            </button>
          </div>
        ) : null}
      </section>
    );
  };

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="notification-center-title"
      className={`fixed inset-0 ${UI_LAYER_CLASS.searchOverlay} bg-slate-50 text-slate-900 dark:bg-[#071718] dark:text-slate-100`}
    >
      <div className="flex h-full flex-col">
        <header className="border-b border-slate-200 bg-white/95 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] shadow-sm backdrop-blur dark:border-brand-400/20 dark:bg-[#0b211f]/95">
          <div className="flex items-center gap-2">
            <div className="flex h-12 min-w-0 flex-1 items-center px-2">
              <div className="min-w-0">
                <h1
                  id="notification-center-title"
                  className="truncate text-lg font-black text-slate-900 dark:text-white"
                >
                  {text.notifications.title}
                </h1>
                <p className="mt-0.5 truncate text-xs font-semibold text-slate-500 dark:text-slate-300">
                  {text.notifications.description}
                </p>
              </div>
            </div>
            <button
              type="button"
              aria-label={text.notifications.close}
              onClick={handleClose}
              className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-xl text-slate-500 shadow-[0_8px_18px_rgba(15,23,42,0.06)] transition hover:bg-slate-50 hover:text-slate-700 dark:border-brand-400/25 dark:bg-slate-950/60 dark:text-slate-200 dark:shadow-[0_10px_24px_rgba(0,0,0,0.22)] dark:hover:bg-[#102a27]"
            >
              <IoClose />
            </button>
          </div>
        </header>

        <div
          ref={inboxScrollRef}
          className="scrollbar-hide min-h-0 flex-1 overflow-y-auto bg-slate-50 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 dark:bg-[#071718]"
        >
          {renderInboxContent()}
        </div>
      </div>
    </section>
  );
}

export default NotificationCenterPage;
