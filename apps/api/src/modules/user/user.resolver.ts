import { gql } from "graphql-tag";
import type { GraphQLContext } from "../../context.js";
import {
  createAuthToken,
  hashPassword,
  normalizeAccountId,
  verifyPassword,
} from "../../lib/auth.js";
import {
  verifyNativeOAuthIdentity,
  type NativeOAuthLoginInput,
  type VerifiedOAuthIdentity,
} from "../../lib/oauth.js";

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

  enum NativeOAuthProvider {
    GOOGLE
    APPLE
  }

  input NativeOAuthLoginInput {
    provider: NativeOAuthProvider!
    identityToken: String!
    displayName: String
    email: String
    avatarUrl: String
  }

  extend type Query {
    me: User
  }

  extend type Mutation {
    loginWithPassword(input: PasswordLoginInput!): AuthPayload!
    loginWithNativeOAuth(input: NativeOAuthLoginInput!): AuthPayload!
    refreshAuthSession: AuthPayload!
  }
`;

type LoginWithPasswordArgs = {
  input: {
    accountId: string;
    password: string;
    displayName?: string | null;
  };
};

type LoginWithNativeOAuthArgs = {
  input: NativeOAuthLoginInput;
};

function normalizeDisplayName(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed || null;
}

function getOAuthFallbackDisplayName(identity: VerifiedOAuthIdentity) {
  if (identity.displayName) {
    return identity.displayName;
  }

  if (identity.email) {
    return identity.email.split("@")[0] || identity.email;
  }

  return identity.provider === "GOOGLE" ? "Google 사용자" : "Apple 사용자";
}

async function findOrCreateOAuthUser(
  context: GraphQLContext,
  identity: VerifiedOAuthIdentity
) {
  const existingAccount = await context.prisma.authAccount.findFirst({
    where: {
      provider: identity.provider,
      providerAccountId: identity.providerAccountId,
    },
    include: {
      user: true,
    },
  });

  if (existingAccount) {
    const user = existingAccount.user;

    if (identity.avatarUrl && user.avatarUrl !== identity.avatarUrl) {
      return context.prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          avatarUrl: identity.avatarUrl,
        },
      });
    }

    return user;
  }

  const existingUser = identity.email
    ? await context.prisma.user.findFirst({
        where: {
          email: identity.email,
        },
      })
    : null;
  const user =
    existingUser ??
    (await context.prisma.user.create({
      data: {
        email: identity.email,
        displayName: getOAuthFallbackDisplayName(identity),
        avatarUrl: identity.avatarUrl,
        locale: "ko",
      },
    }));

  await context.prisma.authAccount.create({
    data: {
      provider: identity.provider,
      providerAccountId: identity.providerAccountId,
      email: identity.email,
      userId: user.id,
    },
  });

  if (
    existingUser &&
    ((identity.displayName && !existingUser.displayName) ||
      (identity.avatarUrl && existingUser.avatarUrl !== identity.avatarUrl))
  ) {
    return context.prisma.user.update({
      where: {
        id: existingUser.id,
      },
      data: {
        displayName: existingUser.displayName ?? identity.displayName,
        avatarUrl: identity.avatarUrl ?? existingUser.avatarUrl,
      },
    });
  }

  return user;
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
    async loginWithNativeOAuth(
      _parent: unknown,
      args: LoginWithNativeOAuthArgs,
      context: GraphQLContext
    ) {
      const identity = await verifyNativeOAuthIdentity(args.input);
      const user = await findOrCreateOAuthUser(context, identity);

      return {
        token: createAuthToken(user.id),
        user,
      };
    },
    refreshAuthSession(
      _parent: unknown,
      _args: unknown,
      context: GraphQLContext
    ) {
      if (!context.authenticatedUserId) {
        throw new Error(
          "로그인 세션이 만료되었어요. 다시 로그인해 주세요."
        );
      }

      return {
        token: createAuthToken(context.authenticatedUserId),
        user: context.user,
      };
    },
  },
};
