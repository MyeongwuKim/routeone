import type { PrismaClient, Route } from "@prisma/client";
import { hasReportedSharedRoute } from "../moderation/sharedRouteReport.service.js";
import { hasBlockedUser } from "../user/userBlock.service.js";

/** 소유자는 자기 루트를 읽을 수 있고 다른 사용자는 차단하거나 신고하지 않은 공개 루트만 읽을 수 있다. */
export async function canReadRoute(
  prisma: Pick<PrismaClient, "sharedRouteReport" | "userBlock">,
  route: Pick<Route, "id" | "ownerId" | "visibility">,
  viewerId?: string | null
) {
  if (route.ownerId === viewerId) return true;
  if (route.visibility !== "PUBLIC") return false;
  if (!viewerId) return true;

  const [blocked, reported] = await Promise.all([
    hasBlockedUser(prisma, viewerId, route.ownerId),
    hasReportedSharedRoute(prisma, viewerId, route.id),
  ]);
  return !blocked && !reported;
}
