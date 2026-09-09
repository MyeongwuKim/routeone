/**
 * 용도: 업로드 후 충분한 시간이 지났고 DB에서 사용하지 않는 RouteOne 이미지를 정리한다.
 * 동작 방식: routeone- 파일명·환경·업로드 시각·참조를 확인하고 삭제 직전에 다시 검사한다.
 * 기본은 삭제 없는 점검 모드이며, 최근 업로드까지 보는 옵션은 점검에서만 허용한다.
 * 목록이나 DB 조회 실패 시 삭제를 진행하지 않는다.
 */
import type { CloudflareImage, CloudflareImageStore } from "./cloudflareImages.client.js";

export const DEFAULT_IMAGE_GRACE_HOURS = 24;
export const DEFAULT_IMAGE_MAX_DELETES = 100;

export type ImageCleanupOptions = {
  environment: "dev" | "prod";
  graceHours?: number;
  maxDeletes?: number;
  dryRun?: boolean;
  includeRecent?: boolean;
  now?: Date;
};

function isRouteOneCleanupImage(image: CloudflareImage, environment: string, cutoff: Date | null) {
  const uploadedAt = image.uploaded ? Date.parse(image.uploaded) : NaN;
  return image.filename?.startsWith("routeone-") === true &&
    image.meta?.kind === "route-stop-visit-photo" &&
    image.meta.environment === environment &&
    !image.draft && Number.isFinite(uploadedAt) &&
    (cutoff === null || uploadedAt < cutoff.getTime());
}

export async function cleanupOrphanImages({
  images,
  isReferenced,
  onDeleted,
}: {
  images: CloudflareImageStore;
  isReferenced: (id: string) => Promise<boolean>;
  onDeleted?: (id: string) => void;
}, options: ImageCleanupOptions) {
  const graceHours = options.graceHours ?? DEFAULT_IMAGE_GRACE_HOURS;
  const maxDeletes = options.maxDeletes ?? DEFAULT_IMAGE_MAX_DELETES;
  const dryRun = options.dryRun ?? true;
  const includeRecent = options.includeRecent ?? false;
  const now = options.now ?? new Date();
  if (!Number.isFinite(now.getTime()) || !["dev", "prod"].includes(options.environment) ||
      !Number.isSafeInteger(graceHours) || graceHours < DEFAULT_IMAGE_GRACE_HOURS ||
      !Number.isSafeInteger(maxDeletes) || maxDeletes < 1) {
    throw new Error("Image cleanup requires dev/prod, a valid time, at least 24 grace hours, and a positive delete limit.");
  }
  if (includeRecent && !dryRun) {
    throw new Error("Including recent images is only allowed in dry-run mode. Set IMAGE_CLEANUP_DRY_RUN=true.");
  }
  const cutoff = new Date(now.getTime() - graceHours * 60 * 60 * 1000);
  const inspectionCutoff = includeRecent ? null : cutoff;
  const allImages = await images.listImages(options.environment);
  const candidates: CloudflareImage[] = [];
  let referencedCount = 0;
  let skippedCount = 0;
  // 모든 페이지와 후보 참조 조회를 마치기 전에는 삭제하지 않는다.
  for (const image of allImages) {
    if (!isRouteOneCleanupImage(image, options.environment, inspectionCutoff)) {
      skippedCount++;
    } else if (await isReferenced(image.id)) {
      referencedCount++;
    } else {
      candidates.push(image);
    }
  }
  const result = {
    environment: options.environment, dryRun, includeRecent,
    cutoffAt: inspectionCutoff?.toISOString() ?? null,
    scannedCount: allImages.length, skippedCount, referencedCount,
    candidateCount: candidates.length, deletedCount: 0, missingCount: 0,
    preservedOnRecheckCount: 0,
    candidateIds: candidates.slice(0, maxDeletes).map((image) => image.id),
  };
  if (dryRun) return result;
  // 잘못된 환경·DB 연결로 한꺼번에 대량 삭제하는 것을 막는다. 점검 후 명시적으로 올릴 수 있다.
  if (candidates.length > maxDeletes) {
    throw new Error(`Image cleanup found ${candidates.length} candidates, exceeding the delete limit ${maxDeletes}. Run a dry run before raising IMAGE_CLEANUP_MAX_DELETES.`);
  }
  for (const candidate of candidates) {
    const latest = await images.getImage(candidate.id);
    if (!latest) {
      result.missingCount++;
      continue;
    }
    if (!isRouteOneCleanupImage(latest, options.environment, cutoff) || await isReferenced(candidate.id)) {
      result.preservedOnRecheckCount++;
      continue;
    }
    if (await images.deleteImage(candidate.id)) {
      result.deletedCount++;
      onDeleted?.(candidate.id);
    } else {
      result.missingCount++;
    }
  }
  return result;
}
