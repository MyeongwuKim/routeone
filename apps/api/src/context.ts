import type { FastifyRequest } from "fastify";
import type { PrismaClient, User } from "@prisma/client";
import { prisma } from "./lib/prisma.js";
import { readBearerToken, verifyAuthSession } from "./lib/auth.js";
import { AuthSessionError } from "./graphql/userFacingError.js";

export type GraphQLContext = {
  authenticatedUserId: string | null;
  authenticatedSessionExpiresAt: Date | null;
  prisma: PrismaClient;
  user: User | null;
};

async function getAuthenticatedUserFromRequest(request?: FastifyRequest) {
  const token = readBearerToken(request?.headers.authorization);
  if (!token) {
    return null;
  }
  const session = verifyAuthSession(token);
  if (!session) {
    throw new AuthSessionError(
      "로그인 세션이 만료되었어요. 다시 로그인해 주세요."
    );
  }

  const user = await prisma.user.findUnique({
    where: {
      id: session.userId,
    },
  });

  if (!user) {
    throw new AuthSessionError(
      "로그인 세션이 만료되었어요. 다시 로그인해 주세요."
    );
  }
  // 새 로그인은 기존 세션을 교체하며, 같은 세션에서 갱신한 토큰은 계속 허용한다.
  if (user.activeSessionId !== session.sessionId) {
    throw new AuthSessionError(
      "다른 기기에서 로그인되어 로그아웃됐어요. 다시 로그인해 주세요."
    );
  }
  return { user, expiresAt: new Date(session.exp) };
}

export async function createContext(
  request?: FastifyRequest
): Promise<GraphQLContext> {
  const authenticatedSession = await getAuthenticatedUserFromRequest(request);

  return {
    authenticatedUserId: authenticatedSession?.user.id ?? null,
    authenticatedSessionExpiresAt: authenticatedSession?.expiresAt ?? null,
    prisma,
    user: authenticatedSession?.user ?? null,
  };
}
