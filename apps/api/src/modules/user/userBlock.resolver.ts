/**
 * 용도:
 * 내 차단 사용자 목록 조회와 사용자 차단·해제 요청을 GraphQL API로 제공한다.
 *
 * 요청 흐름:
 * 로그인 사용자를 확인한 뒤 개인별 차단 관계를 조회하거나 변경한다.
 */
import { gql } from "graphql-tag";
import type { GraphQLContext } from "../../context.js";
import { requireUser } from "../../lib/auth.js";
import {
  blockUser,
  getBlockedUsers,
  unblockUser,
} from "./userBlock.service.js";

export const userBlockTypeDefs = gql`
  extend type Query {
    blockedUsers: [User!]!
  }

  extend type Mutation {
    blockUser(userId: ID!): User!
    unblockUser(userId: ID!): User!
  }
`;

type UserIdArgs = {
  userId: string;
};

export const userBlockResolvers = {
  Query: {
    blockedUsers(
      _parent: unknown,
      _args: unknown,
      context: GraphQLContext
    ) {
      const user = requireUser(context);
      return getBlockedUsers(context.prisma, user);
    },
  },
  Mutation: {
    blockUser(
      _parent: unknown,
      args: UserIdArgs,
      context: GraphQLContext
    ) {
      const user = requireUser(context);
      return blockUser(context.prisma, user, args.userId);
    },
    unblockUser(
      _parent: unknown,
      args: UserIdArgs,
      context: GraphQLContext
    ) {
      const user = requireUser(context);
      return unblockUser(context.prisma, user, args.userId);
    },
  },
};
