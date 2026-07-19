import type { PrismaClient, User } from "@prisma/client";
import {
  assertRouteOwner,
  buildRouteShareTags,
  refreshRouteProgress,
} from "./route.shared.js";
import {
  buildRouteStopVisitDataFromStop,
  syncPlacePhotoForRouteStopVisit,
} from "./routeVisit.service.js";

export async function shareRoute(
  prisma: PrismaClient,
  user: User,
  routeId: string
) {
  const route = await assertRouteOwner(prisma, routeId, user.id);
  const refreshedRoute = await refreshRouteProgress(prisma, route.id);
  const routeStops = await prisma.routeStop.findMany({
    where: {
      routeId: route.id,
    },
    orderBy: {
      order: "asc",
    },
  });

  if (refreshedRoute.status !== "COMPLETED") {
    throw new Error("완료한 루트만 공유할 수 있습니다.");
  }

  const shareTags = buildRouteShareTags(refreshedRoute, routeStops);

  return prisma.$transaction(async (transaction) => {
    const sharedRoute = await transaction.route.update({
      where: {
        id: routeId,
      },
      data: {
        visibility: "PUBLIC",
        sharedAt: refreshedRoute.sharedAt ?? new Date(),
        shareTags,
      },
    });

    for (const stop of routeStops) {
      await syncPlacePhotoForRouteStopVisit(
        transaction,
        user,
        sharedRoute,
        stop,
        buildRouteStopVisitDataFromStop(stop)
      );
    }

    return sharedRoute;
  });
}

async function readRouteInteraction(
  prisma: PrismaClient,
  userId: string,
  routeId: string
) {
  const [route, like, save] = await Promise.all([
    prisma.route.findUnique({
      where: {
        id: routeId,
      },
    }),
    prisma.routeLike.findUnique({
      where: {
        userId_routeId: {
          userId,
          routeId,
        },
      },
    }),
    prisma.routeSave.findUnique({
      where: {
        userId_routeId: {
          userId,
          routeId,
        },
      },
    }),
  ]);

  if (!route) {
    throw new Error("루트를 찾을 수 없습니다.");
  }

  return {
    route,
    liked: Boolean(like),
    saved: Boolean(save),
  };
}

export async function setRouteLike(
  prisma: PrismaClient,
  user: User,
  routeId: string,
  liked: boolean
) {
  const existing = await prisma.routeLike.findUnique({
    where: {
      userId_routeId: {
        userId: user.id,
        routeId,
      },
    },
  });

  if (liked && !existing) {
    await prisma.routeLike.create({
      data: {
        userId: user.id,
        routeId,
      },
    });
    await prisma.route.update({
      where: {
        id: routeId,
      },
      data: {
        likeCount: {
          increment: 1,
        },
      },
    });
  }

  if (!liked && existing) {
    await prisma.routeLike.delete({
      where: {
        id: existing.id,
      },
    });
    await prisma.route.update({
      where: {
        id: routeId,
      },
      data: {
        likeCount: {
          decrement: 1,
        },
      },
    });
  }

  return readRouteInteraction(prisma, user.id, routeId);
}

export async function setRouteSave(
  prisma: PrismaClient,
  user: User,
  routeId: string,
  saved: boolean
) {
  const existing = await prisma.routeSave.findUnique({
    where: {
      userId_routeId: {
        userId: user.id,
        routeId,
      },
    },
  });

  if (saved && !existing) {
    await prisma.routeSave.create({
      data: {
        userId: user.id,
        routeId,
      },
    });
    await prisma.route.update({
      where: {
        id: routeId,
      },
      data: {
        saveCount: {
          increment: 1,
        },
      },
    });
  }

  if (!saved && existing) {
    await prisma.routeSave.delete({
      where: {
        id: existing.id,
      },
    });
    await prisma.route.update({
      where: {
        id: routeId,
      },
      data: {
        saveCount: {
          decrement: 1,
        },
      },
    });
  }

  return readRouteInteraction(prisma, user.id, routeId);
}
