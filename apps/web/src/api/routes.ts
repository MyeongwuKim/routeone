import {
  ClearRouteDocument,
  CloneRouteDocument,
  CreateRouteDocument,
  LikeRouteDocument,
  MarkRouteStopVisitedDocument,
  MyRoutesDocument,
  RouteByIdDocument,
  SaveRouteDocument,
  ShareRouteDocument,
  SharedRoutesDocument,
  UnlikeRouteDocument,
  UnsaveRouteDocument,
  type CloneRouteInput,
  type CreateRouteInput,
  type MyRoutesQueryVariables,
  type SharedRoutesQueryVariables,
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
  markRouteStopVisited(stopId: RouteId, visited = true) {
    return requestGraphQL(MarkRouteStopVisitedDocument, {
      stopId,
      visited,
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
