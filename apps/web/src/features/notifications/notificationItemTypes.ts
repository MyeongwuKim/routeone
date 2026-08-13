import type {
  FestivalNotificationKind,
  NotificationInboxQuery,
  RouteReviewNotificationKind,
} from "@/generated/graphql";

type NotificationInboxItem =
  NotificationInboxQuery["notificationInbox"]["items"][number];

export type FestivalNotificationInboxItem = NotificationInboxItem & {
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

type RouteStartNotificationInboxItem = NotificationInboxItem & {
  type: "ROUTE_START";
  routeId: string;
  routeTitle: string;
  dayId: string;
  routeDayIndex: number;
  routeStartAt: string;
};

type RouteReviewNotificationInboxItem = NotificationInboxItem & {
  type: "ROUTE_REVIEW";
  routeReviewKind: RouteReviewNotificationKind;
  routeId: string;
  routeTitle: string;
  dayId: string;
  correctionDeadlineAt: string;
};

export type ScheduleNotificationInboxItem =
  | RouteStartNotificationInboxItem
  | RouteArrivalNotificationInboxItem
  | RouteReviewNotificationInboxItem;

export function isFestivalNotificationInboxItem(
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

function isRouteStartNotificationInboxItem(
  item: NotificationInboxItem
): item is RouteStartNotificationInboxItem {
  return (
    item.type === "ROUTE_START" &&
    Boolean(
      item.routeId &&
        item.routeTitle &&
        item.dayId &&
        item.routeDayIndex &&
        item.routeStartAt
    )
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

export function isScheduleNotificationInboxItem(
  item: NotificationInboxItem
): item is ScheduleNotificationInboxItem {
  return (
    isRouteStartNotificationInboxItem(item) ||
    isRouteArrivalNotificationInboxItem(item) ||
    isRouteReviewNotificationInboxItem(item)
  );
}
