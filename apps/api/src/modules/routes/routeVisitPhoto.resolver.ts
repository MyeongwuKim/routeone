import { gql } from "graphql-tag";
import type { GraphQLContext } from "../../context.js";
import { requireUser } from "../../lib/auth.js";
import { createRouteStopVisitPhotoUpload } from "./routeVisitPhoto.service.js";

export const routeVisitPhotoTypeDefs = gql`
  type RouteStopVisitPhotoUploadPayload {
    imageId: String!
    uploadUrl: String!
    imageUrl: String!
    fileName: String!
    environment: String!
    expiresAt: DateTime!
  }

  extend type Mutation {
    createRouteStopVisitPhotoUpload(
      stopId: ID!
    ): RouteStopVisitPhotoUploadPayload!
  }
`;

type CreateRouteStopVisitPhotoUploadArgs = {
  stopId: string;
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
  },
};
