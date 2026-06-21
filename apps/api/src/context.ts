import type { FastifyRequest } from "fastify";
import type { PrismaClient, User } from "@prisma/client";
import { prisma } from "./lib/prisma.js";
import { readBearerToken, verifyAuthToken } from "./lib/auth.js";

export type GraphQLContext = {
  prisma: PrismaClient;
  user: User;
};

const LOCAL_DEV_USER_EMAIL = "local@routeone.dev";

async function getLocalDevUser() {
  return prisma.user.upsert({
    where: {
      email: LOCAL_DEV_USER_EMAIL,
    },
    update: {},
    create: {
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
  const user = (await getUserFromRequest(request)) ?? (await getLocalDevUser());

  return {
    prisma,
    user,
  };
}
