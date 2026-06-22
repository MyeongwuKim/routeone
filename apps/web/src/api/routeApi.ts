import {
  AppendRouteDaysDocument,
  ClearRouteDocument,
  CloneRouteDocument,
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
  UnlikeRouteDocument,
  UnsaveRouteDocument,
  UpdateRouteStopStayMinutesDocument,
  type AppendRouteDaysInput,
  type CloneRouteInput,
  type CreateRouteInput,
  type MyRoutesQueryVariables,
  type ReorderRouteStopsInput,
  type SharedRoutesQueryVariables,
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
  markRouteStopVisited(stopId: RouteId, visited = true) {
    return requestGraphQL(MarkRouteStopVisitedDocument, {
      stopId,
      visited,
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
