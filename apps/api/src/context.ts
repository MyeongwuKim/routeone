import type { PrismaClient, User } from "@prisma/client";
import { prisma } from "./lib/prisma.js";

export type GraphQLContext = {
  prisma: PrismaClient;
  user: User;
};

const LOCAL_DEV_USER_EMAIL = "local@routeone.dev";

export async function createContext(): Promise<GraphQLContext> {
  const user = await prisma.user.upsert({
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

  return {
    prisma,
    user,
  };
}
