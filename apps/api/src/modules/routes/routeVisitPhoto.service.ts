import type { PrismaClient, User } from "@prisma/client";
import { isDevVerificationBypassEnabled } from "../../lib/devVerification.js";

export type RouteStopVisitPhotoUploadPayload = {
  imageId: string;
  uploadUrl: string;
  imageUrl: string;
  fileName: string;
  environment: string;
  expiresAt: Date;
};

type CloudflareDirectUploadResponse = {
  success?: boolean;
  result?: {
    id?: string;
    uploadURL?: string;
  };
  errors?: Array<{
    message?: string;
  }>;
};

const CLOUDFLARE_DIRECT_UPLOAD_URL_EXPIRY_MS = 1000 * 60 * 30;
const TEST_VISIT_PHOTO_URL_PREFIX = "routeone-test://visit-photo";

function getUploadEnvironmentName() {
  const nodeEnv = process.env.NODE_ENV?.trim().toLowerCase();
  const appEnv =
    process.env.ROUTEONE_ENV?.trim().toLowerCase() ||
    process.env.APP_ENV?.trim().toLowerCase() ||
    nodeEnv;

  return appEnv === "production" || appEnv === "prod" ? "prod" : "dev";
}

function buildVisitPhotoFileName(stopId: string) {
  const environment = getUploadEnvironmentName();
  return `routeone-${environment}-visit-${stopId}-${Date.now()}.jpg`;
}

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} 환경변수가 설정되지 않았습니다.`);
  }

  return value;
}

function getCloudflareImageVariantName() {
  return process.env.CF_IMAGES_VARIANT?.trim() || "public";
}

function getOptionalEnv(name: string) {
  return process.env[name]?.trim() || null;
}

function getCloudflareUploadConfig() {
  const accountId = getOptionalEnv("CF_ACCOUNT");
  const token = getOptionalEnv("CF_TOKEN");

  if (accountId && token) {
    return {
      accountId,
      token,
    };
  }

  if (isDevVerificationBypassEnabled()) {
    return null;
  }

  return {
    accountId: accountId ?? getRequiredEnv("CF_ACCOUNT"),
    token: token ?? getRequiredEnv("CF_TOKEN"),
  };
}

function getCloudflareDirectUploadError(
  payload: CloudflareDirectUploadResponse
) {
  return (
    payload.errors
      ?.map((error) => error.message)
      .filter(Boolean)
      .join(", ") || "Cloudflare Images 업로드 URL 발급에 실패했습니다."
  );
}

function getCloudflareAccountHash(uploadUrl: string) {
  try {
    const url = new URL(uploadUrl);
    return url.pathname.split("/").filter(Boolean)[0] ?? null;
  } catch {
    return null;
  }
}

function buildCloudflareImageUrl(uploadUrl: string, imageId: string) {
  const accountHash = getCloudflareAccountHash(uploadUrl);

  if (!accountHash) {
    return `cloudflare:image:${imageId}`;
  }

  return `https://imagedelivery.net/${accountHash}/${imageId}/${getCloudflareImageVariantName()}`;
}

function buildTestVisitPhotoImageUrl(stopId: string) {
  return `${TEST_VISIT_PHOTO_URL_PREFIX}/${encodeURIComponent(stopId)}/${Date.now()}`;
}

async function assertRouteStopOwner(
  prisma: PrismaClient,
  stopId: string,
  userId: string
) {
  const stop = await prisma.routeStop.findUnique({
    where: {
      id: stopId,
    },
  });

  if (!stop) {
    throw new Error("장소를 찾을 수 없습니다.");
  }

  const route = await prisma.route.findUnique({
    where: {
      id: stop.routeId,
    },
  });

  if (!route) {
    throw new Error("루트를 찾을 수 없습니다.");
  }

  if (route.ownerId !== userId) {
    throw new Error("루트에 접근할 수 없습니다.");
  }
}

export async function createRouteStopVisitPhotoUpload(
  prisma: PrismaClient,
  user: User,
  stopId: string
): Promise<RouteStopVisitPhotoUploadPayload> {
  await assertRouteStopOwner(prisma, stopId, user.id);

  const cloudflareConfig = getCloudflareUploadConfig();
  const environment = getUploadEnvironmentName();
  const fileName = buildVisitPhotoFileName(stopId);

  if (!cloudflareConfig) {
    const imageId = `test-${stopId}-${Date.now()}`;

    return {
      imageId,
      uploadUrl: "",
      imageUrl: buildTestVisitPhotoImageUrl(stopId),
      fileName,
      environment,
      expiresAt: new Date(Date.now() + CLOUDFLARE_DIRECT_UPLOAD_URL_EXPIRY_MS),
    };
  }

  const formData = new FormData();
  const expiresAt = new Date(
    Date.now() + CLOUDFLARE_DIRECT_UPLOAD_URL_EXPIRY_MS
  );

  formData.set("requireSignedURLs", "false");
  formData.set(
    "metadata",
    JSON.stringify({
      kind: "route-stop-visit-photo",
      environment,
      fileName,
      stopId,
      userId: user.id,
    })
  );

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${cloudflareConfig.accountId}/images/v2/direct_upload`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cloudflareConfig.token}`,
      },
      body: formData,
    }
  );
  const payload = (await response.json()) as CloudflareDirectUploadResponse;
  const imageId = payload.result?.id;
  const uploadUrl = payload.result?.uploadURL;

  if (!response.ok || !payload.success || !imageId || !uploadUrl) {
    throw new Error(getCloudflareDirectUploadError(payload));
  }

  return {
    imageId,
    uploadUrl,
    imageUrl: buildCloudflareImageUrl(uploadUrl, imageId),
    fileName,
    environment,
    expiresAt,
  };
}
