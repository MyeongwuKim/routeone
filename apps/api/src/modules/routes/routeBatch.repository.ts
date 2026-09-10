/**
 * 용도:
 * 일정 구성 변경에서 DAY·장소를 묶어서 저장하고 삭제된 방문의 통계를 정리한다.
 *
 * 동작 방식:
 * 새 DAY의 ID는 저장 전에 정해 장소와 연결한다. 수정은 바뀐 필드만 전송하고,
 * 방문 통계는 장소별로 합산해 현재 값에서 한 번에 차감한다.
 */
import { randomBytes } from "node:crypto";
import type { Prisma, RouteStop } from "@prisma/client";
import {
  mongoDocument, mongoId, runMongoUpdates, type MongoUpdate,
} from "../../lib/mongoBatch.js";
import {
  buildPlaceStayStatSnapshotData, getPrimaryPlaceStayStatKey,
} from "./route.shared.js";

export async function createRouteDaysBatch(
  transaction: Prisma.TransactionClient,
  data: Prisma.RouteDayCreateManyInput[]
) {
  const days = data.map((day) => ({ ...day, id: randomBytes(12).toString("hex") }));
  if (days.length) await transaction.routeDay.createMany({ data: days });
  return days;
}

export function changedFields(current: object, next: Record<string, unknown>) {
  const previous = current as Record<string, unknown>;
  return Object.fromEntries(Object.entries(next).filter(([key, value]) =>
    JSON.stringify(previous[key] ?? null) !== JSON.stringify(value ?? null)
  ));
}

export async function updateRouteRowsBatch(
  transaction: Prisma.TransactionClient,
  collection: "RouteDay" | "RouteStop",
  routeId: string,
  rows: { id: string; data: Record<string, unknown> }[]
) {
  await runMongoUpdates(transaction, collection, rows
    .filter((row) => Object.keys(row.data).length > 0)
    .map((row) => ({
      q: { _id: mongoId(row.id), routeId: mongoId(routeId) },
      u: { $set: mongoDocument({ ...row.data, updatedAt: new Date() }, ["dayId"]) },
    })), true);
}

export async function removeRouteStopStayContributions(
  transaction: Prisma.TransactionClient,
  stops: Pick<RouteStop, "place" | "visitStatus" | "actualStayMinutes" | "stayStatSyncedAt">[]
) {
  const groups = new Map<string, { minutes: number; count: number; place: RouteStop["place"] }>();
  for (const stop of stops) {
    const minutes = stop.actualStayMinutes ?? 0;
    if (!stop.stayStatSyncedAt || stop.visitStatus !== "VISITED" || minutes <= 0) continue;
    const key = getPrimaryPlaceStayStatKey(stop.place);
    if (!key) continue;
    const previous = groups.get(key);
    groups.set(key, {
      minutes: (previous?.minutes ?? 0) + minutes,
      count: (previous?.count ?? 0) + 1,
      place: stop.place,
    });
  }
  const updates: MongoUpdate[] = [...groups].map(([placeKey, group]) => ({
    q: { placeKey },
    u: [
      {
        $set: {
          ...Object.fromEntries(Object.entries(mongoDocument(buildPlaceStayStatSnapshotData(group.place)))
            .map(([key, value]) => [key, { $literal: value }])),
          updatedAt: { $date: new Date().toISOString() },
          totalActualStayMinutes: { $max: [0, { $subtract: [{ $ifNull: ["$totalActualStayMinutes", 0] }, group.minutes] }] },
          visitCount: { $max: [0, { $subtract: [{ $ifNull: ["$visitCount", 0] }, group.count] }] },
        }
      },
      { $set: { lastVisitedAt: { $cond: [{ $eq: ["$visitCount", 0] }, null, "$lastVisitedAt"] } } },
    ],
  }));
  await runMongoUpdates(transaction, "PlaceStayStat", updates);
}
