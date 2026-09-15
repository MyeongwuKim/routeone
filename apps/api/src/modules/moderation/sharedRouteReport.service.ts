/**
 * 용도:
 * 공유 루트 신고와 운영자 검토 상태를 관리한다.
 *
 * 동작 방식:
 * 신고자별 대기 기록과 루트 요약을 보관하고, OWNER가 숨김 처리하면
 * 공개 루트와 연결된 방문 사진을 비공개로 전환해 다시 공유되지 않게 한다.
 */
import type {
  Prisma,
  PrismaClient,
  SharedRouteModerationAction,
  SharedRouteReportReason,
  User,
} from "@prisma/client";
import { UserFacingError } from "../../graphql/userFacingError.js";

const MAX_REPORT_DETAILS_LENGTH = 500;
const REPORTABLE_REASONS = new Set<SharedRouteReportReason>([
  "INAPPROPRIATE",
  "MISLEADING",
  "SPAM",
  "HARASSMENT_OR_HATE",
  "PRIVACY_OR_RIGHTS",
  "OTHER",
]);

function normalizeReportDetails(
  reason: SharedRouteReportReason,
  details?: string | null
) {
  const normalized = details?.trim() || null;

  if (normalized && normalized.length > MAX_REPORT_DETAILS_LENGTH) {
    throw new UserFacingError("신고 사유는 500자 이내로 입력해 주세요.");
  }

  if (reason === "OTHER" && !normalized) {
    throw new UserFacingError("기타 사유를 입력해 주세요.");
  }

  return normalized;
}

async function getRoutePlaceTitles(
  prisma: PrismaClient | Prisma.TransactionClient,
  routeId: string
) {
  const stops = await prisma.routeStop.findMany({
    where: { routeId },
    orderBy: { order: "asc" },
    select: { place: true },
  });

  return [...new Set(stops.map((stop) => stop.place.title).filter(Boolean))];
}

export async function reportSharedRoute(
  prisma: PrismaClient,
  reporter: User,
  routeId: string,
  reason: SharedRouteReportReason,
  details?: string | null
) {
  if (!REPORTABLE_REASONS.has(reason)) {
    throw new UserFacingError("신고 사유를 다시 선택해 주세요.");
  }

  const route = await prisma.route.findFirst({
    where: { id: routeId, visibility: "PUBLIC" },
  });

  if (!route) {
    throw new UserFacingError("신고할 수 없는 공유 루트입니다.");
  }
  if (route.ownerId === reporter.id) {
    throw new UserFacingError("내 공유 루트는 신고할 수 없습니다.");
  }

  const normalizedDetails = normalizeReportDetails(reason, details);
  const routePlaceTitles = await getRoutePlaceTitles(prisma, route.id);

  return prisma.sharedRouteReport.upsert({
    where: { routeId_reporterId: { routeId, reporterId: reporter.id } },
    create: {
      routeId,
      reporterId: reporter.id,
      reportedUserId: route.ownerId,
      reason,
      details: normalizedDetails,
      routePlaceTitles,
      routeTripDays: route.tripDays,
    },
    update: {
      reason,
      details: normalizedDetails,
      status: "PENDING",
      routePlaceTitles,
      routeTripDays: route.tripDays,
      moderationAction: null,
      resolvedById: null,
      resolvedAt: null,
    },
  });
}

export async function getReportedSharedRouteIds(
  prisma: PrismaClient,
  reporterId: string
) {
  const reports = await prisma.sharedRouteReport.findMany({
    where: { reporterId, status: "PENDING" },
    select: { routeId: true },
  });

  return reports.map((report) => report.routeId);
}

export async function hasReportedSharedRoute(
  prisma: PrismaClient,
  reporterId: string,
  routeId: string
) {
  return Boolean(
    await prisma.sharedRouteReport.findFirst({
      where: { reporterId, routeId, status: "PENDING" },
      select: { id: true },
    })
  );
}

export async function getPendingSharedRouteReportQueue(prisma: PrismaClient) {
  const reports = await prisma.sharedRouteReport.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });
  const grouped = new Map<string, typeof reports>();

  for (const report of reports) {
    const group = grouped.get(report.routeId) ?? [];
    group.push(report);
    grouped.set(report.routeId, group);
  }

  const ownerIds = [...new Set(reports.map((report) => report.reportedUserId))];
  const owners = await prisma.user.findMany({
    where: { id: { in: ownerIds } },
    select: { id: true, displayName: true, email: true },
  });
  const ownerById = new Map(owners.map((owner) => [owner.id, owner]));

  return [...grouped.entries()].map(([routeId, routeReports]) => {
    const latest = routeReports[0];

    return {
      routeId,
      placeTitles: latest.routePlaceTitles,
      tripDays: latest.routeTripDays,
      owner: ownerById.get(latest.reportedUserId) ?? null,
      reportCount: routeReports.length,
      reasons: [...new Set(routeReports.map((report) => report.reason))],
      details: routeReports
        .map((report) => report.details)
        .filter((value): value is string => Boolean(value)),
      latestReportedAt: latest.createdAt,
    };
  });
}

async function resolvePendingReports(
  prisma: PrismaClient | Prisma.TransactionClient,
  ownerId: string,
  routeId: string,
  action: SharedRouteModerationAction
) {
  return prisma.sharedRouteReport.updateMany({
    where: { routeId, status: "PENDING" },
    data: {
      status: action === "DISMISSED" ? "DISMISSED" : "ACTIONED",
      moderationAction: action,
      resolvedById: ownerId,
      resolvedAt: new Date(),
    },
  });
}

export async function moderateSharedRoute(
  prisma: PrismaClient,
  owner: User,
  routeId: string,
  action: SharedRouteModerationAction
) {
  const pendingCount = await prisma.sharedRouteReport.count({
    where: { routeId, status: "PENDING" },
  });

  if (pendingCount === 0) {
    throw new UserFacingError("처리할 신고가 없습니다.");
  }

  if (action === "DISMISSED") {
    await resolvePendingReports(prisma, owner.id, routeId, action);
    return { routeId, action };
  }

  await prisma.$transaction(async (transaction) => {
    await transaction.route.updateMany({
      where: { id: routeId },
      data: {
        visibility: "PRIVATE",
        sharedAt: null,
        moderationHiddenAt: new Date(),
        moderationHiddenById: owner.id,
      },
    });
    await transaction.placePhoto.updateMany({
      where: { routeId },
      data: {
        routeVisibility: "PRIVATE",
        publicationConsent: false,
        publishedAt: null,
      },
    });
    await transaction.routeStop.updateMany({
      where: { routeId },
      data: {
        verificationPhotoPublicationConsent: false,
        verificationPhotoPublishedAt: null,
      },
    });
    await resolvePendingReports(transaction, owner.id, routeId, action);
  });

  return { routeId, action };
}

export async function assertSharedRouteCanBePublished(
  prisma: PrismaClient | Prisma.TransactionClient,
  routeId: string
) {
  const route = await prisma.route.findUnique({
    where: { id: routeId },
    select: { moderationHiddenAt: true },
  });

  if (route?.moderationHiddenAt) {
    throw new UserFacingError(
      "운영 정책에 따라 숨김 처리된 루트는 다시 공유할 수 없습니다."
    );
  }
}
