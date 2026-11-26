import type { PrismaClient, User } from "@prisma/client";
import { UserFacingError } from "../../graphql/userFacingError.js";
import { isDevVerificationBypassEnabled } from "../../lib/devVerification.js";
import { createCloudflareImageStore, type CloudflareImage } from "../images/cloudflareImages.client.js";

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
const CLOUDFLARE_IMAGE_DELETE_TIMEOUT_MS = 10_000;
const TEST_VISIT_PHOTO_URL_PREFIX = "routeone-test://visit-photo";
const VISIT_PHOTO_KIND = "route-stop-visit-photo";

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

  if (isDevVerificationBypassEnabled() && getUploadEnvironmentName() === "dev" && process.env.NODE_ENV !== "production") {
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

function getCloudflareImageDeleteError(
  payload: CloudflareDirectUploadResponse
) {
  return (
    payload.errors
      ?.map((error) => error.message)
      .filter(Boolean)
      .join(", ") || "Cloudflare Images 원본 삭제에 실패했습니다."
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
    throw new UserFacingError("장소를 찾을 수 없습니다.");
  }

  const route = await prisma.route.findUnique({
    where: {
      id: stop.routeId,
    },
  });

  if (!route) {
    throw new UserFacingError("루트를 찾을 수 없습니다.");
  }

  if (route.ownerId !== userId) {
    throw new UserFacingError("루트에 접근할 수 없습니다.");
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
      kind: VISIT_PHOTO_KIND,
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

type VisitPhotoOwner = { userId: string; stopId: string };

function isIssuedVisitPhoto(image: CloudflareImage | null, { userId, stopId }: VisitPhotoOwner) {
  const meta = image?.meta;
  return meta?.kind === VISIT_PHOTO_KIND &&
    meta.environment === getUploadEnvironmentName() &&
    meta.userId === userId && meta.stopId === stopId;
}

/** 발급 대상과 업로드 완료 여부를 확인하고 서버가 조회한 이미지 주소를 저장에 사용한다. */
export async function confirmRouteVisitPhoto(
  owner: VisitPhotoOwner,
  imageId: string | null,
  clientUrl: string | null
) {
  const invalidPhoto = () => new UserFacingError("이 방문지에 업로드한 인증 사진을 확인하지 못했어요.");
  if (!imageId || !clientUrl || !/^[\w-]{1,128}$/.test(imageId)) throw invalidPhoto();

  const config = getCloudflareUploadConfig();
  if (!config) {
    const prefix = `test-${owner.stopId}-`;
    const timestamp = imageId.slice(prefix.length);
    const testUrl = `${TEST_VISIT_PHOTO_URL_PREFIX}/${encodeURIComponent(owner.stopId)}/${timestamp}`;
    if (!imageId.startsWith(prefix) || !/^\d+$/.test(timestamp) ||
      (clientUrl !== testUrl && !/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(clientUrl))) {
      throw invalidPhoto();
    }
    return { imageId, imageUrl: clientUrl };
  }

  const image = await createCloudflareImageStore(config).getImage(imageId);
  if (!image || image.draft || !isIssuedVisitPhoto(image, owner)) throw invalidPhoto();

  const expectedVariant = getCloudflareImageVariantName();
  for (const variant of image.variants ?? []) {
    if (!URL.canParse(variant)) continue;
    const url = new URL(variant);
    if (url.origin !== "https://imagedelivery.net" || url.username || url.password) continue;
    const [, accountHash, deliveredId, name, extra] = url.pathname.split("/");
    if (accountHash && deliveredId === imageId && name === expectedVariant && extra === undefined) {
      return { imageId, imageUrl: `${url.origin}${url.pathname}` };
    }
  }
  throw invalidPhoto();
}

/** 레거시 기록도 발급 소유권을 확인할 수 있을 때만 원본을 삭제한다. */
export async function deleteRouteVisitPhotoImage(owner: VisitPhotoOwner, imageId: string) {
  if (!/^[\w-]{1,128}$/.test(imageId) || imageId.startsWith("test-")) return;

  try {
    const cloudflareConfig = getCloudflareUploadConfig();

    if (!cloudflareConfig) {
      return;
    }

    const image = await createCloudflareImageStore(cloudflareConfig).getImage(imageId);
    if (!isIssuedVisitPhoto(image, owner)) return;
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${cloudflareConfig.accountId}/images/v1/${encodeURIComponent(imageId)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${cloudflareConfig.token}` },
        signal: AbortSignal.timeout(CLOUDFLARE_IMAGE_DELETE_TIMEOUT_MS),
      }
    );
    if (response.status === 404) return;
    const payload = (await response.json()) as CloudflareDirectUploadResponse;
    if (!response.ok || payload.success === false) throw new Error(getCloudflareImageDeleteError(payload));
  } catch (error) {
    console.error(
      "[visit-photo] account image cleanup failed",
      error instanceof Error ? error.message : error
    );
    throw new UserFacingError(
      "인증 사진을 삭제하지 못했어요. 잠시 후 다시 시도해 주세요."
    );
  }
}
