/**
 * 용도:
 * 공유 루트 신고와 OWNER 전용 검토 기능을 GraphQL API로 제공한다.
 *
 * 요청 흐름:
 * 로그인 사용자는 다른 사용자의 공개 루트를 신고하고,
 * OWNER는 신고 묶음을 확인해 문제없음 또는 공유 숨김으로 처리한다.
 */
import type {
  SharedRouteModerationAction,
  SharedRouteReportReason,
} from "@prisma/client";
import { gql } from "graphql-tag";
import type { GraphQLContext } from "../../context.js";
import { requireOwner, requireUser } from "../../lib/auth.js";
import {
  getPendingSharedRouteReportQueue,
  moderateSharedRoute,
  reportSharedRoute,
} from "./sharedRouteReport.service.js";

export const sharedRouteReportTypeDefs = gql`
  enum SharedRouteReportReason {
    INAPPROPRIATE
    MISLEADING
    SPAM
    HARASSMENT_OR_HATE
    PRIVACY_OR_RIGHTS
    OTHER
  }

  enum SharedRouteReportStatus {
    PENDING
    DISMISSED
    ACTIONED
  }

  enum SharedRouteModerationAction {
    DISMISSED
    HIDDEN
  }

  type SharedRouteReport {
    id: ID!
    routeId: ID!
    reason: SharedRouteReportReason!
    details: String
    status: SharedRouteReportStatus!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type ModerationSharedRouteOwner {
    id: ID!
    displayName: String
    email: String
  }

  type ModerationSharedRouteReportItem {
    routeId: ID!
    placeTitles: [String!]!
    tripDays: Int!
    owner: ModerationSharedRouteOwner
    reportCount: Int!
    reasons: [SharedRouteReportReason!]!
    details: [String!]!
    latestReportedAt: DateTime!
  }

  type ModeratedSharedRoutePayload {
    routeId: ID!
    action: SharedRouteModerationAction!
  }

  extend type Query {
    pendingSharedRouteReports: [ModerationSharedRouteReportItem!]!
  }

  extend type Mutation {
    reportSharedRoute(
      routeId: ID!
      reason: SharedRouteReportReason!
      details: String
    ): SharedRouteReport!
    moderateSharedRoute(
      routeId: ID!
      action: SharedRouteModerationAction!
    ): ModeratedSharedRoutePayload!
  }
`;

type ReportSharedRouteArgs = {
  routeId: string;
  reason: SharedRouteReportReason;
  details?: string | null;
};

type ModerateSharedRouteArgs = {
  routeId: string;
  action: SharedRouteModerationAction;
};

export const sharedRouteReportResolvers = {
  Query: {
    pendingSharedRouteReports(
      _parent: unknown,
      _args: unknown,
      context: GraphQLContext
    ) {
      requireOwner(context);
      return getPendingSharedRouteReportQueue(context.prisma);
    },
  },
  Mutation: {
    reportSharedRoute(
      _parent: unknown,
      args: ReportSharedRouteArgs,
      context: GraphQLContext
    ) {
      const user = requireUser(context);
      return reportSharedRoute(
        context.prisma,
        user,
        args.routeId,
        args.reason,
        args.details
      );
    },
    moderateSharedRoute(
      _parent: unknown,
      args: ModerateSharedRouteArgs,
      context: GraphQLContext
    ) {
      const owner = requireOwner(context);
      return moderateSharedRoute(
        context.prisma,
        owner,
        args.routeId,
        args.action
      );
    },
  },
};
