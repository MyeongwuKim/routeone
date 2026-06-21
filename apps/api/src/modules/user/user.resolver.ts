import { gql } from "graphql-tag";
import type { GraphQLContext } from "../../context.js";
import {
  createAuthToken,
  hashPassword,
  normalizeAccountId,
  verifyPassword,
} from "../../lib/auth.js";

export const userTypeDefs = gql`
  type User {
    id: ID!
    accountId: String
    email: String
    displayName: String
    avatarUrl: String
    locale: String
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  input PasswordLoginInput {
    accountId: String!
    password: String!
    displayName: String
  }

  extend type Query {
    me: User
  }

  extend type Mutation {
    loginWithPassword(input: PasswordLoginInput!): AuthPayload!
  }
`;

type LoginWithPasswordArgs = {
  input: {
    accountId: string;
    password: string;
    displayName?: string | null;
  };
};

function normalizeDisplayName(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed || null;
}

export const userResolvers = {
  Query: {
    me(_parent: unknown, _args: unknown, context: GraphQLContext) {
      return context.user;
    },
  },
  Mutation: {
    async loginWithPassword(
      _parent: unknown,
      args: LoginWithPasswordArgs,
      context: GraphQLContext
    ) {
      const accountId = normalizeAccountId(args.input.accountId);
      const password = args.input.password;

      if (accountId.length < 3) {
        throw new Error("아이디는 3자 이상이어야 합니다.");
      }

      if (password.length < 4) {
        throw new Error("비밀번호는 4자 이상이어야 합니다.");
      }

      const existingUser = await context.prisma.user.findFirst({
        where: {
          accountId,
        },
      });

      if (existingUser) {
        if (
          !existingUser.passwordHash ||
          !verifyPassword(password, existingUser.passwordHash)
        ) {
          throw new Error("아이디 또는 비밀번호가 올바르지 않습니다.");
        }

        return {
          token: createAuthToken(existingUser.id),
          user: existingUser,
        };
      }

      const user = await context.prisma.user.create({
        data: {
          accountId,
          passwordHash: hashPassword(password),
          displayName: normalizeDisplayName(args.input.displayName) ?? accountId,
          locale: "ko",
        },
      });

      return {
        token: createAuthToken(user.id),
        user,
      };
    },
  },
};
