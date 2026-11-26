/**
 * 용도:
 * 일정 공유와 좋아요·저장 상태를 관리한다.
 * 공유 시 진행 상태와 사진 공개 상태를 같은 트랜잭션에서 함께 반영한다.
 */
import type { Prisma, PrismaClient, Route, User } from "@prisma/client";
import { runTransactionWithRetry } from "../../lib/transaction.js";
import { canReadRoute } from "./routeAccess.js";
import { UserFacingError } from "../../graphql/userFacingError.js";
import { assertSharedRouteCanBePublished } from "../moderation/sharedRouteReport.service.js";
import {
  assertRouteOwner,
  buildRouteShareTags,
  buildRouteProgressData,
  countRouteStops,
} from "./route.shared.js";
import {
  syncPlacePhotosForRouteShare,
} from "./routeVisit.service.js";
import { createSharedStartLocations, type ShareRouteStartLocationInput } from "./routeSharedStartLocation.js";

/** 출발지 확인값과 공개 상태를 함께 저장하며 다시 요청해도 먼저 공개한 좌표를 유지한다. */
export async function shareRoute(
  prisma: PrismaClient,
  user: User,
  routeId: string,
  startLocations: ShareRouteStartLocationInput[]
) {
  return prisma.$transaction(async (transaction) => {
    await assertSharedRouteCanBePublished(transaction, routeId);
    const route = await assertRouteOwner(transaction, routeId, user.id);
    const stops = await transaction.routeStop.findMany({
      where: { routeId }, orderBy: { order: "asc" },
    });
    const progress = buildRouteProgressData(route, countRouteStops(stops));
    if (progress.status !== "COMPLETED") {
      throw new UserFacingError("완료한 루트만 공유할 수 있습니다.");
    }
    const sharedStartLocations = route.visibility === "PUBLIC"
      ? route.sharedStartLocations
      : createSharedStartLocations(await transaction.routeDay.findMany({
          where: { routeId },
          select: { id: true },
          orderBy: { dayIndex: "asc" },
        }), startLocations);
    const sharedRoute = await transaction.route.update({
      where: { id: routeId },
      data: {
        ...progress,
        visibility: "PUBLIC",
        ...(sharedStartLocations ? { sharedStartLocations } : {}),
        sharedAt: route.sharedAt ?? new Date(),
        shareTags: buildRouteShareTags({ ...route, ...progress }, stops),
      },
    });
    await syncPlacePhotosForRouteShare(transaction, user, sharedRoute, stops);
    return sharedRoute;
  });
}

/** 상호작용을 저장하기 전에 상세 조회와 같은 접근 조건을 확인한다. */
async function requireReadableRoute(
  transaction: Prisma.TransactionClient,
  userId: string,
  routeId: string
) {
  const route = await transaction.route.findUnique({ where: { id: routeId } });
  if (!route || !(await canReadRoute(transaction, route, userId))) {
    throw new UserFacingError("루트를 찾을 수 없습니다.");
  }
}

async function readRouteInteraction(
  transaction: Prisma.TransactionClient,
  userId: string,
  route: Route
) {
  const key = { userId_routeId: { userId, routeId: route.id } };
  const [like, save] = await Promise.all([
    transaction.routeLike.findUnique({ where: key }),
    transaction.routeSave.findUnique({ where: key }),
  ]);

  return { route, liked: Boolean(like), saved: Boolean(save) };
}

/** 읽을 수 있는 루트의 좋아요와 집계만 같은 트랜잭션에서 저장한다. */
export async function setRouteLike(
  prisma: PrismaClient,
  user: User,
  routeId: string,
  liked: boolean
) {
  return runTransactionWithRetry(prisma, async (transaction) => {
    await requireReadableRoute(transaction, user.id, routeId);
    const key = { userId: user.id, routeId };
    if (liked) {
      const existing = await transaction.routeLike.findUnique({ where: { userId_routeId: key } });
      if (!existing) await transaction.routeLike.create({ data: key });
    } else {
      await transaction.routeLike.deleteMany({ where: key });
    }

    const likeCount = await transaction.routeLike.count({ where: { routeId } });
    const route = await transaction.route.update({ where: { id: routeId }, data: { likeCount } });
    return readRouteInteraction(transaction, user.id, route);
  });
}

/** 읽을 수 있는 루트의 저장 여부와 집계만 같은 트랜잭션에서 저장한다. */
export async function setRouteSave(
  prisma: PrismaClient,
  user: User,
  routeId: string,
  saved: boolean
) {
  return runTransactionWithRetry(prisma, async (transaction) => {
    await requireReadableRoute(transaction, user.id, routeId);
    const key = { userId: user.id, routeId };
    if (saved) {
      const existing = await transaction.routeSave.findUnique({ where: { userId_routeId: key } });
      if (!existing) await transaction.routeSave.create({ data: key });
    } else {
      await transaction.routeSave.deleteMany({ where: key });
    }

    const saveCount = await transaction.routeSave.count({ where: { routeId } });
    const route = await transaction.route.update({ where: { id: routeId }, data: { saveCount } });
    return readRouteInteraction(transaction, user.id, route);
  });
}
