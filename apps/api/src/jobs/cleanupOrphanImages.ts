/**
 * 호출 위치: Cloud Scheduler → Cloud Run Job 또는 로컬 점검 명령
 * 용도: 고아 이미지 정리 설정을 읽고 실행 결과와 삭제한 이미지 ID를 로그로 남긴다.
 * --include-recent를 붙이면 점검 모드에서 유예 시간 전의 사진도 조회한다.
 */
import "dotenv/config";
import { parseArgs } from "node:util";
import { prisma } from "../lib/prisma.js";
import { createCloudflareImageStore } from "../modules/images/cloudflareImages.client.js";
import { isImageReferenced } from "../modules/images/imageReference.repository.js";
import { cleanupOrphanImages } from "../modules/images/orphanImageCleanup.service.js";

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

async function run() {
  const { values } = parseArgs({
    options: { "include-recent": { type: "boolean", default: false } },
  });
  const environment = requiredEnv("IMAGE_CLEANUP_ENVIRONMENT");
  if (environment !== "dev" && environment !== "prod") {
    throw new Error("IMAGE_CLEANUP_ENVIRONMENT must be dev or prod.");
  }
  const dryRunValue = process.env.IMAGE_CLEANUP_DRY_RUN?.trim() ?? "true";
  if (dryRunValue !== "true" && dryRunValue !== "false") {
    throw new Error("IMAGE_CLEANUP_DRY_RUN must be true or false.");
  }
  requiredEnv("DATABASE_URL");
  const images = createCloudflareImageStore({
    accountId: requiredEnv("CF_ACCOUNT"), token: requiredEnv("CF_TOKEN"),
  });
  const result = await cleanupOrphanImages({
    images,
    isReferenced: (id) => isImageReferenced(prisma, id),
    onDeleted: (imageId) => console.log(JSON.stringify({ event: "orphan-image-cleanup.deleted", imageId })),
  }, {
    environment,
    dryRun: dryRunValue === "true",
    includeRecent: values["include-recent"],
    graceHours: process.env.IMAGE_CLEANUP_GRACE_HOURS === undefined ? undefined : Number(process.env.IMAGE_CLEANUP_GRACE_HOURS),
    maxDeletes: process.env.IMAGE_CLEANUP_MAX_DELETES === undefined ? undefined : Number(process.env.IMAGE_CLEANUP_MAX_DELETES),
  });
  console.log(JSON.stringify({ event: "orphan-image-cleanup.completed", ...result }));
}

try {
  await run();
} catch (error) {
  console.error(JSON.stringify({
    event: "orphan-image-cleanup.failed",
    message: error instanceof Error ? error.message : "Unknown cleanup error",
  }));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
