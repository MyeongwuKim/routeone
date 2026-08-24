import type { FastifyRequest } from "fastify";
import type { PrismaClient, User } from "@prisma/client";
import { prisma } from "./lib/prisma.js";
import { readBearerToken, verifyAuthSession } from "./lib/auth.js";

export type GraphQLContext = {
  authenticatedUserId: string | null;
  authenticatedSessionExpiresAt: Date | null;
  prisma: PrismaClient;
  user: User | null;
};

async function getAuthenticatedUserFromRequest(request?: FastifyRequest) {
  const token = readBearerToken(request?.headers.authorization);
  const session = verifyAuthSession(token);

  if (!session) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: {
      id: session.userId,
    },
  });

  return user
    ? {
        user,
        expiresAt: new Date(session.exp),
      }
    : null;
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
