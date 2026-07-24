import type { FastifyRequest } from "fastify";
import type { PrismaClient, User } from "@prisma/client";
import { prisma } from "./lib/prisma.js";
import { readBearerToken, verifyAuthToken } from "./lib/auth.js";

export type GraphQLContext = {
  authenticatedUserId: string | null;
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

async function getUserFromRequest(request?: FastifyRequest) {
  const token = readBearerToken(request?.headers.authorization);
  const userId = verifyAuthToken(token);

  if (!userId) {
    return null;
  }

  return prisma.user.findUnique({
    where: {
      id: userId,
    },
  });
}

export async function createContext(
  request?: FastifyRequest
): Promise<GraphQLContext> {
  const authenticatedUser = await getUserFromRequest(request);
  const user = authenticatedUser ?? (await getLocalDevUser());

  return {
    authenticatedUserId: authenticatedUser?.id ?? null,
    prisma,
    user,
  };
}
