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
  UpdateRouteDayStartDocument,
  UpdateRouteLayoutDocument,
  UpdateRouteStartLocationDocument,
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
  type UpdateRouteDayStartInput,
  type UpdateRouteLayoutInput,
  type UpdateRouteStartLocationInput,
} from "@/generated/graphql";
import {
  requestGraphQL,
  type GraphQLRequestOptions,
} from "@/lib/graphqlClient";

type RouteId = string | number;

const ROUTE_SAVE_TIMEOUT_MS = 30_000;
const ROUTE_CREATE_RETRY_DELAY_MS = 1_000;

export const routeApi = {
  myRoutes(
    variables?: MyRoutesQueryVariables,
    options?: GraphQLRequestOptions
  ) {
    return requestGraphQL(MyRoutesDocument, variables, options);
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
    return requestGraphQL(
      CreateRouteDocument,
      { input },
      {
        timeoutMs: ROUTE_SAVE_TIMEOUT_MS,
        maxRetryCount: input.clientRequestId?.trim() ? 1 : 0,
        retryDelayMs: ROUTE_CREATE_RETRY_DELAY_MS,
      }
    );
  },
  appendRouteDays(input: AppendRouteDaysInput) {
    return requestGraphQL(
      AppendRouteDaysDocument,
      { input },
      { timeoutMs: ROUTE_SAVE_TIMEOUT_MS, maxRetryCount: 0 }
    );
  },
  startRoute(input: StartRouteInput) {
    return requestGraphQL(
      StartRouteDocument,
      { input },
      {
        maxRetryCount: 1,
        retryDelayMs: ROUTE_CREATE_RETRY_DELAY_MS,
      }
    );
  },
  updateRouteDayStart(input: UpdateRouteDayStartInput) {
    return requestGraphQL(UpdateRouteDayStartDocument, {
      input,
    });
  },
  updateRouteLayout(input: UpdateRouteLayoutInput) {
    return requestGraphQL(UpdateRouteLayoutDocument, {
      input,
    });
  },
  updateRouteStartLocation(input: UpdateRouteStartLocationInput) {
    return requestGraphQL(UpdateRouteStartLocationDocument, {
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
