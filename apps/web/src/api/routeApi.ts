import {
  AnalyzeRouteStopVisitPhotoDocument,
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
  ReorderRouteStopsDocument,
  RouteByIdDocument,
  SaveRouteDocument,
  ShareRouteDocument,
  SharedRoutesDocument,
  StartRouteDocument,
  UnlikeRouteDocument,
  UnsaveRouteDocument,
  UpdateRouteStopStayMinutesDocument,
  type AnalyzeRouteStopVisitPhotoInput,
  type AppendRouteDaysInput,
  type CloneRouteInput,
  type CreateRouteInput,
  type MyRoutesQueryVariables,
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
  analyzeRouteStopVisitPhoto(input: AnalyzeRouteStopVisitPhotoInput) {
    return requestGraphQL(AnalyzeRouteStopVisitPhotoDocument, {
      input,
    });
  },
  markRouteStopVisited(
    stopId: RouteId,
    visited = true,
    verification?: RouteStopVisitVerificationInput | null
  ) {
    return requestGraphQL(MarkRouteStopVisitedDocument, {
      stopId,
      visited,
      verification,
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
