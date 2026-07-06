import type { PrismaClient, RouteStop, User } from "@prisma/client";
import { isDevVerificationBypassEnabled } from "../../lib/devVerification.js";

export type AnalyzeRouteStopVisitPhotoInput = {
  stopId: string;
  photoUrl: string;
  lat?: number | null;
  lng?: number | null;
  accuracyMeters?: number | null;
};

export type RouteStopVisitPhotoUploadPayload = {
  imageId: string;
  uploadUrl: string;
  imageUrl: string;
  expiresAt: Date;
};

export type RouteStopVisitPhotoAnalysisPayload = {
  decision: "MATCH" | "MAYBE" | "NO" | "SKIPPED";
  confidence: number;
  referenceImageUrls: string[];
  visualEvidence: string[];
  textEvidence: string[];
  mismatchReasons: string[];
  needsReview: boolean;
  skippedReason?: string | null;
};

const CLOUDFLARE_DIRECT_UPLOAD_URL_EXPIRY_MS = 1000 * 60 * 30;
const VISIT_PHOTO_REFERENCE_IMAGE_LIMIT = 5;
const OPENAI_VISIT_PHOTO_MODEL =
  process.env.OPENAI_VISIT_PHOTO_MODEL ??
  process.env.OPENAI_MODEL ??
  "gpt-4.1-mini";
const GOOGLE_PLACE_PHOTO_LIMIT = 2;
const TEST_VISIT_PHOTO_URL_PREFIX = "routeone-test://visit-photo";
const OPENAI_IMAGE_FETCH_MAX_BYTES = 12 * 1024 * 1024;
const OPENAI_IMAGE_FETCH_RETRY_DELAYS_MS = [0, 350, 900];
const SUPPORTED_OPENAI_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

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

type GoogleTextSearchResponse = {
  places?: Array<{
    photos?: Array<{
      name?: string;
    }>;
  }>;
};

type GooglePhotoMediaResponse = {
  photoUri?: string;
};

type OpenAiVisitPhotoResponse = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
};

type VisitPhotoModelVerdict = {
  decision?: "match" | "maybe" | "no";
  confidence?: number;
  visualEvidence?: string[];
  textEvidence?: string[];
  mismatchReasons?: string[];
  needsReview?: boolean;
};

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

function normalizeUrl(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed || null;
}

function normalizeOpenAiDataImageUrl(imageUrl: string) {
  const [metadata, base64Payload] = imageUrl.split(",", 2);
  const mimeType = metadata
    ?.match(/^data:([^;]+);base64$/i)?.[1]
    ?.trim()
    .toLowerCase();

  if (!mimeType || !base64Payload) {
    throw new Error("지원하지 않는 이미지 데이터 형식입니다.");
  }

  const normalizedMimeType = mimeType === "image/jpg" ? "image/jpeg" : mimeType;

  if (!SUPPORTED_OPENAI_IMAGE_MIME_TYPES.has(normalizedMimeType)) {
    throw new Error("지원하지 않는 이미지 형식입니다.");
  }

  const imageBuffer = Buffer.from(base64Payload, "base64");

  if (imageBuffer.byteLength > OPENAI_IMAGE_FETCH_MAX_BYTES) {
    throw new Error("이미지 파일 크기 초과");
  }

  return `data:${normalizedMimeType};base64,${base64Payload}`;
}

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getOpenAiImageMimeType(imageUrl: string, contentType: string | null) {
  const mimeType = contentType?.split(";")[0]?.trim().toLowerCase();

  if (mimeType === "image/jpg") {
    return "image/jpeg";
  }

  if (mimeType && SUPPORTED_OPENAI_IMAGE_MIME_TYPES.has(mimeType)) {
    return mimeType;
  }

  try {
    const pathname = new URL(imageUrl).pathname.toLowerCase();

    if (pathname.endsWith(".png")) {
      return "image/png";
    }

    if (pathname.endsWith(".webp")) {
      return "image/webp";
    }

    if (pathname.endsWith(".gif")) {
      return "image/gif";
    }
  } catch {
    // URL parsing is best-effort here. Fall back to JPEG below.
  }

  return "image/jpeg";
}

async function fetchOpenAiImageDataUrl(imageUrl: string) {
  let lastError: Error | null = null;

  for (const retryDelay of OPENAI_IMAGE_FETCH_RETRY_DELAYS_MS) {
    if (retryDelay > 0) {
      await wait(retryDelay);
    }

    try {
      const response = await fetch(imageUrl);

      if (!response.ok) {
        throw new Error(`이미지 요청 실패: ${response.status}`);
      }

      const contentLength = Number(response.headers.get("content-length"));

      if (
        Number.isFinite(contentLength) &&
        contentLength > OPENAI_IMAGE_FETCH_MAX_BYTES
      ) {
        throw new Error("이미지 파일 크기 초과");
      }

      const imageBuffer = Buffer.from(await response.arrayBuffer());

      if (imageBuffer.byteLength > OPENAI_IMAGE_FETCH_MAX_BYTES) {
        throw new Error("이미지 파일 크기 초과");
      }

      const mimeType = getOpenAiImageMimeType(
        imageUrl,
        response.headers.get("content-type")
      );

      return `data:${mimeType};base64,${imageBuffer.toString("base64")}`;
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error("이미지 요청 실패");
    }
  }

  throw lastError ?? new Error("이미지 요청 실패");
}

async function getOpenAiInputImageUrl(imageUrl: string, required: boolean) {
  try {
    if (imageUrl.startsWith("data:")) {
      return normalizeOpenAiDataImageUrl(imageUrl);
    }

    return await fetchOpenAiImageDataUrl(imageUrl);
  } catch (error) {
    if (required) {
      throw new Error(
        `촬영 사진을 판별용 이미지로 불러오지 못했어요: ${
          error instanceof Error ? error.message : "이미지 요청 실패"
        }`
      );
    }

    return null;
  }
}

function uniqueImageUrls(urls: Array<string | null | undefined>) {
  const unique = new Set<string>();

  urls.forEach((url) => {
    const normalizedUrl = normalizeUrl(url);

    if (normalizedUrl) {
      unique.add(normalizedUrl);
    }
  });

  return Array.from(unique);
}

function getOpenAiText(payload: OpenAiVisitPhotoResponse) {
  if (payload.output_text) {
    return payload.output_text;
  }

  return (
    payload.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text)
      .filter(Boolean)
      .join("\n")
      .trim() ?? ""
  );
}

function getStringList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function normalizeVisitPhotoVerdict(
  verdict: VisitPhotoModelVerdict
): RouteStopVisitPhotoAnalysisPayload {
  const decision = verdict.decision ?? "maybe";
  const confidence = Number(verdict.confidence);

  return {
    decision:
      decision === "match" ? "MATCH" : decision === "no" ? "NO" : "MAYBE",
    confidence: Number.isFinite(confidence)
      ? Math.max(0, Math.min(1, confidence))
      : 0,
    referenceImageUrls: [],
    visualEvidence: getStringList(verdict.visualEvidence),
    textEvidence: getStringList(verdict.textEvidence),
    mismatchReasons: getStringList(verdict.mismatchReasons),
    needsReview: Boolean(verdict.needsReview),
    skippedReason: null,
  };
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

  return stop;
}

async function getPreviousVisitPhotoReferenceUrls(
  prisma: PrismaClient,
  stop: RouteStop,
  currentPhotoUrl: string
) {
  const placeFilters: unknown[] = [];

  if (stop.place.contentId) {
    placeFilters.push({
      place: {
        is: {
          provider: stop.place.provider,
          contentId: stop.place.contentId,
          ...(stop.place.contentTypeId
            ? {
                contentTypeId: stop.place.contentTypeId,
              }
            : {}),
        },
      },
    });
  }

  if (stop.place.externalId) {
    placeFilters.push({
      place: {
        is: {
          provider: stop.place.provider,
          externalId: stop.place.externalId,
        },
      },
    });
  }

  if (!placeFilters.length) {
    placeFilters.push({
      place: {
        is: {
          provider: stop.place.provider,
          title: stop.place.title,
          address: stop.place.address,
        },
      },
    });
  }

  try {
    const previousStops = await prisma.routeStop.findMany({
      where: {
        id: {
          not: stop.id,
        },
        verificationStatus: "GPS_PHOTO",
        verificationPhotoUrl: {
          not: null,
        },
        OR: placeFilters as never,
      },
      orderBy: {
        verifiedAt: "desc",
      },
      take: VISIT_PHOTO_REFERENCE_IMAGE_LIMIT,
    });

    return uniqueImageUrls(
      previousStops.map((previousStop) => previousStop.verificationPhotoUrl)
    ).filter((url) => url !== currentPhotoUrl);
  } catch {
    return [];
  }
}

async function getGooglePlacePhotoReferenceUrls(stop: RouteStop) {
  const googleApiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();

  if (!googleApiKey) {
    return [];
  }

  const query = [stop.place.title, stop.place.address]
    .filter(Boolean)
    .join(" ");

  if (!query) {
    return [];
  }

  try {
    const searchResponse = await fetch(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": googleApiKey,
          "X-Goog-FieldMask": "places.photos",
        },
        body: JSON.stringify({
          textQuery: query,
          languageCode: "ko",
          maxResultCount: 1,
          locationBias: {
            circle: {
              center: {
                latitude: stop.place.lat,
                longitude: stop.place.lng,
              },
              radius: 500,
            },
          },
        }),
      }
    );

    if (!searchResponse.ok) {
      return [];
    }

    const searchPayload =
      (await searchResponse.json()) as GoogleTextSearchResponse;
    const photoNames =
      searchPayload.places?.[0]?.photos
        ?.map((photo) => photo.name)
        .filter((name): name is string => Boolean(name))
        .slice(0, GOOGLE_PLACE_PHOTO_LIMIT) ?? [];

    const photoUrls = await Promise.all(
      photoNames.map(async (photoName) => {
        const mediaUrl = new URL(
          `https://places.googleapis.com/v1/${photoName}/media`
        );

        mediaUrl.searchParams.set("key", googleApiKey);
        mediaUrl.searchParams.set("maxHeightPx", "900");
        mediaUrl.searchParams.set("maxWidthPx", "900");
        mediaUrl.searchParams.set("skipHttpRedirect", "true");

        const mediaResponse = await fetch(mediaUrl);

        if (!mediaResponse.ok) {
          return null;
        }

        const mediaPayload =
          (await mediaResponse.json()) as GooglePhotoMediaResponse;

        return mediaPayload.photoUri ?? null;
      })
    );

    return uniqueImageUrls(photoUrls);
  } catch {
    return [];
  }
}

async function buildVisitPhotoReferenceImageUrls(
  prisma: PrismaClient,
  stop: RouteStop,
  currentPhotoUrl: string
) {
  const openApiImageUrls = uniqueImageUrls([stop.place.imageUrl]);
  const cloudflareReferenceUrls = await getPreviousVisitPhotoReferenceUrls(
    prisma,
    stop,
    currentPhotoUrl
  );
  let referenceUrls = uniqueImageUrls([
    ...openApiImageUrls,
    ...cloudflareReferenceUrls,
  ]).slice(0, VISIT_PHOTO_REFERENCE_IMAGE_LIMIT);

  if (referenceUrls.length < 1) {
    referenceUrls = uniqueImageUrls([
      ...referenceUrls,
      ...(await getGooglePlacePhotoReferenceUrls(stop)),
    ]).slice(0, VISIT_PHOTO_REFERENCE_IMAGE_LIMIT);
  }

  return referenceUrls;
}

function buildVisitPhotoPrompt(stop: RouteStop, hasReferenceImages: boolean) {
  return [
    "너는 RouteOne 장소 방문 사진 인증 판별기다.",
    "사용자 사진이 후보 장소에서 촬영된 사진인지 판단해라.",
    "",
    `후보 장소명: ${stop.place.title}`,
    `주소: ${stop.place.address ?? "없음"}`,
    `카테고리: ${stop.place.categoryLabel ?? stop.place.categoryName ?? "없음"}`,
    "",
    hasReferenceImages
      ? "기준 이미지들은 후보 장소의 Open API 이미지, RouteOne 승인 인증 이미지, 또는 Google Places 사진이다. 구도, 날씨, 시간대가 달라도 같은 장소일 수 있다."
      : "기준 이미지가 없다. 사진 안의 간판, 입구, 표지판, 메뉴판, 영수증, 주소, 전화번호, 장소명 텍스트와 장소 유형을 근거로 판단해라.",
    "근거가 부족하면 match로 확정하지 말고 maybe로 판단해라.",
    "다른 장소명이나 후보와 명확히 충돌하는 단서가 있으면 no로 판단해라.",
    "출력은 JSON만 반환해라.",
  ].join("\n");
}

function buildVisitPhotoJsonSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      decision: {
        type: "string",
        enum: ["match", "maybe", "no"],
      },
      confidence: {
        type: "number",
        minimum: 0,
        maximum: 1,
      },
      visualEvidence: {
        type: "array",
        items: {
          type: "string",
        },
      },
      textEvidence: {
        type: "array",
        items: {
          type: "string",
        },
      },
      mismatchReasons: {
        type: "array",
        items: {
          type: "string",
        },
      },
      needsReview: {
        type: "boolean",
      },
    },
    required: [
      "decision",
      "confidence",
      "visualEvidence",
      "textEvidence",
      "mismatchReasons",
      "needsReview",
    ],
  };
}

async function analyzeVisitPhotoWithOpenAi({
  stop,
  photoUrl,
  referenceImageUrls,
}: {
  stop: RouteStop;
  photoUrl: string;
  referenceImageUrls: string[];
}) {
  const openAiApiKey = process.env.OPENAI_API_KEY?.trim();

  if (!openAiApiKey) {
    return {
      decision: "SKIPPED" as const,
      confidence: 0,
      referenceImageUrls,
      visualEvidence: [],
      textEvidence: [],
      mismatchReasons: [],
      needsReview: true,
      skippedReason: "OPENAI_API_KEY 환경변수가 없어 사진 판별을 건너뜀",
    };
  }

  const openAiPhotoUrl = await getOpenAiInputImageUrl(photoUrl, true);
  const openAiReferenceImages = (
    await Promise.all(
      referenceImageUrls.map(async (referenceImageUrl) => {
        const inputImageUrl = await getOpenAiInputImageUrl(
          referenceImageUrl,
          false
        );

        return inputImageUrl
          ? {
              originalUrl: referenceImageUrl,
              inputImageUrl,
            }
          : null;
      })
    )
  ).filter(
    (
      referenceImage
    ): referenceImage is {
      originalUrl: string;
      inputImageUrl: string;
    } => Boolean(referenceImage)
  );
  const usedReferenceImageUrls = openAiReferenceImages.map(
    (referenceImage) => referenceImage.originalUrl
  );
  const imageContent = [
    {
      type: "input_text",
      text: buildVisitPhotoPrompt(stop, usedReferenceImageUrls.length > 0),
    },
    {
      type: "input_text",
      text: "사용자 촬영 사진",
    },
    {
      type: "input_image",
      image_url: openAiPhotoUrl,
    },
    ...openAiReferenceImages.flatMap((referenceImage, index) => [
      {
        type: "input_text",
        text: `기준 이미지 ${index + 1}`,
      },
      {
        type: "input_image",
        image_url: referenceImage.inputImageUrl,
      },
    ]),
  ];

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_VISIT_PHOTO_MODEL,
      input: [
        {
          role: "user",
          content: imageContent,
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "routeone_visit_photo_verdict",
          schema: buildVisitPhotoJsonSchema(),
          strict: true,
        },
      },
      max_output_tokens: 800,
    }),
  });

  if (!response.ok) {
    const errorText = (await response.text()).trim();
    throw new Error(
      `사진 판별 요청에 실패했습니다: ${response.status}${
        errorText ? ` (${errorText})` : ""
      }`
    );
  }

  const payload = (await response.json()) as OpenAiVisitPhotoResponse;
  const verdictText = getOpenAiText(payload);
  const verdict = JSON.parse(verdictText) as VisitPhotoModelVerdict;
  const normalizedVerdict = normalizeVisitPhotoVerdict(verdict);

  return {
    ...normalizedVerdict,
    referenceImageUrls: usedReferenceImageUrls,
  };
}

export async function createRouteStopVisitPhotoUpload(
  prisma: PrismaClient,
  user: User,
  stopId: string
): Promise<RouteStopVisitPhotoUploadPayload> {
  await assertRouteStopOwner(prisma, stopId, user.id);

  if (isDevVerificationBypassEnabled()) {
    const imageId = `test-${stopId}-${Date.now()}`;

    return {
      imageId,
      uploadUrl: "",
      imageUrl: buildTestVisitPhotoImageUrl(stopId),
      expiresAt: new Date(Date.now() + CLOUDFLARE_DIRECT_UPLOAD_URL_EXPIRY_MS),
    };
  }

  const accountId = getRequiredEnv("CF_ACCOUNT");
  const token = getRequiredEnv("CF_TOKEN");
  const formData = new FormData();
  const expiresAt = new Date(
    Date.now() + CLOUDFLARE_DIRECT_UPLOAD_URL_EXPIRY_MS
  );

  formData.set("requireSignedURLs", "false");
  formData.set(
    "metadata",
    JSON.stringify({
      kind: "route-stop-visit-photo",
      stopId,
      userId: user.id,
    })
  );

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v2/direct_upload`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
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
    expiresAt,
  };
}

export async function analyzeRouteStopVisitPhoto(
  prisma: PrismaClient,
  user: User,
  input: AnalyzeRouteStopVisitPhotoInput
): Promise<RouteStopVisitPhotoAnalysisPayload> {
  const photoUrl = normalizeUrl(input.photoUrl);

  if (!photoUrl) {
    throw new Error("사진 URL이 비어있습니다.");
  }

  const stop = await assertRouteStopOwner(prisma, input.stopId, user.id);

  if (isDevVerificationBypassEnabled()) {
    return {
      decision: "MATCH",
      confidence: 1,
      referenceImageUrls: [],
      visualEvidence: ["개발 테스트 모드에서 사진 판별 통과"],
      textEvidence: ["ROUTEONE_DEV_VERIFICATION_BYPASS 활성화"],
      mismatchReasons: [],
      needsReview: false,
      skippedReason: null,
    };
  }

  const referenceImageUrls = await buildVisitPhotoReferenceImageUrls(
    prisma,
    stop,
    photoUrl
  );

  return analyzeVisitPhotoWithOpenAi({
    stop,
    photoUrl,
    referenceImageUrls,
  });
}
