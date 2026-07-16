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
  verification: RouteStopVisitVerificationInput;
};

export type VerificationPhotoPreviewTarget = {
  routeDay: MyRouteDay;
  stop: MyRouteStop;
};

export type EarlyRouteCompletionTarget = VisitCompletionTarget & {
  startedAt: string;
};
