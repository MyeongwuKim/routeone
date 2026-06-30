import type {
  Route,
  RouteDay,
  RouteStatus,
  RouteStop,
  RouteStopVerificationStatus,
} from "@prisma/client";
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
  getLikedRoutes,
  getSavedRoutes,
  markRouteStopVisited,
  reorderRouteStops,
  setRouteLike,
  setRouteSave,
  shareRoute,
  startRoute,
  updateRouteStopStayMinutes,
  type CloneRouteInput,
  type AppendRouteDaysInput,
  type CreateRouteInput,
  type ReorderRouteStopsInput,
  type RouteStopVisitVerificationInput,
  type StartRouteInput,
  type UpdateRouteStopStayMinutesInput,
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

  enum RouteStopVerificationStatus {
    NONE
    MANUAL
    GPS
    GPS_PHOTO
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

  type RouteStartLocation {
    lat: Float!
    lng: Float!
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
    dailyStartMinutes: Int
    scheduleEndMinutes: Int
    status: RouteStatus!
    visibility: RouteVisibility!
    totalStopCount: Int!
    completedStopCount: Int!
    likeCount: Int!
    saveCount: Int!
    startedAt: DateTime
    completedAt: DateTime
    sharedAt: DateTime
    shareTags: [String!]!
    isMine: Boolean!
    likedByMe: Boolean!
    startLocation: RouteStartLocation
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
    travelMinutesFromPrevious: Int
    memo: String
    visitStatus: VisitStatus!
    visitedAt: DateTime
    verificationStatus: RouteStopVerificationStatus!
    verifiedAt: DateTime
    verificationPhotoUrl: String
    verificationLat: Float
    verificationLng: Float
    verificationAccuracyMeters: Float
    checkedInAt: DateTime
    checkedOutAt: DateTime
    actualStayMinutes: Int
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

  input RouteStartLocationInput {
    lat: Float!
    lng: Float!
  }

  input CreateRouteStopInput {
    dayIndex: Int
    order: Int
    place: PlaceSnapshotInput!
    stayMinutes: Int
    travelMinutesFromPrevious: Int
    memo: String
  }

  input CreateRouteInput {
    countryCode: String
    primaryRegionCode: String
    primaryRegionLabelKey: String
    tripDays: Int!
    travelStartDate: DateTime
    travelEndDate: DateTime
    dailyStartMinutes: Int
    scheduleEndMinutes: Int
    startLocation: RouteStartLocationInput
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
    dailyStartMinutes: Int
    scheduleEndMinutes: Int
    startLocation: RouteStartLocationInput
    stops: [CreateRouteStopInput!]
  }

  input StartRouteInput {
    routeId: ID!
    startedAt: DateTime!
  }

  input ReorderRouteStopsInput {
    routeId: ID!
    dayId: ID!
    stopIds: [ID!]!
  }

  input UpdateRouteStopStayMinutesInput {
    stopId: ID!
    stayMinutes: Int!
  }

  input RouteStopVisitVerificationInput {
    status: RouteStopVerificationStatus
    lat: Float
    lng: Float
    accuracyMeters: Float
    photoUrl: String
  }

  extend type Query {
    myRoutes(status: RouteStatus): [Route!]!
    savedRoutes: [Route!]!
    likedRoutes: [Route!]!
    sharedRoutes(regionCode: String, limit: Int): [Route!]!
    route(id: ID!): Route
  }

  extend type Mutation {
    createRoute(input: CreateRouteInput!): Route!
    appendRouteDays(input: AppendRouteDaysInput!): Route!
    startRoute(input: StartRouteInput!): Route!
    deleteRoute(routeId: ID!): DeletedRoutePayload!
    deleteRouteDay(dayId: ID!): Route!
    markRouteStopVisited(
      stopId: ID!
      visited: Boolean = true
      verification: RouteStopVisitVerificationInput
    ): Route!
    reorderRouteStops(input: ReorderRouteStopsInput!): Route!
    updateRouteStopStayMinutes(input: UpdateRouteStopStayMinutesInput!): Route!
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

type StartRouteArgs = {
  input: StartRouteInput;
};

type MarkRouteStopVisitedArgs = {
  stopId: string;
  visited?: boolean | null;
  verification?: RouteStopVisitVerificationInput | null;
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

type UpdateRouteStopStayMinutesArgs = {
  input: UpdateRouteStopStayMinutesInput;
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
    likedRoutes(_parent: unknown, _args: unknown, context: GraphQLContext) {
      const user = requireUser(context);
      return getLikedRoutes(context.prisma, user);
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
    startRoute(
      _parent: unknown,
      args: StartRouteArgs,
      context: GraphQLContext
    ) {
      const user = requireUser(context);
      return startRoute(context.prisma, user, args.input);
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
        args.visited ?? true,
        args.verification
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
    updateRouteStopStayMinutes(
      _parent: unknown,
      args: UpdateRouteStopStayMinutesArgs,
      context: GraphQLContext
    ) {
      const user = requireUser(context);
      return updateRouteStopStayMinutes(context.prisma, user, args.input);
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
    isMine(parent: Route, _args: unknown, context: GraphQLContext) {
      return parent.ownerId === context.user.id;
    },
    async likedByMe(parent: Route, _args: unknown, context: GraphQLContext) {
      if (!context.user) {
        return false;
      }

      const like = await context.prisma.routeLike.findUnique({
        where: {
          userId_routeId: {
            userId: context.user.id,
            routeId: parent.id,
          },
        },
      });

      return Boolean(like);
    },
    shareTags(parent: Route) {
      return parent.shareTags ?? [];
    },
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
    verificationStatus(parent: RouteStop) {
      return (parent.verificationStatus ?? "NONE") as RouteStopVerificationStatus;
    },
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
