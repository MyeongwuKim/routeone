/**
 * 용도:
 * 방문 인증 사진 신고와 운영자 검토 상태를 관리한다.
 *
 * 동작 방식:
 * 신고 자체는 원본 공개 상태를 바꾸지 않고 신고자별 대기 기록만 남긴다.
 * 전체 숨김·삭제는 OWNER가 검토 작업을 실행했을 때만 반영한다.
 */
import type {
  PlacePhotoModerationAction,
  PlacePhotoReportReason,
  Prisma,
  PrismaClient,
  User,
} from "@prisma/client";
import { UserFacingError } from "../../graphql/userFacingError.js";
import { deleteRouteVisitPhotoImages } from "../routes/routeVisitPhoto.service.js";

const MAX_REPORT_DETAILS_LENGTH = 500;
const REPORTABLE_REASONS = new Set<PlacePhotoReportReason>([
  "INAPPROPRIATE",
  "VIOLENCE_OR_HATE",
  "PRIVACY",
  "SPAM",
  "OTHER",
]);

function normalizeReportDetails(
  reason: PlacePhotoReportReason,
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

export async function reportPlacePhoto(
  prisma: PrismaClient,
  reporter: User,
  photoId: string,
  reason: PlacePhotoReportReason,
  details?: string | null
) {
  if (!REPORTABLE_REASONS.has(reason)) {
    throw new UserFacingError("신고 사유를 다시 선택해 주세요.");
  }

  const photo = await prisma.placePhoto.findUnique({ where: { id: photoId } });

  if (!photo || photo.status !== "ACTIVE") {
    throw new UserFacingError("신고할 수 없는 사진입니다.");
  }
  if (photo.userId === reporter.id) {
    throw new UserFacingError("내가 올린 사진은 신고할 수 없습니다.");
  }

  const normalizedDetails = normalizeReportDetails(reason, details);

  return prisma.placePhotoReport.upsert({
    where: { photoId_reporterId: { photoId, reporterId: reporter.id } },
    create: {
      photoId,
      reporterId: reporter.id,
      reportedUserId: photo.userId,
      reason,
      details: normalizedDetails,
      photoTitle: photo.title,
      photoImageId: photo.imageId,
      photoImageUrl: photo.imageUrl,
      photoThumbnailUrl: photo.thumbnailUrl,
    },
    update: {
      reason,
      details: normalizedDetails,
      status: "PENDING",
      photoTitle: photo.title,
      photoImageId: photo.imageId,
      photoImageUrl: photo.imageUrl,
      photoThumbnailUrl: photo.thumbnailUrl,
      moderationAction: null,
      resolvedById: null,
      canceledAt: null,
      resolvedAt: null,
    },
  });
}

export async function cancelPlacePhotoReport(
  prisma: PrismaClient,
  reporter: User,
  photoId: string
) {
  const report = await prisma.placePhotoReport.findUnique({
    where: { photoId_reporterId: { photoId, reporterId: reporter.id } },
  });

  if (!report || report.status !== "PENDING") {
    throw new UserFacingError("취소할 신고가 없습니다.");
  }

  return prisma.placePhotoReport.update({
    where: { id: report.id },
    data: { status: "CANCELED", canceledAt: new Date() },
  });
}

export async function getMyPendingPhotoReport(
  prisma: PrismaClient,
  reporterId: string,
  photoId: string
) {
  return prisma.placePhotoReport.findFirst({
    where: { photoId, reporterId, status: "PENDING" },
  });
}

export async function getPendingPhotoReportQueue(prisma: PrismaClient) {
  const reports = await prisma.placePhotoReport.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });
  const grouped = new Map<string, typeof reports>();

  for (const report of reports) {
    const group = grouped.get(report.photoId) ?? [];
    group.push(report);
    grouped.set(report.photoId, group);
  }

  const photoIds = [...grouped.keys()];
  const photos = await prisma.placePhoto.findMany({
    where: { id: { in: photoIds } },
  });
  const photoById = new Map(photos.map((photo) => [photo.id, photo]));
  const uploaderIds = [...new Set(reports.map((report) => report.reportedUserId))];
  const uploaders = await prisma.user.findMany({
    where: { id: { in: uploaderIds } },
    select: { id: true, displayName: true, email: true },
  });
  const uploaderById = new Map(uploaders.map((user) => [user.id, user]));

  return [...grouped.entries()].map(([photoId, photoReports]) => {
    const latest = photoReports[0];
    const photo = photoById.get(photoId);

    return {
      photoId,
      title: photo?.title ?? latest.photoTitle,
      imageUrl: photo?.imageUrl ?? latest.photoImageUrl,
      thumbnailUrl:
        photo?.thumbnailUrl ?? latest.photoThumbnailUrl ?? latest.photoImageUrl,
      status: photo?.status ?? "DELETED",
      uploader: uploaderById.get(latest.reportedUserId) ?? null,
      reportCount: photoReports.length,
      reasons: [...new Set(photoReports.map((report) => report.reason))],
      details: photoReports
        .map((report) => report.details)
        .filter((value): value is string => Boolean(value)),
      latestReportedAt: latest.createdAt,
    };
  });
}

async function resolvePendingReports(
  prisma: PrismaClient | Prisma.TransactionClient,
  ownerId: string,
  photoId: string,
  action: PlacePhotoModerationAction
) {
  return prisma.placePhotoReport.updateMany({
    where: { photoId, status: "PENDING" },
    data: {
      status: action === "DISMISSED" ? "DISMISSED" : "ACTIONED",
      moderationAction: action,
      resolvedById: ownerId,
      resolvedAt: new Date(),
    },
  });
}

export async function moderatePlacePhoto(
  prisma: PrismaClient,
  owner: User,
  photoId: string,
  action: PlacePhotoModerationAction
) {
  const pendingCount = await prisma.placePhotoReport.count({
    where: { photoId, status: "PENDING" },
  });

  if (pendingCount === 0) {
    throw new UserFacingError("처리할 신고가 없습니다.");
  }

  if (action === "DISMISSED") {
    await resolvePendingReports(prisma, owner.id, photoId, action);
    return { photoId, action };
  }

  const photo = await prisma.placePhoto.findUnique({ where: { id: photoId } });

  if (!photo) {
    await resolvePendingReports(prisma, owner.id, photoId, action);
    return { photoId, action };
  }

  const routeStop = await prisma.routeStop.findUnique({
    where: { id: photo.routeStopId },
    select: { verificationStatus: true },
  });

  await prisma.$transaction(async (transaction) => {
    await transaction.placePhoto.update({
      where: { id: photoId },
      data: {
        status: action === "DELETED" ? "DELETED" : "HIDDEN",
        publicationConsent: false,
        publishedAt: null,
      },
    });
    await transaction.routeStop.updateMany({
      where: { id: photo.routeStopId },
      data:
        action === "DELETED"
          ? {
              verificationPhotoImageId: null,
              verificationPhotoUrl: null,
              verificationPhotoPublicationConsent: null,
              verificationPhotoPublishedAt: null,
              verificationStatus:
                routeStop?.verificationStatus === "GPS_PHOTO"
                  ? "GPS"
                  : (routeStop?.verificationStatus ?? "NONE"),
            }
          : {
              verificationPhotoPublicationConsent: false,
              verificationPhotoPublishedAt: null,
            },
    });
    await resolvePendingReports(transaction, owner.id, photoId, action);
  });

  if (action === "DELETED" && photo.imageId) {
    await deleteRouteVisitPhotoImages([photo.imageId]).catch(() => undefined);
  }

  return { photoId, action };
}
