import {
  MdAccessTime,
  MdChevronRight,
  MdLocationOn,
  MdOutlineRoute,
} from "react-icons/md";
import { useNavigate } from "react-router-dom";
import type { ScheduleNotificationInboxItem } from "@/features/notifications/notificationItemTypes";
import { useUiText } from "@/lib/uiText";
import {
  useAppLanguageStore,
  type AppLanguage,
} from "@/stores/appLanguageStore";

function formatEnglishRouteDate(dateLabel: string) {
  const [month, day] = dateLabel.split(".").map(Number);

  if (
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return dateLabel;
  }

  return new Date(Date.UTC(2000, month - 1, day)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function localizeGeneratedRouteTitle(
  routeTitle: string,
  language: AppLanguage
) {
  if (language !== "en") {
    return routeTitle;
  }

  if (routeTitle === "날짜 미정 일정") {
    return "Unscheduled trip";
  }

  const match = routeTitle.match(
    /^(\d{1,2}\.\d{1,2})(?:\s*~\s*(\d{1,2}\.\d{1,2}))?\s+일정$/
  );

  if (!match) {
    return routeTitle;
  }

  const startDate = formatEnglishRouteDate(match[1]);
  const endDate = match[2] ? formatEnglishRouteDate(match[2]) : null;
  const dateRange =
    endDate && endDate !== startDate
      ? `${startDate} – ${endDate}`
      : startDate;

  return `${dateRange} trip`;
}

function ScheduleNotificationItem({
  item,
  isFocused,
}: {
  item: ScheduleNotificationInboxItem;
  isFocused: boolean;
}) {
  const text = useUiText();
  const navigate = useNavigate();
  const appLanguage = useAppLanguageStore((state) => state.language);
  const isArrival = item.type === "ROUTE_ARRIVAL";
  const isRouteStart = item.type === "ROUTE_START";
  const routeTitle = localizeGeneratedRouteTitle(
    item.routeTitle?.trim() || "",
    appLanguage
  );
  const routeLabel = isArrival
    ? routeTitle || item.placeTitle
    : routeTitle;
  const title = isArrival
    ? text.notifications.arrivalTitle(item.placeTitle)
    : isRouteStart
      ? text.notifications.routeStartTitle(
          item.routeDayIndex
        )
      : item.routeReviewKind === "COMPLETED"
      ? text.notifications.routeReviewCompletedTitle(routeTitle)
      : item.routeReviewKind === "UNSTARTED"
        ? text.notifications.routeReviewUnstartedTitle(routeTitle)
        : text.notifications.routeReviewIncompleteTitle(routeTitle);
  const description = isArrival
    ? text.notifications.arrivalDescription
    : isRouteStart
      ? text.notifications.routeStartDescription
      : item.routeReviewKind === "COMPLETED"
      ? text.notifications.routeReviewCompletedDescription(
          item.correctionDeadlineAt
        )
      : text.notifications.routeReviewDescription(item.correctionDeadlineAt);
  const destination = isArrival || isRouteStart
    ? `/my-route?${new URLSearchParams({
        routeId: item.routeId,
        dayId: item.dayId,
        ...(isArrival ? { stopId: item.stopId } : {}),
        source: "notification-inbox",
      }).toString()}`
    : `/me/routes?${new URLSearchParams({
        routeId: item.routeId,
        dayId: item.dayId,
        source: "notification-inbox",
      }).toString()}`;

  return (
    <button
      id={`notification-${item.notificationKey}`}
      type="button"
      aria-label={text.notifications.openRouteAria(routeLabel)}
      onClick={() => navigate(destination)}
      className={`flex w-full items-start gap-3 rounded-lg border bg-white px-4 py-4 text-left shadow-sm transition hover:bg-brand-50/60 dark:bg-[#071f1d] dark:hover:bg-brand-400/10 ${
        isFocused
          ? "border-brand-500 ring-2 ring-brand-200 dark:border-brand-300 dark:ring-brand-400/25"
          : "border-brand-100 dark:border-brand-400/25"
      }`}
    >
      <span
        className={`flex size-10 shrink-0 items-center justify-center rounded-lg text-xl ${
          isArrival
            ? "bg-sky-50 text-sky-600 dark:bg-sky-400/15 dark:text-sky-200"
            : isRouteStart
              ? "bg-brand-50 text-brand-700 dark:bg-brand-400/15 dark:text-brand-200"
            : "bg-amber-50 text-amber-600 dark:bg-amber-400/15 dark:text-amber-200"
        }`}
      >
        {isArrival ? (
          <MdLocationOn />
        ) : isRouteStart ? (
          <MdAccessTime />
        ) : (
          <MdOutlineRoute />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-bold text-slate-400 dark:text-slate-300">
          {text.notifications.formatTimestamp(
            isRouteStart ? item.routeStartAt : item.availableAt
          )}
        </span>
        <span className="mt-1 block text-sm font-black text-slate-900 dark:text-white">
          {title}
        </span>
        <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500 dark:text-slate-300">
          {description}
        </span>
      </span>
      <MdChevronRight className="mt-4 shrink-0 text-xl text-slate-300 dark:text-slate-500" />
    </button>
  );
}

export default ScheduleNotificationItem;
