import type { PrismaClient } from "@prisma/client";
import { syncPlaceStayStatForRouteStopChange } from "../routes/routeVisit.service.js";
import { deleteRouteVisitPhotoImages } from "../routes/routeVisitPhoto.service.js";

export async function deleteUserAccount(
  prisma: PrismaClient,
  userId: string
) {
  const [ownedRoutes, userLikes, userSaves, userPlacePhotos] = await Promise.all([
    prisma.route.findMany({
      where: {
        ownerId: userId,
      },
      select: {
        id: true,
      },
    }),
    prisma.routeLike.findMany({
      where: {
        userId,
      },
      select: {
        routeId: true,
      },
    }),
    prisma.routeSave.findMany({
      where: {
        userId,
      },
      select: {
        routeId: true,
      },
    }),
    prisma.placePhoto.findMany({
      where: {
        userId,
      },
      select: {
        imageId: true,
      },
    }),
  ]);
  const ownedRouteIds = ownedRoutes.map((route) => route.id);
  const ownedRouteIdSet = new Set(ownedRouteIds);
  const externalLikedRouteIds = userLikes
    .map((like) => like.routeId)
    .filter((routeId) => !ownedRouteIdSet.has(routeId));
  const externalSavedRouteIds = userSaves
    .map((save) => save.routeId)
    .filter((routeId) => !ownedRouteIdSet.has(routeId));
  const ownedRouteStops =
    ownedRouteIds.length > 0
      ? await prisma.routeStop.findMany({
          where: {
            routeId: {
              in: ownedRouteIds,
            },
          },
        })
      : [];
  const visitPhotoImageIds = [
    ...ownedRouteStops.map((stop) => stop.verificationPhotoImageId),
    ...userPlacePhotos.map((photo) => photo.imageId),
  ].filter((imageId): imageId is string => Boolean(imageId));

  await deleteRouteVisitPhotoImages(visitPhotoImageIds);

  await prisma.$transaction(async (transaction) => {
    for (const routeStop of ownedRouteStops) {
      await syncPlaceStayStatForRouteStopChange(transaction, routeStop, null);
    }

    for (const routeId of externalLikedRouteIds) {
      await transaction.route.updateMany({
        where: {
          id: routeId,
          likeCount: {
            gt: 0,
          },
        },
        data: {
          likeCount: {
            decrement: 1,
          },
        },
      });
    }

    for (const routeId of externalSavedRouteIds) {
      await transaction.route.updateMany({
        where: {
          id: routeId,
          saveCount: {
            gt: 0,
          },
        },
        data: {
          saveCount: {
            decrement: 1,
          },
        },
      });
    }

    await transaction.routeLike.deleteMany({
      where: {
        userId,
      },
    });
    await transaction.routeSave.deleteMany({
      where: {
        userId,
      },
    });

    if (ownedRouteIds.length > 0) {
      await transaction.placePhoto.deleteMany({
        where: {
          routeId: {
            in: ownedRouteIds,
          },
        },
      });
      await transaction.routeStop.deleteMany({
        where: {
          routeId: {
            in: ownedRouteIds,
          },
        },
      });
      await transaction.routeDay.deleteMany({
        where: {
          routeId: {
            in: ownedRouteIds,
          },
        },
      });
      await transaction.routeLike.deleteMany({
        where: {
          routeId: {
            in: ownedRouteIds,
          },
        },
      });
      await transaction.routeSave.deleteMany({
        where: {
          routeId: {
            in: ownedRouteIds,
          },
        },
      });
      await transaction.userNotification.deleteMany({
        where: {
          routeId: {
            in: ownedRouteIds,
          },
        },
      });
      await transaction.route.deleteMany({
        where: {
          id: {
            in: ownedRouteIds,
          },
        },
      });
    }

    await transaction.placePhoto.deleteMany({
      where: {
        userId,
      },
    });
    await transaction.userNotification.deleteMany({
      where: {
        userId,
      },
    });
    await transaction.userNotificationSetting.deleteMany({
      where: {
        userId,
      },
    });
    await transaction.pushDevice.deleteMany({
      where: {
        userId,
      },
    });
    await transaction.authAccount.deleteMany({
      where: {
        userId,
      },
    });
    await transaction.user.delete({
      where: {
        id: userId,
      },
    });
  });

  return {
    id: userId,
  };
}
