import type { FastifyRequest } from "fastify";
import type { PrismaClient, User } from "@prisma/client";
import { prisma } from "./lib/prisma.js";
import { readBearerToken, verifyAuthSession } from "./lib/auth.js";

export type GraphQLContext = {
  authenticatedUserId: string | null;
  authenticatedSessionExpiresAt: Date | null;
  prisma: PrismaClient;
  user: User;
};

const LOCAL_DEV_USER_EMAIL = "local@routeone.dev";

async function getLocalDevUser() {
  const existingUser = await prisma.user.findFirst({
    where: {
      email: LOCAL_DEV_USER_EMAIL,
    },
  });

  if (existingUser) {
    return existingUser;
  }

  return prisma.user.create({
    data: {
      email: LOCAL_DEV_USER_EMAIL,
      displayName: "RouteOne Local User",
      locale: "ko",
    },
  });
}

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
  const user = authenticatedSession?.user ?? (await getLocalDevUser());

  return {
    authenticatedUserId: authenticatedSession?.user.id ?? null,
    authenticatedSessionExpiresAt: authenticatedSession?.expiresAt ?? null,
    prisma,
    user,
  };
}
