import type {
  PlaceProvider,
  RouteStopVerificationStatus,
} from "@prisma/client";

export type PlaceSnapshotInput = {
  provider: PlaceProvider;
  externalId?: string | null;
  contentId?: string | null;
  contentTypeId?: string | null;
  title: string;
  address?: string | null;
  lat: number;
  lng: number;
  categoryLabel?: string | null;
  categoryName?: string | null;
  categoryCode1?: string | null;
  categoryCode2?: string | null;
  categoryCode3?: string | null;
  notificationRadiusMeters?: number | null;
  verificationRadiusMeters?: number | null;
  imageUrl?: string | null;
  regionCode?: string | null;
  regionLabelKey?: string | null;
};

export type RouteStartLocationInput = {
  lat: number;
  lng: number;
};

export type RouteDayStartLocationInput = {
  dayIndex: number;
  startLocation: RouteStartLocationInput;
};

export type CreateRouteStopInput = {
  dayIndex?: number | null;
  order?: number | null;
  place: PlaceSnapshotInput;
  stayMinutes?: number | null;
  travelMinutesFromPrevious?: number | null;
  memo?: string | null;
};

export type CreateRouteInput = {
  clientRequestId?: string | null;
  countryCode?: string | null;
  primaryRegionCode?: string | null;
  primaryRegionLabelKey?: string | null;
  tripDays: number;
  travelStartDate?: Date | null;
  travelEndDate?: Date | null;
  dailyStartMinutes?: number | null;
  scheduleEndMinutes?: number | null;
  startLocation?: RouteStartLocationInput | null;
  dayStartLocations?: RouteDayStartLocationInput[] | null;
  stops?: CreateRouteStopInput[] | null;
};

export type AppendRouteDaysInput = {
  routeId: string;
  tripDays: number;
  travelStartDate?: Date | null;
  travelEndDate?: Date | null;
  dailyStartMinutes?: number | null;
  scheduleEndMinutes?: number | null;
  startLocation?: RouteStartLocationInput | null;
  dayStartLocations?: RouteDayStartLocationInput[] | null;
  stops?: CreateRouteStopInput[] | null;
};

export type StartRouteInput = {
  routeId: string;
  startedAt: Date;
  dayStartedAt?: Date | null;
};

export type UpdateRouteDayStartInput = {
  dayId: string;
  plannedStartMinutes?: number | null;
  startedAt?: Date | null;
};

export type UpdateRouteStartLocationInput = {
  routeId: string;
  dayId?: string | null;
  startLocation: RouteStartLocationInput;
};

export type CloneRouteInput = {
  routeId: string;
  startImmediately?: boolean | null;
};

export type ReorderRouteStopsInput = {
  routeId: string;
  dayId: string;
  stopIds: string[];
};

export type RouteLayoutStopInput = {
  stopId: string;
  stayMinutes?: number | null;
};

export type RouteDayLayoutInput = {
  dayId: string;
  stops: RouteLayoutStopInput[];
  startLocation?: RouteStartLocationInput | null;
};

export type UpdateRouteLayoutInput = {
  routeId: string;
  days: RouteDayLayoutInput[];
  deletedDayIds?: string[] | null;
};

export type UpdateRouteStopStayMinutesInput = {
  stopId: string;
  stayMinutes: number;
};

export type UpdateRouteStopVisitTimesInput = {
  stopId: string;
  checkedInAt: Date;
  checkedOutAt?: Date | null;
};

export type PlaceStaySummary = {
  averageActualStayMinutes: number | null;
  visitCount: number;
  lastVisitedAt: Date | null;
};

export type PlacePhotoListOptions = {
  limit?: number | null;
};

export type RouteStopVisitVerificationInput = {
  status?: RouteStopVerificationStatus | null;
  lat?: number | null;
  lng?: number | null;
  accuracyMeters?: number | null;
  photoImageId?: string | null;
  photoUrl?: string | null;
};
