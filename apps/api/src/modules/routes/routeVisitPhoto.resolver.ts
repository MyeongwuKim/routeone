import { gql } from "graphql-tag";
import type { GraphQLContext } from "../../context.js";
import { requireUser } from "../../lib/auth.js";
import {
  analyzeRouteStopVisitPhoto,
  createRouteStopVisitPhotoUpload,
  type AnalyzeRouteStopVisitPhotoInput,
} from "./routeVisitPhoto.service.js";

export const routeVisitPhotoTypeDefs = gql`
  type RouteStopVisitPhotoUploadPayload {
    imageId: String!
    uploadUrl: String!
    imageUrl: String!
    expiresAt: DateTime!
  }

  enum RouteStopVisitPhotoDecision {
    MATCH
    MAYBE
    NO
    SKIPPED
  }

  type RouteStopVisitPhotoAnalysisPayload {
    decision: RouteStopVisitPhotoDecision!
    confidence: Float!
    referenceImageUrls: [String!]!
    visualEvidence: [String!]!
    textEvidence: [String!]!
    mismatchReasons: [String!]!
    needsReview: Boolean!
    skippedReason: String
  }

  input AnalyzeRouteStopVisitPhotoInput {
    stopId: ID!
    photoUrl: String!
    lat: Float
    lng: Float
    accuracyMeters: Float
  }

  extend type Mutation {
    createRouteStopVisitPhotoUpload(
      stopId: ID!
    ): RouteStopVisitPhotoUploadPayload!
    analyzeRouteStopVisitPhoto(
      input: AnalyzeRouteStopVisitPhotoInput!
    ): RouteStopVisitPhotoAnalysisPayload!
  }
`;

type CreateRouteStopVisitPhotoUploadArgs = {
  stopId: string;
};

type AnalyzeRouteStopVisitPhotoArgs = {
  input: AnalyzeRouteStopVisitPhotoInput;
};

export const routeVisitPhotoResolvers = {
  Mutation: {
    createRouteStopVisitPhotoUpload(
      _parent: unknown,
      args: CreateRouteStopVisitPhotoUploadArgs,
      context: GraphQLContext
    ) {
      const user = requireUser(context);
      return createRouteStopVisitPhotoUpload(
        context.prisma,
        user,
        args.stopId
      );
    },
    analyzeRouteStopVisitPhoto(
      _parent: unknown,
      args: AnalyzeRouteStopVisitPhotoArgs,
      context: GraphQLContext
    ) {
      const user = requireUser(context);
      return analyzeRouteStopVisitPhoto(context.prisma, user, args.input);
    },
  },
};
