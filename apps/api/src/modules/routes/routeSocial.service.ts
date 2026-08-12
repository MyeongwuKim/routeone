import { Prisma, type PrismaClient, type User } from "@prisma/client";
import { UserFacingError } from "../../graphql/userFacingError.js";
import {
  assertRouteOwner,
  buildRouteShareTags,
  refreshRouteProgress,
} from "./route.shared.js";
import {
  buildRouteStopVisitDataFromStop,
  syncPlacePhotoForRouteStopVisit,
} from "./routeVisit.service.js";

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

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
    throw new UserFacingError("완료한 루트만 공유할 수 있습니다.");
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
    throw new UserFacingError("루트를 찾을 수 없습니다.");
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
  if (liked) {
    try {
      await prisma.routeLike.create({
        data: {
          userId: user.id,
          routeId,
        },
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }
    }
  }

  if (!liked) {
    await prisma.routeLike.deleteMany({
      where: {
        userId: user.id,
        routeId,
      },
    });
  }

  const likeCount = await prisma.routeLike.count({
    where: {
      routeId,
    },
  });

  await prisma.route.update({
    where: {
      id: routeId,
    },
    data: {
      likeCount,
    },
  });

  return readRouteInteraction(prisma, user.id, routeId);
}

export async function setRouteSave(
  prisma: PrismaClient,
  user: User,
  routeId: string,
  saved: boolean
) {
  if (saved) {
    try {
      await prisma.routeSave.create({
        data: {
          userId: user.id,
          routeId,
        },
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }
    }
  }

  if (!saved) {
    await prisma.routeSave.deleteMany({
      where: {
        userId: user.id,
        routeId,
      },
    });
  }

  const saveCount = await prisma.routeSave.count({
    where: {
      routeId,
    },
  });

  await prisma.route.update({
    where: {
      id: routeId,
    },
    data: {
      saveCount,
    },
  });

  return readRouteInteraction(prisma, user.id, routeId);
}
