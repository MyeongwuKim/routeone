import type { RouteStopVisitVerificationInput } from "@/generated/graphql";
import type { MyRouteDay, MyRouteStop } from "../types";

export type StayMinutesEditTarget = {
  routeDay: MyRouteDay;
  stop: MyRouteStop;
};

export type VisitCompletionTarget = {
  routeDay: MyRouteDay;
  stop: MyRouteStop;
};

export type ActualStayMinutesTarget = VisitCompletionTarget & {
  verification?: RouteStopVisitVerificationInput | null;
};

export type VisitTimesEditTarget = VisitCompletionTarget;

export type DayStartTimeTarget = {
  routeDay: MyRouteDay;
  mode: "start" | "planned" | "actual";
};

export type VerificationPhotoPreviewTarget = {
  routeDay: MyRouteDay;
  stop: MyRouteStop;
};

export type PhotoPublicationTarget = VerificationPhotoPreviewTarget;

export type EarlyRouteCompletionTarget = ActualStayMinutesTarget & {
  startedAt: string;
};
