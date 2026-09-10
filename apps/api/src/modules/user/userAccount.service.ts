/**
 * 용도:
 * 회원 탈퇴 시 계정과 연결된 DB 기록을 한 트랜잭션에서 정리한다.
 *
 * 동작 방식:
 * 방문 통계와 다른 일정의 좋아요·저장 수를 일괄 차감한 뒤 연결 기록을 지운다.
 * Cloudflare 원본은 남아 있는 참조를 확인하는 고아 이미지 정리 작업에 맡긴다.
 */
import type { PrismaClient } from "@prisma/client";
import { removeRouteStopStayContributions } from "../routes/routeBatch.repository.js";

export async function deleteUserAccount(prisma: PrismaClient, userId: string) {
  await prisma.$transaction(async (transaction) => {
    const ownedRoutes = await transaction.route.findMany({
      where: { ownerId: userId }, select: { id: true },
    });
    const userLikes = await transaction.routeLike.findMany({
      where: { userId }, select: { routeId: true },
    });
    const userSaves = await transaction.routeSave.findMany({
      where: { userId }, select: { routeId: true },
    });
    const ownedRouteIds = ownedRoutes.map((route) => route.id);
    const ownedRouteIdSet = new Set(ownedRouteIds);
    const externalRouteIds = (rows: { routeId: string }[]) =>
      [...new Set(rows.map((row) => row.routeId).filter((id) => !ownedRouteIdSet.has(id)))];
    const likedRouteIds = externalRouteIds(userLikes);
    const savedRouteIds = externalRouteIds(userSaves);

    if (ownedRouteIds.length) {
      const stops = await transaction.routeStop.findMany({
        where: { routeId: { in: ownedRouteIds } },
        select: { place: true, visitStatus: true, actualStayMinutes: true, stayStatSyncedAt: true },
      });
      await removeRouteStopStayContributions(transaction, stops);
    }
    if (likedRouteIds.length) {
      await transaction.route.updateMany({
        where: { id: { in: likedRouteIds }, likeCount: { gt: 0 } },
        data: { likeCount: { decrement: 1 } },
      });
    }
    if (savedRouteIds.length) {
      await transaction.route.updateMany({
        where: { id: { in: savedRouteIds }, saveCount: { gt: 0 } },
        data: { saveCount: { decrement: 1 } },
      });
    }

    const linkedRecords = { OR: [{ userId }, { routeId: { in: ownedRouteIds } }] };
    // PlacePhoto의 ID 필드는 cascade 관계가 아니므로 DB 참조는 명시적으로 삭제한다.
    await transaction.placePhoto.deleteMany({ where: linkedRecords });
    await transaction.routeLike.deleteMany({ where: linkedRecords });
    await transaction.routeSave.deleteMany({ where: linkedRecords });
    await transaction.userNotification.deleteMany({ where: linkedRecords });
    if (ownedRouteIds.length) {
      await transaction.routeStop.deleteMany({ where: { routeId: { in: ownedRouteIds } } });
      await transaction.routeDay.deleteMany({ where: { routeId: { in: ownedRouteIds } } });
      await transaction.route.deleteMany({ where: { id: { in: ownedRouteIds } } });
    }
    await transaction.userNotificationSetting.deleteMany({ where: { userId } });
    await transaction.pushDevice.deleteMany({ where: { userId } });
    await transaction.routeCreateRequest.deleteMany({ where: { ownerId: userId } });
    await transaction.authAccount.deleteMany({ where: { userId } });
    await transaction.user.delete({ where: { id: userId } });
  });
  return { id: userId };
}
