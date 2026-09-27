/**
 * 하루 경로 화면의 체류 시간·방문 시간·사진 공개 여부 등 편집 다이얼로그가 보관할 대상을 정의한다.
 */
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
