import { useEffect, useMemo, useRef } from "react";
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
import { MdNotificationsNone } from "react-icons/md";
import {
  notificationApi,
  NOTIFICATION_INBOX_FIRST_PAGE_QUERY_KEY,
  NOTIFICATION_INBOX_INFINITE_QUERY_KEY,
  NOTIFICATION_INBOX_PAGE_SIZE,
  type NotificationInboxPageParam,
} from "@/api/notificationApi";
import { PotatoLoadingCard } from "@/components/feedback/PotatoLoadingOverlay";
import FestivalNotificationItem from "@/features/notifications/components/FestivalNotificationItem";
import ScheduleNotificationItem from "@/features/notifications/components/ScheduleNotificationItem";
import {
  isFestivalNotificationInboxItem,
  type FestivalNotificationInboxItem,
  isScheduleNotificationInboxItem,
  type ScheduleNotificationInboxItem,
} from "@/features/notifications/notificationItemTypes";
import type { NotificationInboxQuery } from "@/generated/graphql";
import { UI_LAYER_CLASS } from "@/lib/uiLayers";
import { useUiText } from "@/lib/uiText";

type NotificationInboxItem =
  NotificationInboxQuery["notificationInbox"]["items"][number];
type NotificationInboxInfiniteData = InfiniteData<
  NotificationInboxQuery,
  NotificationInboxPageParam
>;
type SupportedNotificationInboxItem =
  | FestivalNotificationInboxItem
  | ScheduleNotificationInboxItem;

function isSupportedNotificationInboxItem(
  item: NotificationInboxItem
): item is SupportedNotificationInboxItem {
  return (
    isFestivalNotificationInboxItem(item) ||
    isScheduleNotificationInboxItem(item)
  );
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

function NotificationCenterPage() {
  const text = useUiText();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const focusedNotificationId =
    searchParams.get("notificationId")?.trim() ?? "";
  const isMarkAllPendingRef = useRef(false);
  const focusedNotificationScrolledRef = useRef<string | null>(null);
  const inboxScrollRef = useRef<HTMLDivElement>(null);
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null);
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
            />
          ) : (
            <ScheduleNotificationItem
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
      className={`full-page-popup-enter fixed inset-0 ${UI_LAYER_CLASS.searchOverlay} bg-slate-50 text-slate-900 dark:bg-[#071718] dark:text-slate-100`}
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
