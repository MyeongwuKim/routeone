import { gql } from "graphql-tag";
import type {
  FestivalNotificationKind,
  RouteReviewNotificationKind,
} from "@prisma/client";
import type { GraphQLContext } from "../../context.js";
import { UserFacingError } from "../../graphql/userFacingError.js";
import { requireUser } from "../../lib/auth.js";
import {
  getNotificationInbox,
  getUnreadNotificationCount,
  markNotificationInboxRead,
  sendFestivalTestNotification,
  sendRouteReviewTestNotification,
  syncFestivalNotificationInbox,
  syncRouteArrivalNotificationInbox,
  syncRouteReviewNotificationInbox,
  type FestivalNotificationSyncInput,
  type RouteArrivalNotificationSyncInput,
  type RouteReviewNotificationSyncInput,
} from "./notification.service.js";
import { getFestivals } from "./festivalLookup.service.js";
import { normalizeFestivalRegionCode } from "./festivalRegions.js";
import {
  getNotificationSettings,
  registerPushDevice,
  unregisterPushDevice,
  updateNotificationSettings,
  syncFestivalRegionWithServiceArea,
  type RegisterPushDeviceInput,
  type UpdateNotificationSettingsInput,
} from "./notificationSettings.service.js";

export const notificationTypeDefs = gql`
  enum UserNotificationType {
    FESTIVAL_SUMMARY
    ROUTE_START
    ROUTE_ARRIVAL
    ROUTE_REVIEW
  }

  enum FestivalNotificationKind {
    TODAY
    WEEKLY
    MONTHLY
    TRIP
    TEST
  }

  enum RouteReviewNotificationKind {
    COMPLETED
    INCOMPLETE
    UNSTARTED
  }

  enum PushPlatform {
    IOS
    ANDROID
  }

  type UserNotification {
    id: ID!
    notificationKey: String!
    type: UserNotificationType!
    festivalKind: FestivalNotificationKind
    regionCode: String
    regionLabel: String
    dateKey: String
    festivalRegionCodes: [String!]!
    festivalIds: [String!]!
    festivalTitles: [String!]!
    festivalStartDates: [String!]!
    festivalEndDates: [String!]!
    routeReviewKind: RouteReviewNotificationKind
    routeId: ID
    routeTitle: String
    dayId: ID
    routeDayIndex: Int
    routeStartAt: DateTime
    stopId: ID
    placeTitle: String
    correctionDeadlineAt: DateTime
    availableAt: DateTime!
    readAt: DateTime
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type GangwonFestival {
    id: ID!
    title: String!
    startDate: String!
    endDate: String!
    regionCode: String!
    address: String!
    lat: Float!
    lng: Float!
    imageUrl: String!
  }

  type Festival {
    id: ID!
    title: String!
    startDate: String!
    endDate: String!
    regionCode: String!
    areaCode: String!
    sigunguCode: String!
    address: String!
    lat: Float!
    lng: Float!
    imageUrl: String!
  }

  input FestivalNotificationSyncInput {
    notificationKey: String!
    kind: FestivalNotificationKind!
    festivalRegionCodes: [String!]
    regionCode: String!
    regionLabel: String!
    dateKey: String!
    festivalIds: [String!]!
    festivalTitles: [String!]!
    festivalStartDates: [String!]
    festivalEndDates: [String!]
    triggerAt: DateTime
  }

  input RouteArrivalNotificationSyncInput {
    notificationKey: String
    routeId: ID!
    routeTitle: String
    dayId: ID!
    stopId: ID!
    placeTitle: String!
    dateKey: String!
    deliveredAt: DateTime!
  }

  input RouteReviewNotificationSyncInput {
    notificationKey: String!
    kind: RouteReviewNotificationKind!
    routeId: ID!
    routeTitle: String!
    dayId: ID!
    triggerAt: DateTime
    correctionDeadlineAt: DateTime!
  }

  type NotificationSyncPayload {
    syncedCount: Int!
  }

  type RouteArrivalNotificationSyncPayload {
    syncedCount: Int!
    notificationKeys: [String!]!
  }

  type NotificationReadPayload {
    updatedCount: Int!
  }

  type NotificationInboxPageInfo {
    hasNextPage: Boolean!
    endCursor: String
  }

  type NotificationInboxConnection {
    items: [UserNotification!]!
    pageInfo: NotificationInboxPageInfo!
  }

  type FestivalNotificationTestPayload {
    notificationKey: String!
    pushStatus: String!
    pushError: String
  }

  type RouteReviewNotificationTestPayload {
    notificationKey: String!
    pushStatus: String!
    pushError: String
    routeId: ID!
    dayId: ID!
  }

  type NotificationSettings {
    festivalEnabled: Boolean!
    festivalRegionCodes: [String!]!
    routeStartEnabled: Boolean!
    routeReviewEnabled: Boolean!
    routeArrivalEnabled: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  input UpdateNotificationSettingsInput {
    festivalEnabled: Boolean
    festivalRegionCodes: [String!]
    routeStartEnabled: Boolean
    routeReviewEnabled: Boolean
    routeArrivalEnabled: Boolean
  }

  type PushDevice {
    id: ID!
    expoPushToken: String!
    platform: PushPlatform!
    appVariant: String
    enabled: Boolean!
    lastSeenAt: DateTime!
  }

  input RegisterPushDeviceInput {
    expoPushToken: String!
    platform: PushPlatform!
    appVariant: String
    locale: String
  }

  extend type Query {
    notificationInbox(
      first: Int = 30
      after: String
    ): NotificationInboxConnection!
    unreadNotificationCount: Int!
    notificationSettings: NotificationSettings!
    gangwonFestivals(startDate: String!, endDate: String!): [GangwonFestival!]!
    festivals(startDate: String!, endDate: String!, areaCode: String, regionCodes: [String!]): [Festival!]!
  }

  extend type Mutation {
    syncFestivalNotificationInbox(
      notifications: [FestivalNotificationSyncInput!]!
    ): NotificationSyncPayload!
    syncRouteArrivalNotificationInbox(
      notifications: [RouteArrivalNotificationSyncInput!]!
    ): RouteArrivalNotificationSyncPayload!
    syncRouteReviewNotificationInbox(
      notifications: [RouteReviewNotificationSyncInput!]!
    ): NotificationSyncPayload!
    markNotificationInboxRead(ids: [ID!]): NotificationReadPayload!
    sendFestivalTestNotification: FestivalNotificationTestPayload!
    sendRouteReviewTestNotification(
      pushDeviceId: ID!
    ): RouteReviewNotificationTestPayload!
    updateNotificationSettings(
      input: UpdateNotificationSettingsInput!
    ): NotificationSettings!
    syncFestivalRegionWithServiceArea(regionCode: String!): NotificationSettings!
    registerPushDevice(input: RegisterPushDeviceInput!): PushDevice!
    unregisterPushDevice(expoPushToken: String!): NotificationReadPayload!
  }
`;

type NotificationInboxArgs = {
  first?: number | null;
  after?: string | null;
};

type GangwonFestivalsArgs = {
  startDate: string;
  endDate: string;
};

type SyncFestivalNotificationInboxArgs = {
  notifications: Array<
    Omit<FestivalNotificationSyncInput, "kind"> & {
      kind: FestivalNotificationKind;
    }
  >;
};

type SyncRouteArrivalNotificationInboxArgs = {
  notifications: RouteArrivalNotificationSyncInput[];
};

type SyncRouteReviewNotificationInboxArgs = {
  notifications: Array<
    Omit<RouteReviewNotificationSyncInput, "kind"> & {
      kind: RouteReviewNotificationKind;
    }
  >;
};

type MarkNotificationInboxReadArgs = {
  ids?: string[] | null;
};

type UpdateNotificationSettingsArgs = {
  input: UpdateNotificationSettingsInput;
};

type RegisterPushDeviceArgs = {
  input: RegisterPushDeviceInput;
};

type UnregisterPushDeviceArgs = {
  expoPushToken: string;
};

type SendRouteReviewTestNotificationArgs = {
  pushDeviceId: string;
};

function requireAuthenticatedNotificationUser(context: GraphQLContext) {
  if (
    !context.authenticatedUserId ||
    !context.user ||
    context.authenticatedUserId !== context.user.id
  ) {
    throw new UserFacingError("로그인이 필요합니다.");
  }

  return context.user;
}

function requireAuthenticatedNotificationSession(context: GraphQLContext) {
  const user = requireAuthenticatedNotificationUser(context);
  const sessionExpiresAt = context.authenticatedSessionExpiresAt;

  if (!sessionExpiresAt || sessionExpiresAt <= new Date()) {
    throw new UserFacingError("로그인이 필요합니다.");
  }

  return {
    user,
    sessionExpiresAt,
  };
}

export const notificationResolvers = {
  UserNotification: {
    festivalRegionCodes(parent: { festivalRegionCodes?: string[]; regionCode?: string | null }) {
      if (parent.festivalRegionCodes?.length) return parent.festivalRegionCodes;
      const code = parent.regionCode ? normalizeFestivalRegionCode(parent.regionCode) : null;
      return code ? [code] : [];
    },
    festivalStartDates(parent: { festivalStartDates?: string[] | null }) {
      return parent.festivalStartDates ?? [];
    },
    festivalEndDates(parent: { festivalEndDates?: string[] | null }) {
      return parent.festivalEndDates ?? [];
    },
  },
  NotificationSettings: {
    routeStartEnabled(parent: { routeStartEnabled?: boolean | null }) {
      return parent.routeStartEnabled ?? true;
    },
  },
  Query: {
    festivals(_parent: unknown, args: Parameters<typeof getFestivals>[0]) {
      return getFestivals(args);
    },
    async gangwonFestivals(_parent: unknown, args: GangwonFestivalsArgs) {
      const festivals = await getFestivals({ ...args, areaCode: "32" });
      return festivals.map(festival => ({ ...festival, regionCode: festival.sigunguCode }));
    },
    notificationInbox(
      _parent: unknown,
      args: NotificationInboxArgs,
      context: GraphQLContext
    ) {
      const user = requireUser(context);
      return getNotificationInbox(
        context.prisma,
        user,
        args.first,
        args.after
      );
    },
    unreadNotificationCount(
      _parent: unknown,
      _args: unknown,
      context: GraphQLContext
    ) {
      const user = requireUser(context);
      return getUnreadNotificationCount(context.prisma, user);
    },
    notificationSettings(
      _parent: unknown,
      _args: unknown,
      context: GraphQLContext
    ) {
      const user = requireUser(context);
      return getNotificationSettings(context.prisma, user);
    },
  },
  Mutation: {
    syncFestivalNotificationInbox(
      _parent: unknown,
      args: SyncFestivalNotificationInboxArgs,
      context: GraphQLContext
    ) {
      const user = requireUser(context);
      return syncFestivalNotificationInbox(
        context.prisma,
        user,
        args.notifications
      );
    },
    syncRouteArrivalNotificationInbox(
      _parent: unknown,
      args: SyncRouteArrivalNotificationInboxArgs,
      context: GraphQLContext
    ) {
      const user = requireUser(context);
      return syncRouteArrivalNotificationInbox(
        context.prisma,
        user,
        args.notifications
      );
    },
    syncRouteReviewNotificationInbox(
      _parent: unknown,
      args: SyncRouteReviewNotificationInboxArgs,
      context: GraphQLContext
    ) {
      const user = requireUser(context);
      return syncRouteReviewNotificationInbox(
        context.prisma,
        user,
        args.notifications
      );
    },
    markNotificationInboxRead(
      _parent: unknown,
      args: MarkNotificationInboxReadArgs,
      context: GraphQLContext
    ) {
      const user = requireUser(context);
      return markNotificationInboxRead(context.prisma, user, args.ids);
    },
    sendFestivalTestNotification(
      _parent: unknown,
      _args: unknown,
      context: GraphQLContext
    ) {
      const user = requireAuthenticatedNotificationUser(context);
      return sendFestivalTestNotification(context.prisma, user);
    },
    sendRouteReviewTestNotification(
      _parent: unknown,
      args: SendRouteReviewTestNotificationArgs,
      context: GraphQLContext
    ) {
      const user = requireAuthenticatedNotificationUser(context);
      return sendRouteReviewTestNotification(
        context.prisma,
        user,
        args.pushDeviceId
      );
    },
    updateNotificationSettings(
      _parent: unknown,
      args: UpdateNotificationSettingsArgs,
      context: GraphQLContext
    ) {
      const user = requireUser(context);
      return updateNotificationSettings(context.prisma, user, args.input);
    },
    syncFestivalRegionWithServiceArea(
      _parent: unknown,
      args: { regionCode: string },
      context: GraphQLContext
    ) {
      const user = requireUser(context);
      return syncFestivalRegionWithServiceArea(context.prisma, user, args.regionCode);
    },
    registerPushDevice(
      _parent: unknown,
      args: RegisterPushDeviceArgs,
      context: GraphQLContext
    ) {
      const { user, sessionExpiresAt } =
        requireAuthenticatedNotificationSession(context);
      return registerPushDevice(
        context.prisma,
        user,
        args.input,
        sessionExpiresAt
      );
    },
    unregisterPushDevice(
      _parent: unknown,
      args: UnregisterPushDeviceArgs,
      context: GraphQLContext
    ) {
      const user = requireAuthenticatedNotificationUser(context);
      return unregisterPushDevice(
        context.prisma,
        user,
        args.expoPushToken
      );
    },
  },
};
