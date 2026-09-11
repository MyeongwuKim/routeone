/**
 * 용도:
 * 사진 신고 및 OWNER 전용 검토 기능을 GraphQL API로 제공한다.
 *
 * 요청 흐름:
 * 일반 사용자는 신고·취소만 할 수 있고, 검토 목록과 전체 노출 변경은 OWNER만 접근한다.
 */
import type {
  PlacePhoto,
  PlacePhotoModerationAction,
  PlacePhotoReportReason,
} from "@prisma/client";
import { gql } from "graphql-tag";
import type { GraphQLContext } from "../../context.js";
import { requireOwner, requireUser } from "../../lib/auth.js";
import {
  cancelPlacePhotoReport,
  getMyPendingPhotoReport,
  getPendingPhotoReportQueue,
  moderatePlacePhoto,
  reportPlacePhoto,
} from "./photoReport.service.js";

export const photoReportTypeDefs = gql`
  enum PlacePhotoReportReason {
    INAPPROPRIATE
    VIOLENCE_OR_HATE
    PRIVACY
    SPAM
    OTHER
  }

  enum PlacePhotoReportStatus {
    PENDING
    CANCELED
    DISMISSED
    ACTIONED
  }

  enum PlacePhotoModerationAction {
    DISMISSED
    HIDDEN
    DELETED
  }

  type PlacePhotoReport {
    id: ID!
    photoId: ID!
    reason: PlacePhotoReportReason!
    details: String
    status: PlacePhotoReportStatus!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type ModerationPhotoUploader {
    id: ID!
    displayName: String
    email: String
  }

  type ModerationPhotoReportItem {
    photoId: ID!
    title: String!
    imageUrl: String!
    thumbnailUrl: String!
    status: PlacePhotoStatus!
    uploader: ModerationPhotoUploader
    reportCount: Int!
    reasons: [PlacePhotoReportReason!]!
    details: [String!]!
    latestReportedAt: DateTime!
  }

  type ModeratedPlacePhotoPayload {
    photoId: ID!
    action: PlacePhotoModerationAction!
  }

  extend type PlacePhoto {
    userId: ID!
    isMine: Boolean!
    reportedByMe: Boolean!
    myReport: PlacePhotoReport
  }

  extend type RouteStop {
    verificationPhotoRecordId: ID
    verificationPhotoReportedByMe: Boolean!
  }

  extend type Query {
    pendingPhotoReports: [ModerationPhotoReportItem!]!
  }

  extend type Mutation {
    reportPlacePhoto(
      photoId: ID!
      reason: PlacePhotoReportReason!
      details: String
    ): PlacePhotoReport!
    cancelPlacePhotoReport(photoId: ID!): PlacePhotoReport!
    moderatePlacePhoto(
      photoId: ID!
      action: PlacePhotoModerationAction!
    ): ModeratedPlacePhotoPayload!
  }
`;

type PlacePhotoReportArgs = {
  photoId: string;
  reason: PlacePhotoReportReason;
  details?: string | null;
};

type PhotoIdArgs = { photoId: string };
type ModeratePhotoArgs = PhotoIdArgs & { action: PlacePhotoModerationAction };

export const photoReportResolvers = {
  Query: {
    pendingPhotoReports(
      _parent: unknown,
      _args: unknown,
      context: GraphQLContext
    ) {
      requireOwner(context);
      return getPendingPhotoReportQueue(context.prisma);
    },
  },
  Mutation: {
    reportPlacePhoto(
      _parent: unknown,
      args: PlacePhotoReportArgs,
      context: GraphQLContext
    ) {
      const user = requireUser(context);
      return reportPlacePhoto(
        context.prisma,
        user,
        args.photoId,
        args.reason,
        args.details
      );
    },
    cancelPlacePhotoReport(
      _parent: unknown,
      args: PhotoIdArgs,
      context: GraphQLContext
    ) {
      const user = requireUser(context);
      return cancelPlacePhotoReport(context.prisma, user, args.photoId);
    },
    moderatePlacePhoto(
      _parent: unknown,
      args: ModeratePhotoArgs,
      context: GraphQLContext
    ) {
      const owner = requireOwner(context);
      return moderatePlacePhoto(context.prisma, owner, args.photoId, args.action);
    },
  },
  PlacePhoto: {
    isMine(parent: PlacePhoto, _args: unknown, context: GraphQLContext) {
      return parent.userId === context.user?.id;
    },
    async reportedByMe(
      parent: PlacePhoto,
      _args: unknown,
      context: GraphQLContext
    ) {
      if (!context.user) return false;
      return Boolean(
        await getMyPendingPhotoReport(context.prisma, context.user.id, parent.id)
      );
    },
    myReport(parent: PlacePhoto, _args: unknown, context: GraphQLContext) {
      if (!context.user) return null;
      return getMyPendingPhotoReport(context.prisma, context.user.id, parent.id);
    },
  },
  RouteStop: {
    async verificationPhotoRecordId(
      parent: { id: string; verificationPhotoUrl?: string | null },
      _args: unknown,
      context: GraphQLContext
    ) {
      if (!parent.verificationPhotoUrl) return null;
      const photo = await context.prisma.placePhoto.findUnique({
        where: { routeStopId: parent.id },
        select: { id: true },
      });
      return photo?.id ?? null;
    },
    async verificationPhotoReportedByMe(
      parent: { id: string; verificationPhotoUrl?: string | null },
      _args: unknown,
      context: GraphQLContext
    ) {
      if (!context.user || !parent.verificationPhotoUrl) return false;
      const photo = await context.prisma.placePhoto.findUnique({
        where: { routeStopId: parent.id },
        select: { id: true },
      });
      if (!photo) return false;
      return Boolean(
        await getMyPendingPhotoReport(context.prisma, context.user.id, photo.id)
      );
    },
  },
};
