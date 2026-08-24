import { gql } from "graphql-tag";
import type { GraphQLContext } from "../../context.js";
import { UserFacingError } from "../../graphql/userFacingError.js";
import {
  createAuthToken,
  hashPassword,
  normalizeAccountId,
  requireUser,
  verifyPassword,
} from "../../lib/auth.js";
import {
  verifyNativeOAuthIdentity,
  type NativeOAuthLoginInput,
  type VerifiedOAuthIdentity,
} from "../../lib/oauth.js";
import { deleteUserAccount } from "./userAccount.service.js";

export const userTypeDefs = gql`
  enum AuthProvider {
    PASSWORD
    GOOGLE
    APPLE
    UNKNOWN
  }

  enum UserRole {
    USER
    REVIEWER
    OWNER
  }

  type User {
    id: ID!
    accountId: String
    email: String
    displayName: String
    avatarUrl: String
    authProviders: [AuthProvider!]!
    locale: String
    role: UserRole!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type DeletedUserPayload {
    id: ID!
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
    deleteMyAccount: DeletedUserPayload!
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

const DEFAULT_OWNER_GOOGLE_EMAIL = "routeonekim@gmail.com";

function getOwnerGoogleEmails() {
  const configuredEmails = (
    process.env.ROUTEONE_OWNER_GOOGLE_EMAILS ??
    process.env.ROUTEONE_OWNER_GOOGLE_EMAIL ??
    ""
  )
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  return new Set([DEFAULT_OWNER_GOOGLE_EMAIL, ...configuredEmails]);
}

function isOwnerGoogleIdentity(identity: VerifiedOAuthIdentity) {
  return (
    identity.provider === "GOOGLE" &&
    identity.emailVerified &&
    Boolean(
      identity.email &&
        getOwnerGoogleEmails().has(identity.email.trim().toLowerCase())
    )
  );
}

function normalizeDisplayName(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed || null;
}

function isPasswordAccountCreationEnabled() {
  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  return ["1", "true", "yes", "on"].includes(
    process.env.ROUTEONE_PASSWORD_ACCOUNT_SIGNUP_ENABLED
      ?.trim()
      .toLowerCase() ?? ""
  );
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
  const shouldBeOwner = isOwnerGoogleIdentity(identity);
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
    const shouldUpdateAvatar =
      Boolean(identity.avatarUrl) && user.avatarUrl !== identity.avatarUrl;
    const shouldUpdateRole = shouldBeOwner && user.role !== "OWNER";

    if (shouldUpdateAvatar || shouldUpdateRole) {
      return context.prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          ...(shouldUpdateAvatar ? { avatarUrl: identity.avatarUrl } : {}),
          ...(shouldUpdateRole ? { role: "OWNER" as const } : {}),
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
        role: shouldBeOwner ? "OWNER" : "USER",
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
      (identity.avatarUrl && existingUser.avatarUrl !== identity.avatarUrl) ||
      (shouldBeOwner && existingUser.role !== "OWNER"))
  ) {
    return context.prisma.user.update({
      where: {
        id: existingUser.id,
      },
      data: {
        displayName: existingUser.displayName ?? identity.displayName,
        avatarUrl: identity.avatarUrl ?? existingUser.avatarUrl,
        ...(shouldBeOwner ? { role: "OWNER" as const } : {}),
      },
    });
  }

  return user;
}

export const userResolvers = {
  User: {
    async authProviders(
      user: {
        id: string;
        accountId?: string | null;
        passwordHash?: string | null;
      },
      _args: unknown,
      context: GraphQLContext
    ) {
      const providers = new Set<"PASSWORD" | "GOOGLE" | "APPLE" | "UNKNOWN">();

      if (user.accountId && user.passwordHash) {
        providers.add("PASSWORD");
      }

      const authAccounts = await context.prisma.authAccount.findMany({
        where: {
          userId: user.id,
        },
        select: {
          provider: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      });

      authAccounts.forEach((account) => providers.add(account.provider));

      return providers.size > 0 ? [...providers] : ["UNKNOWN"];
    },
  },
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
        throw new UserFacingError("아이디는 3자 이상이어야 합니다.");
      }

      if (password.length < 4) {
        throw new UserFacingError("비밀번호는 4자 이상이어야 합니다.");
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
          throw new UserFacingError("아이디 또는 비밀번호가 올바르지 않습니다.");
        }

        return {
          token: createAuthToken(existingUser.id),
          user: existingUser,
        };
      }

      if (!isPasswordAccountCreationEnabled()) {
        throw new UserFacingError("등록된 테스트 계정 정보를 확인해 주세요.");
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
      if (!context.authenticatedUserId || !context.user) {
        throw new UserFacingError(
          "로그인 세션이 만료되었어요. 다시 로그인해 주세요."
        );
      }

      return {
        token: createAuthToken(context.authenticatedUserId),
        user: context.user,
      };
    },
    deleteMyAccount(
      _parent: unknown,
      _args: unknown,
      context: GraphQLContext
    ) {
      if (!context.authenticatedUserId) {
        throw new UserFacingError("로그인한 계정만 탈퇴할 수 있습니다.");
      }

      const user = requireUser(context);

      if (user.role !== "USER") {
        throw new UserFacingError("운영 및 심사 계정은 앱에서 탈퇴할 수 없습니다.");
      }

      return deleteUserAccount(context.prisma, context.authenticatedUserId);
    },
  },
};
