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
  checkInRouteStop,
  clearRoute,
  cloneRoute,
  completeRouteStopVisit,
  createRoute,
  deleteRoute,
  deleteRouteDay,
  deleteRouteStopVisitPhoto,
  fetchPosterImageDataUrl,
  getPublicRoutes,
  getPublicRouteConnection,
  getLikedRouteConnection,
  getLikedRoutes,
  getMyRouteHistoryConnection,
  getSavedRoutes,
  getPlacePhotos,
  getPlaceStaySummary,
  getPlaceStaySummaries,
  markRouteStopVisited,
  reorderRouteStops,
  setRouteStopPhotoPublication,
  setRouteStopVisitPhoto,
  setRouteLike,
  setRouteSave,
  shareRoute,
  startRoute,
  updateRouteDayStart,
  updateRouteStartLocation,
  updateRouteStopStayMinutes,
  updateRouteStopVisitTimes,
  type CloneRouteInput,
  type AppendRouteDaysInput,
  type CreateRouteInput,
  type PlaceSnapshotInput,
  type ReorderRouteStopsInput,
  type RouteStopVisitVerificationInput,
  type StartRouteInput,
  type UpdateRouteDayStartInput,
  type UpdateRouteStartLocationInput,
  type UpdateRouteStopStayMinutesInput,
  type UpdateRouteStopVisitTimesInput,
} from "./route.service.js";
import { ensureDevHistoryRoutes } from "./devHistorySeed.js";

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

  enum PlacePhotoSource {
    VISIT_PHOTO
  }

  enum PlacePhotoStatus {
    ACTIVE
    HIDDEN
    DELETED
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
    plannedStartMinutes: Int
    startedAt: DateTime
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
    verificationPhotoImageId: String
    verificationPhotoUrl: String
    verificationPhotoPublicationConsent: Boolean
    verificationPhotoPublishedAt: DateTime
    verificationLat: Float
    verificationLng: Float
    verificationAccuracyMeters: Float
    checkedInAt: DateTime
    checkedOutAt: DateTime
    actualStayMinutes: Int
    visitTimeEditedAt: DateTime
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type RouteInteractionPayload {
    route: Route!
    liked: Boolean!
    saved: Boolean!
  }

  type RouteConnectionPageInfo {
    endCursor: String
    hasNextPage: Boolean!
  }

  type RouteConnection {
    nodes: [Route!]!
    pageInfo: RouteConnectionPageInfo!
  }

  type PlaceStaySummary {
    averageActualStayMinutes: Int
    visitCount: Int!
    lastVisitedAt: DateTime
  }

  type PlacePhoto {
    id: ID!
    placeKey: String!
    placeKeys: [String!]!
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
    placeImageUrl: String
    regionCode: String
    regionLabelKey: String
    imageId: String
    imageUrl: String!
    thumbnailUrl: String
    variant: String
    source: PlacePhotoSource!
    status: PlacePhotoStatus!
    verifiedAt: DateTime
    createdAt: DateTime!
    updatedAt: DateTime!
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
    clientRequestId: String
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
    dayStartedAt: DateTime
  }

  input UpdateRouteDayStartInput {
    dayId: ID!
    plannedStartMinutes: Int
    startedAt: DateTime
  }

  input UpdateRouteStartLocationInput {
    routeId: ID!
    startLocation: RouteStartLocationInput!
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

  input UpdateRouteStopVisitTimesInput {
    stopId: ID!
    checkedInAt: DateTime!
    checkedOutAt: DateTime
  }

  input RouteStopVisitVerificationInput {
    status: RouteStopVerificationStatus
    lat: Float
    lng: Float
    accuracyMeters: Float
    photoImageId: String
    photoUrl: String
  }

  extend type Query {
    myRoutes(status: RouteStatus): [Route!]!
    myRouteHistoryConnection(
      limit: Int
      cursor: String
      today: DateTime
    ): RouteConnection!
    savedRoutes: [Route!]!
    likedRoutes: [Route!]!
    likedRouteConnection(
      regionTag: String
      limit: Int
      cursor: String
    ): RouteConnection!
    sharedRoutes(
      regionCode: String
      regionTag: String
      limit: Int
    ): [Route!]!
    sharedRouteConnection(
      regionCode: String
      regionTag: String
      limit: Int
      cursor: String
    ): RouteConnection!
    route(id: ID!): Route
    placeStaySummary(place: PlaceSnapshotInput!): PlaceStaySummary!
    placeStaySummaries(places: [PlaceSnapshotInput!]!): [PlaceStaySummary!]!
    placePhotos(place: PlaceSnapshotInput!, limit: Int): [PlacePhoto!]!
    posterImageDataUrl(url: String!): String
  }

  extend type Mutation {
    createRoute(input: CreateRouteInput!): Route!
    appendRouteDays(input: AppendRouteDaysInput!): Route!
    startRoute(input: StartRouteInput!): Route!
    updateRouteDayStart(input: UpdateRouteDayStartInput!): Route!
    updateRouteStartLocation(input: UpdateRouteStartLocationInput!): Route!
    deleteRoute(routeId: ID!): DeletedRoutePayload!
    deleteRouteDay(dayId: ID!): Route!
    markRouteStopVisited(
      stopId: ID!
      visited: Boolean = true
      verification: RouteStopVisitVerificationInput
      actualStayMinutes: Int
    ): Route!
    checkInRouteStop(
      stopId: ID!
      verification: RouteStopVisitVerificationInput!
    ): Route!
    completeRouteStopVisit(stopId: ID!, actualStayMinutes: Int): Route!
    setRouteStopPhotoPublication(stopId: ID!, published: Boolean!): Route!
    setRouteStopVisitPhoto(
      stopId: ID!
      imageId: String!
      imageUrl: String!
    ): Route!
    deleteRouteStopVisitPhoto(stopId: ID!): Route!
    reorderRouteStops(input: ReorderRouteStopsInput!): Route!
    updateRouteStopStayMinutes(input: UpdateRouteStopStayMinutesInput!): Route!
    updateRouteStopVisitTimes(input: UpdateRouteStopVisitTimesInput!): Route!
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
  regionTag?: string | null;
  limit?: number | null;
};

type RouteConnectionArgs = {
  regionCode?: string | null;
  regionTag?: string | null;
  limit?: number | null;
  cursor?: string | null;
  today?: Date | null;
};

type PlaceStaySummaryArgs = {
  place: PlaceSnapshotInput;
};

type PlaceStaySummariesArgs = {
  places: PlaceSnapshotInput[];
};

type PlacePhotosArgs = {
  place: PlaceSnapshotInput;
  limit?: number | null;
};

type PosterImageDataUrlArgs = {
  url: string;
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

type UpdateRouteDayStartArgs = {
  input: UpdateRouteDayStartInput;
};

type UpdateRouteStartLocationArgs = {
  input: UpdateRouteStartLocationInput;
};

type MarkRouteStopVisitedArgs = {
  stopId: string;
  visited?: boolean | null;
  verification?: RouteStopVisitVerificationInput | null;
  actualStayMinutes?: number | null;
};

type CheckInRouteStopArgs = {
  stopId: string;
  verification: RouteStopVisitVerificationInput;
};

type CompleteRouteStopVisitArgs = {
  stopId: string;
  actualStayMinutes?: number | null;
};

type SetRouteStopPhotoPublicationArgs = {
  stopId: string;
  published: boolean;
};

type SetRouteStopVisitPhotoArgs = {
  stopId: string;
  imageId: string;
  imageUrl: string;
};

type DeleteRouteStopVisitPhotoArgs = {
  stopId: string;
};

type UpdateRouteStopVisitTimesArgs = {
  input: UpdateRouteStopVisitTimesInput;
};

function sanitizeRouteStopPhotoForViewer(
  stop: RouteStop,
  route: Pick<Route, "ownerId" | "visibility">,
  viewerId: string | null
) {
  const isOwner = route.ownerId === viewerId;
  const isPhotoPublic =
    stop.verificationPhotoPublicationConsent === true ||
    (stop.verificationPhotoPublicationConsent == null &&
      route.visibility === "PUBLIC");

  if (isOwner || isPhotoPublic || !stop.verificationPhotoUrl) {
    return stop;
  }

  return {
    ...stop,
    verificationStatus:
      stop.verificationStatus === "GPS_PHOTO"
        ? ("GPS" as RouteStopVerificationStatus)
        : stop.verificationStatus,
    verificationPhotoImageId: null,
    verificationPhotoUrl: null,
    verificationPhotoPublicationConsent: null,
    verificationPhotoPublishedAt: null,
  };
}

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
    async myRoutes(
      _parent: unknown,
      args: MyRoutesArgs,
      context: GraphQLContext
    ) {
      const user = requireUser(context);

      await ensureDevHistoryRoutes(context.prisma, user);

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
    async myRouteHistoryConnection(
      _parent: unknown,
      args: RouteConnectionArgs,
      context: GraphQLContext
    ) {
      const user = requireUser(context);

      await ensureDevHistoryRoutes(context.prisma, user);

      return getMyRouteHistoryConnection(context.prisma, user, {
        limit: args.limit,
        cursor: args.cursor,
        today: args.today,
      });
    },
    likedRouteConnection(
      _parent: unknown,
      args: RouteConnectionArgs,
      context: GraphQLContext
    ) {
      const user = requireUser(context);
      return getLikedRouteConnection(context.prisma, user, {
        regionTag: args.regionTag,
        limit: args.limit,
        cursor: args.cursor,
      });
    },
    sharedRoutes(
      _parent: unknown,
      args: SharedRoutesArgs,
      context: GraphQLContext
    ) {
      return getPublicRoutes(context.prisma, {
        regionCode: args.regionCode,
        regionTag: args.regionTag,
        limit: args.limit,
      });
    },
    sharedRouteConnection(
      _parent: unknown,
      args: RouteConnectionArgs,
      context: GraphQLContext
    ) {
      return getPublicRouteConnection(context.prisma, {
        regionCode: args.regionCode,
        regionTag: args.regionTag,
        limit: args.limit,
        cursor: args.cursor,
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
    placeStaySummary(
      _parent: unknown,
      args: PlaceStaySummaryArgs,
      context: GraphQLContext
    ) {
      return getPlaceStaySummary(context.prisma, args.place);
    },
    placeStaySummaries(
      _parent: unknown,
      args: PlaceStaySummariesArgs,
      context: GraphQLContext
    ) {
      return getPlaceStaySummaries(context.prisma, args.places);
    },
    placePhotos(
      _parent: unknown,
      args: PlacePhotosArgs,
      context: GraphQLContext
    ) {
      return getPlacePhotos(context.prisma, args.place, {
        limit: args.limit,
      });
    },
    posterImageDataUrl(
      _parent: unknown,
      args: PosterImageDataUrlArgs,
      context: GraphQLContext
    ) {
      requireUser(context);
      return fetchPosterImageDataUrl(args.url);
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
    updateRouteDayStart(
      _parent: unknown,
      args: UpdateRouteDayStartArgs,
      context: GraphQLContext
    ) {
      const user = requireUser(context);
      return updateRouteDayStart(context.prisma, user, args.input);
    },
    updateRouteStartLocation(
      _parent: unknown,
      args: UpdateRouteStartLocationArgs,
      context: GraphQLContext
    ) {
      const user = requireUser(context);
      return updateRouteStartLocation(context.prisma, user, args.input);
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
        args.verification,
        args.actualStayMinutes
      );
    },
    checkInRouteStop(
      _parent: unknown,
      args: CheckInRouteStopArgs,
      context: GraphQLContext
    ) {
      const user = requireUser(context);
      return checkInRouteStop(
        context.prisma,
        user,
        args.stopId,
        args.verification
      );
    },
    completeRouteStopVisit(
      _parent: unknown,
      args: CompleteRouteStopVisitArgs,
      context: GraphQLContext
    ) {
      const user = requireUser(context);
      return completeRouteStopVisit(
        context.prisma,
        user,
        args.stopId,
        args.actualStayMinutes
      );
    },
    setRouteStopPhotoPublication(
      _parent: unknown,
      args: SetRouteStopPhotoPublicationArgs,
      context: GraphQLContext
    ) {
      const user = requireUser(context);
      return setRouteStopPhotoPublication(
        context.prisma,
        user,
        args.stopId,
        args.published
      );
    },
    setRouteStopVisitPhoto(
      _parent: unknown,
      args: SetRouteStopVisitPhotoArgs,
      context: GraphQLContext
    ) {
      const user = requireUser(context);
      return setRouteStopVisitPhoto(
        context.prisma,
        user,
        args.stopId,
        args.imageId,
        args.imageUrl
      );
    },
    deleteRouteStopVisitPhoto(
      _parent: unknown,
      args: DeleteRouteStopVisitPhotoArgs,
      context: GraphQLContext
    ) {
      const user = requireUser(context);
      return deleteRouteStopVisitPhoto(context.prisma, user, args.stopId);
    },
    updateRouteStopVisitTimes(
      _parent: unknown,
      args: UpdateRouteStopVisitTimesArgs,
      context: GraphQLContext
    ) {
      const user = requireUser(context);
      return updateRouteStopVisitTimes(context.prisma, user, args.input);
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
      return Boolean(context.user && parent.ownerId === context.user.id);
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
    async stops(parent: Route, _args: unknown, context: GraphQLContext) {
      const stops = await context.prisma.routeStop.findMany({
        where: {
          routeId: parent.id,
        },
        orderBy: {
          order: "asc",
        },
      });

      return stops.map((stop) =>
        sanitizeRouteStopPhotoForViewer(stop, parent, context.user?.id ?? null)
      );
    },
  },
  RouteDay: {
    async stops(parent: RouteDay, _args: unknown, context: GraphQLContext) {
      const [route, stops] = await Promise.all([
        context.prisma.route.findUnique({
          where: {
            id: parent.routeId,
          },
        }),
        context.prisma.routeStop.findMany({
          where: {
            dayId: parent.id,
          },
          orderBy: {
            order: "asc",
          },
        }),
      ]);

      if (!route) {
        return [];
      }

      return stops.map((stop) =>
        sanitizeRouteStopPhotoForViewer(stop, route, context.user?.id ?? null)
      );
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
