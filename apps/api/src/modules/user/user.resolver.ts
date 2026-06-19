import { gql } from "graphql-tag";
import type { GraphQLContext } from "../../context.js";

export const userTypeDefs = gql`
  type User {
    id: ID!
    email: String
    displayName: String
    avatarUrl: String
    locale: String
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  extend type Query {
    me: User
  }
`;

export const userResolvers = {
  Query: {
    me(_parent: unknown, _args: unknown, context: GraphQLContext) {
      return context.user;
    },
  },
};
