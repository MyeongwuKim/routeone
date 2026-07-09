import {
  AppendRouteDaysDocument,
  ClearRouteDocument,
  CloneRouteDocument,
  CreateRouteStopVisitPhotoUploadDocument,
  CreateRouteDocument,
  DeleteRouteDayDocument,
  DeleteRouteDocument,
  LikedSharedRoutesDocument,
  LikeRouteDocument,
  MarkRouteStopVisitedDocument,
  MyRoutesDocument,
  PlacePhotosDocument,
  PlaceStaySummariesDocument,
  PlaceStaySummaryDocument,
  ReorderRouteStopsDocument,
  RouteByIdDocument,
  SaveRouteDocument,
  ShareRouteDocument,
  SharedRoutesDocument,
  StartRouteDocument,
  UnlikeRouteDocument,
  UnsaveRouteDocument,
  UpdateRouteStopStayMinutesDocument,
  type AppendRouteDaysInput,
  type CloneRouteInput,
  type CreateRouteInput,
  type MyRoutesQueryVariables,
  type PlaceSnapshotInput,
  type ReorderRouteStopsInput,
  type RouteStopVisitVerificationInput,
  type SharedRoutesQueryVariables,
  type StartRouteInput,
  type UpdateRouteStopStayMinutesInput,
} from "@/generated/graphql";
import { requestGraphQL } from "@/lib/graphqlClient";

type RouteId = string | number;

export const routeApi = {
  myRoutes(variables?: MyRoutesQueryVariables) {
    return requestGraphQL(MyRoutesDocument, variables);
  },
  sharedRoutes(variables?: SharedRoutesQueryVariables) {
    return requestGraphQL(SharedRoutesDocument, variables);
  },
  likedSharedRoutes() {
    return requestGraphQL(LikedSharedRoutesDocument);
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
