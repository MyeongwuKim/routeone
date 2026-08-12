import {
  AppendRouteDaysDocument,
  CheckInRouteStopDocument,
  ClearRouteDocument,
  CloneRouteDocument,
  CompleteRouteStopVisitDocument,
  CreateRouteStopVisitPhotoUploadDocument,
  CreateRouteDocument,
  DeleteRouteDayDocument,
  DeleteRouteDocument,
  DeleteRouteStopVisitPhotoDocument,
  LikedSharedRoutesDocument,
  LikedSharedRouteConnectionDocument,
  LikeRouteDocument,
  MarkRouteStopVisitedDocument,
  MyRouteHistoryConnectionDocument,
  MyRoutesDocument,
  PlacePhotosDocument,
  PlaceStaySummariesDocument,
  PlaceStaySummaryDocument,
  PosterImageDataUrlDocument,
  ReorderRouteStopsDocument,
  RouteByIdDocument,
  SaveRouteDocument,
  SetRouteStopPhotoPublicationDocument,
  SetRouteStopVisitPhotoDocument,
  ShareRouteDocument,
  SharedRoutesDocument,
  SharedRouteConnectionDocument,
  StartRouteDocument,
  UnlikeRouteDocument,
  UnsaveRouteDocument,
  UpdateRouteStopStayMinutesDocument,
  UpdateRouteStopVisitTimesDocument,
  type AppendRouteDaysInput,
  type CloneRouteInput,
  type CreateRouteInput,
  type MyRouteHistoryConnectionQueryVariables,
  type MyRoutesQueryVariables,
  type PlaceSnapshotInput,
  type ReorderRouteStopsInput,
  type RouteStopVisitVerificationInput,
  type SharedRoutesQueryVariables,
  type StartRouteInput,
  type UpdateRouteStopStayMinutesInput,
  type UpdateRouteStopVisitTimesInput,
} from "@/generated/graphql";
import { requestGraphQL } from "@/lib/graphqlClient";

type RouteId = string | number;

export const routeApi = {
  myRoutes(variables?: MyRoutesQueryVariables) {
    return requestGraphQL(MyRoutesDocument, variables);
  },
  myRouteHistoryConnection(
    variables?: MyRouteHistoryConnectionQueryVariables
  ) {
    return requestGraphQL(MyRouteHistoryConnectionDocument, variables);
  },
  sharedRoutes(variables?: SharedRoutesQueryVariables) {
    return requestGraphQL(SharedRoutesDocument, variables);
  },
  sharedRouteConnection(variables?: {
    regionCode?: string | null;
    regionTag?: string | null;
    limit?: number | null;
    cursor?: string | null;
  }) {
    return requestGraphQL(SharedRouteConnectionDocument, variables);
  },
  likedSharedRoutes() {
    return requestGraphQL(LikedSharedRoutesDocument);
  },
  likedSharedRouteConnection(variables?: {
    regionTag?: string | null;
    limit?: number | null;
    cursor?: string | null;
  }) {
    return requestGraphQL(LikedSharedRouteConnectionDocument, variables);
  },
  routeById(id: RouteId) {
    return requestGraphQL(RouteByIdDocument, {
      id,
    });
  },
  placeStaySummary(place: PlaceSnapshotInput) {
    return requestGraphQL(PlaceStaySummaryDocument, {
      place,
    });
  },
  placeStaySummaries(places: PlaceSnapshotInput[]) {
    return requestGraphQL(PlaceStaySummariesDocument, {
      places,
    });
  },
  placePhotos(place: PlaceSnapshotInput, limit?: number | null) {
    return requestGraphQL(PlacePhotosDocument, {
      place,
      limit,
    });
  },
  posterImageDataUrl(url: string) {
    return requestGraphQL(PosterImageDataUrlDocument, {
      url,
    });
  },
  createRoute(input: CreateRouteInput) {
    return requestGraphQL(CreateRouteDocument, {
      input,
    });
  },
  appendRouteDays(input: AppendRouteDaysInput) {
    return requestGraphQL(AppendRouteDaysDocument, {
      input,
    });
  },
  startRoute(input: StartRouteInput) {
    return requestGraphQL(StartRouteDocument, {
      input,
    });
  },
  deleteRoute(routeId: RouteId) {
    return requestGraphQL(DeleteRouteDocument, {
      routeId,
    });
  },
  deleteRouteDay(dayId: RouteId) {
    return requestGraphQL(DeleteRouteDayDocument, {
      dayId,
    });
  },
  createRouteStopVisitPhotoUpload(stopId: RouteId) {
    return requestGraphQL(CreateRouteStopVisitPhotoUploadDocument, {
      stopId,
    });
  },
  markRouteStopVisited(
    stopId: RouteId,
    visited = true,
    verification?: RouteStopVisitVerificationInput | null,
    actualStayMinutes?: number | null
  ) {
    return requestGraphQL(MarkRouteStopVisitedDocument, {
      stopId,
      visited,
      verification,
      actualStayMinutes,
    });
  },
  checkInRouteStop(
    stopId: RouteId,
    verification: RouteStopVisitVerificationInput
  ) {
    return requestGraphQL(CheckInRouteStopDocument, {
      stopId,
      verification,
    });
  },
  completeRouteStopVisit(
    stopId: RouteId,
    actualStayMinutes?: number | null
  ) {
    return requestGraphQL(CompleteRouteStopVisitDocument, {
      stopId,
      actualStayMinutes,
    });
  },
  setRouteStopPhotoPublication(stopId: RouteId, published: boolean) {
    return requestGraphQL(SetRouteStopPhotoPublicationDocument, {
      stopId,
      published,
    });
  },
  setRouteStopVisitPhoto(
    stopId: RouteId,
    imageId: string,
    imageUrl: string
  ) {
    return requestGraphQL(SetRouteStopVisitPhotoDocument, {
      stopId,
      imageId,
      imageUrl,
    });
  },
  deleteRouteStopVisitPhoto(stopId: RouteId) {
    return requestGraphQL(DeleteRouteStopVisitPhotoDocument, {
      stopId,
    });
  },
  reorderRouteStops(input: ReorderRouteStopsInput) {
    return requestGraphQL(ReorderRouteStopsDocument, {
      input,
    });
  },
  updateRouteStopStayMinutes(input: UpdateRouteStopStayMinutesInput) {
    return requestGraphQL(UpdateRouteStopStayMinutesDocument, {
      input,
    });
  },
  updateRouteStopVisitTimes(input: UpdateRouteStopVisitTimesInput) {
    return requestGraphQL(UpdateRouteStopVisitTimesDocument, {
      input,
    });
  },
  clearRoute(routeId: RouteId) {
    return requestGraphQL(ClearRouteDocument, {
      routeId,
    });
  },
  shareRoute(routeId: RouteId) {
    return requestGraphQL(ShareRouteDocument, {
      routeId,
    });
  },
  likeRoute(routeId: RouteId) {
    return requestGraphQL(LikeRouteDocument, {
      routeId,
    });
  },
  unlikeRoute(routeId: RouteId) {
    return requestGraphQL(UnlikeRouteDocument, {
      routeId,
    });
  },
  saveRoute(routeId: RouteId) {
    return requestGraphQL(SaveRouteDocument, {
      routeId,
    });
  },
  unsaveRoute(routeId: RouteId) {
    return requestGraphQL(UnsaveRouteDocument, {
      routeId,
    });
  },
  cloneRoute(input: CloneRouteInput) {
    return requestGraphQL(CloneRouteDocument, {
      input,
    });
  },
};
