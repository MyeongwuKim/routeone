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
  imageUrl?: string | null;
  regionCode?: string | null;
  regionLabelKey?: string | null;
};

export type RouteStartLocationInput = {
  lat: number;
  lng: number;
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
  countryCode?: string | null;
  primaryRegionCode?: string | null;
  primaryRegionLabelKey?: string | null;
  tripDays: number;
  travelStartDate?: Date | null;
  travelEndDate?: Date | null;
  dailyStartMinutes?: number | null;
  scheduleEndMinutes?: number | null;
  startLocation?: RouteStartLocationInput | null;
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
  stops?: CreateRouteStopInput[] | null;
};

export type StartRouteInput = {
  routeId: string;
  startedAt: Date;
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

export type UpdateRouteStopStayMinutesInput = {
  stopId: string;
  stayMinutes: number;
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
