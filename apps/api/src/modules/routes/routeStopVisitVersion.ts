import { Prisma, type PrismaClient, type RouteStop } from "@prisma/client";
import { RouteStopVisitConflictError } from "../../graphql/userFacingError.js";

type VisitSnapshot = Pick<RouteStop, "id" | "visitStatus" | "visitRevision">;

/** 누락·null인 이전 MongoDB 문서도 0번으로 비교하며 상태가 돌아온 경우는 번호로 구분한다. */
function versionWhere(stop: VisitSnapshot): Prisma.RouteStopWhereInput {
  const revision = stop.visitRevision ?? 0;
  return {
    visitStatus: stop.visitStatus,
    ...(revision === 0 ? {
      OR: [{ visitRevision: 0 }, { visitRevision: null }, { visitRevision: { isSet: false } }],
    } : { visitRevision: revision }),
  };
}

/** 조회했던 방문 상태·번호가 그대로일 때만 기록과 다음 번호를 한 번에 저장한다. */
export async function updateRouteStopVisitVersion(
  prisma: PrismaClient | Prisma.TransactionClient,
  stop: VisitSnapshot,
  data: Prisma.RouteStopUncheckedUpdateInput
) {
  try {
    return await prisma.routeStop.update({
      where: { ...versionWhere(stop), id: stop.id },
      data: { ...data, visitRevision: (stop.visitRevision ?? 0) + 1 },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new RouteStopVisitConflictError();
    }
    throw error;
  }
}

/** 같은 상태·번호끼리 묶어서 갱신하고, 일부가 바뀌었으면 호출자의 트랜잭션 전체를 취소한다. */
export async function updateRouteStopVisitVersions(
  transaction: Prisma.TransactionClient,
  stops: VisitSnapshot[],
  data: Prisma.RouteStopUpdateManyMutationInput
) {
  const groups = new Map<string, VisitSnapshot[]>();
  for (const stop of stops) {
    const key = `${stop.visitStatus}:${stop.visitRevision ?? 0}`;
    const group = groups.get(key) ?? [];
    group.push(stop);
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    const stop = group[0]!;
    const result = await transaction.routeStop.updateMany({
      where: { id: { in: group.map(item => item.id) }, ...versionWhere(stop) },
      data: { ...data, visitRevision: (stop.visitRevision ?? 0) + 1 },
    });
    if (result.count !== group.length) throw new RouteStopVisitConflictError();
  }
}
