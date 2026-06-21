import type { Route, RouteDay, RouteStatus, RouteStop } from "@prisma/client";
import { gql } from "graphql-tag";
import type { GraphQLContext } from "../../context.js";
import { requireUser } from "../../lib/auth.js";
import {
  appendRouteDays,
  clearRoute,
  cloneRoute,
  createRoute,
  deleteRoute,
  deleteRouteDay,
  getPublicRoutes,
  getSavedRoutes,
  markRouteStopVisited,
  reorderRouteStops,
  setRouteLike,
  setRouteSave,
  shareRoute,
  type CloneRouteInput,
  type AppendRouteDaysInput,
  type CreateRouteInput,
  type ReorderRouteStopsInput,
} from "./route.service.js";

export const routeTypeDefs = gql`
  enum RouteStatus {
    DRAFT
    ACTIVE
    COMPLETED
  }

  enum RouteVisibility {
    PRIVATE
    PUBLIC
  }

  enum VisitStatus {
    PENDING
    VISITED
    SKIPPED
  }

  enum PlaceProvider {
    TOUR_API
    NAVER
    CUSTOM
  }

  type PlaceSnapshot {
    provider: PlaceProvider!
    externalId: String
    contentId: String
    contentTypeId: String
    title: String!
    address: String
    lat: Float!
    lng: Float!
    categoryLabel: String
    categoryName: String
    imageUrl: String
    regionCode: String
    regionLabelKey: String
  }

  type Route {
    id: ID!
    owner: User!
    sourceRouteId: ID
    countryCode: String!
    primaryRegionCode: String
    primaryRegionLabelKey: String
    tripDays: Int!
    travelStartDate: DateTime
    travelEndDate: DateTime
    status: RouteStatus!
    visibility: RouteVisibility!
    totalStopCount: Int!
    completedStopCount: Int!
    likeCount: Int!
    saveCount: Int!
    startedAt: DateTime
    completedAt: DateTime
    sharedAt: DateTime
    days: [RouteDay!]!
    stops: [RouteStop!]!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type RouteDay {
    id: ID!
    routeId: ID!
    dayIndex: Int!
    date: DateTime
    stops: [RouteStop!]!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type RouteStop {
    id: ID!
    routeId: ID!
    dayId: ID
    day: RouteDay
    order: Int!
    place: PlaceSnapshot!
    stayMinutes: Int
    memo: String
    visitStatus: VisitStatus!
    visitedAt: DateTime
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type RouteInteractionPayload {
    route: Route!
    liked: Boolean!
    saved: Boolean!
  }

  type DeletedRoutePayload {
    id: ID!
  }

  input PlaceSnapshotInput {
    provider: PlaceProvider!
    externalId: String
    contentId: String
    contentTypeId: String
    title: String!
    address: String
    lat: Float!
    lng: Float!
    categoryLabel: String
    categoryName: String
    imageUrl: String
    regionCode: String
    regionLabelKey: String
  }

  input CreateRouteStopInput {
    dayIndex: Int
    order: Int
    place: PlaceSnapshotInput!
    stayMinutes: Int
    memo: String
  }

  input CreateRouteInput {
    countryCode: String
    primaryRegionCode: String
    primaryRegionLabelKey: String
    tripDays: Int!
    travelStartDate: DateTime
    travelEndDate: DateTime
    stops: [CreateRouteStopInput!]
  }

  input CloneRouteInput {
    routeId: ID!
    startImmediately: Boolean
  }

  input AppendRouteDaysInput {
    routeId: ID!
    tripDays: Int!
    travelStartDate: DateTime
    travelEndDate: DateTime
    stops: [CreateRouteStopInput!]
  }

  input ReorderRouteStopsInput {
    routeId: ID!
    dayId: ID!
    stopIds: [ID!]!
  }

  extend type Query {
    myRoutes(status: RouteStatus): [Route!]!
    savedRoutes: [Route!]!
    sharedRoutes(regionCode: String, limit: Int): [Route!]!
    route(id: ID!): Route
  }

  extend type Mutation {
    createRoute(input: CreateRouteInput!): Route!
    appendRouteDays(input: AppendRouteDaysInput!): Route!
    deleteRoute(routeId: ID!): DeletedRoutePayload!
    deleteRouteDay(dayId: ID!): Route!
    markRouteStopVisited(stopId: ID!, visited: Boolean = true): Route!
    reorderRouteStops(input: ReorderRouteStopsInput!): Route!
    clearRoute(routeId: ID!): Route!
    shareRoute(routeId: ID!): Route!
    likeRoute(routeId: ID!): RouteInteractionPayload!
    unlikeRoute(routeId: ID!): RouteInteractionPayload!
    saveRoute(routeId: ID!): RouteInteractionPayload!
    unsaveRoute(routeId: ID!): RouteInteractionPayload!
    cloneRoute(input: CloneRouteInput!): Route!
  }
`;

type IdArgs = {
  id: string;
};

type MyRoutesArgs = {
  status?: RouteStatus | null;
};

type SharedRoutesArgs = {
  regionCode?: string | null;
  limit?: number | null;
};

type CreateRouteArgs = {
  input: CreateRouteInput;
};

type AppendRouteDaysArgs = {
  input: AppendRouteDaysInput;
};

type MarkRouteStopVisitedArgs = {
  stopId: string;
  visited?: boolean | null;
};

type RouteIdArgs = {
  routeId: string;
};

type DayIdArgs = {
  dayId: string;
};

type CloneRouteArgs = {
  input: CloneRouteInput;
};

type ReorderRouteStopsArgs = {
  input: ReorderRouteStopsInput;
};

export const routeResolvers = {
  Query: {
    myRoutes(
      _parent: unknown,
      args: MyRoutesArgs,
      context: GraphQLContext
    ) {
      const user = requireUser(context);

      return context.prisma.route.findMany({
        where: {
          ownerId: user.id,
          ...(args.status
            ? {
                status: args.status,
              }
            : {}),
        },
        orderBy: {
          updatedAt: "desc",
        },
      });
    },
    savedRoutes(_parent: unknown, _args: unknown, context: GraphQLContext) {
      const user = requireUser(context);
      return getSavedRoutes(context.prisma, user);
    },
    sharedRoutes(
      _parent: unknown,
      args: SharedRoutesArgs,
      context: GraphQLContext
    ) {
      return getPublicRoutes(context.prisma, {
        regionCode: args.regionCode,
        limit: args.limit,
      });
    },
    async route(_parent: unknown, args: IdArgs, context: GraphQLContext) {
      const route = await context.prisma.route.findUnique({
        where: {
          id: args.id,
        },
      });

      if (!route) {
        return null;
      }

      if (route.visibility === "PUBLIC") {
        return route;
      }

      return context.user?.id === route.ownerId ? route : null;
    },
  },
  Mutation: {
    createRoute(
      _parent: unknown,
      args: CreateRouteArgs,
      context: GraphQLContext
    ) {
      const user = requireUser(context);
      return createRoute(context.prisma, user, args.input);
    },
    appendRouteDays(
      _parent: unknown,
      args: AppendRouteDaysArgs,
      context: GraphQLContext
    ) {
      const user = requireUser(context);
      return appendRouteDays(context.prisma, user, args.input);
    },
    deleteRoute(_parent: unknown, args: RouteIdArgs, context: GraphQLContext) {
      const user = requireUser(context);
      return deleteRoute(context.prisma, user, args.routeId);
    },
    deleteRouteDay(_parent: unknown, args: DayIdArgs, context: GraphQLContext) {
      const user = requireUser(context);
      return deleteRouteDay(context.prisma, user, args.dayId);
    },
    markRouteStopVisited(
      _parent: unknown,
      args: MarkRouteStopVisitedArgs,
      context: GraphQLContext
    ) {
      const user = requireUser(context);
      return markRouteStopVisited(
        context.prisma,
        user,
        args.stopId,
        args.visited ?? true
      );
    },
    reorderRouteStops(
      _parent: unknown,
      args: ReorderRouteStopsArgs,
      context: GraphQLContext
    ) {
      const user = requireUser(context);
      return reorderRouteStops(context.prisma, user, args.input);
    },
    clearRoute(_parent: unknown, args: RouteIdArgs, context: GraphQLContext) {
      const user = requireUser(context);
      return clearRoute(context.prisma, user, args.routeId);
    },
    shareRoute(_parent: unknown, args: RouteIdArgs, context: GraphQLContext) {
      const user = requireUser(context);
      return shareRoute(context.prisma, user, args.routeId);
    },
    likeRoute(_parent: unknown, args: RouteIdArgs, context: GraphQLContext) {
      const user = requireUser(context);
      return setRouteLike(context.prisma, user, args.routeId, true);
    },
    unlikeRoute(_parent: unknown, args: RouteIdArgs, context: GraphQLContext) {
      const user = requireUser(context);
      return setRouteLike(context.prisma, user, args.routeId, false);
    },
    saveRoute(_parent: unknown, args: RouteIdArgs, context: GraphQLContext) {
      const user = requireUser(context);
      return setRouteSave(context.prisma, user, args.routeId, true);
    },
    unsaveRoute(_parent: unknown, args: RouteIdArgs, context: GraphQLContext) {
      const user = requireUser(context);
      return setRouteSave(context.prisma, user, args.routeId, false);
    },
    cloneRoute(
      _parent: unknown,
      args: CloneRouteArgs,
      context: GraphQLContext
    ) {
      const user = requireUser(context);
      return cloneRoute(context.prisma, user, args.input);
    },
  },
  Route: {
    owner(parent: Route, _args: unknown, context: GraphQLContext) {
      return context.prisma.user.findUnique({
        where: {
          id: parent.ownerId,
        },
      });
    },
    days(parent: Route, _args: unknown, context: GraphQLContext) {
      return context.prisma.routeDay.findMany({
        where: {
          routeId: parent.id,
        },
        orderBy: {
          dayIndex: "asc",
        },
      });
    },
    stops(parent: Route, _args: unknown, context: GraphQLContext) {
      return context.prisma.routeStop.findMany({
        where: {
          routeId: parent.id,
        },
        orderBy: {
          order: "asc",
        },
      });
    },
  },
  RouteDay: {
    stops(parent: RouteDay, _args: unknown, context: GraphQLContext) {
      return context.prisma.routeStop.findMany({
        where: {
          dayId: parent.id,
        },
        orderBy: {
          order: "asc",
        },
      });
    },
  },
  RouteStop: {
    day(parent: RouteStop, _args: unknown, context: GraphQLContext) {
      if (!parent.dayId) {
        return null;
      }

      return context.prisma.routeDay.findUnique({
        where: {
          id: parent.dayId,
        },
      });
    },
  },
};
