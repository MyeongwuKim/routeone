type RouteOneNativePosition = {
  lat: number;
  lng: number;
  accuracyMeters: number | null;
  timestamp: number;
};

type RouteOneNativePhoto = {
  uri: string | null;
  dataUrl?: string | null;
  width: number | null;
  height: number | null;
  uploadedImageId?: string | null;
  uploadedImageUrl?: string | null;
};

export type VisitPhotoSource = "camera" | "library";

type RouteOneNativePhotoUploadTarget = {
  uploadUrl: string;
  imageId: string;
  imageUrl: string;
  fileName: string;
  environment: string;
};

type RouteOneNativePhotoUploadResult = {
  uploadedImageId?: string | null;
  uploadedImageUrl?: string | null;
};

type VisitPlaceCoordinates = {
  lat: number;
  lng: number;
};

type RouteOneNativeBridge = {
  getCurrentPosition?: () => Promise<RouteOneNativePosition>;
  takeVisitPhoto?: (options?: {
    source?: VisitPhotoSource;
    uploadTarget?: RouteOneNativePhotoUploadTarget;
  }) => Promise<RouteOneNativePhoto>;
  uploadVisitPhoto?: (options: {
    photoUri: string;
    uploadTarget: RouteOneNativePhotoUploadTarget;
  }) => Promise<RouteOneNativePhotoUploadResult>;
};

type CloudflareImageUploadResponse = {
  success?: boolean;
  result?: {
    id?: string;
    variants?: string[];
  };
  errors?: Array<{
    message?: string;
  }>;
};

const VISIT_GPS_VERIFICATION_MAX_DISTANCE_METERS = 100;
const EARTH_RADIUS_METERS = 6_371_000;
const TRUTHY_ENV_VALUES = new Set(["1", "true", "yes", "on"]);

function getRouteOneNativeBridge() {
  return (window as Window & { RouteOneNative?: RouteOneNativeBridge })
    .RouteOneNative;
}

function isTruthyEnv(value: unknown) {
  return (
    typeof value === "string" &&
    TRUTHY_ENV_VALUES.has(value.trim().toLowerCase())
  );
}

export function isVisitVerificationBypassEnabled() {
  return (
    window.RouteOneRuntimeConfig?.devVerificationBypass === true ||
    isTruthyEnv(import.meta.env.VITE_ROUTEONE_DEV_VERIFICATION_BYPASS) ||
    isTruthyEnv(import.meta.env.VITE_DEV_VERIFICATION_BYPASS)
  );
}

function toRadians(degree: number) {
  return (degree * Math.PI) / 180;
}

function calculateDistanceMeters(
  from: VisitPlaceCoordinates,
  to: VisitPlaceCoordinates
) {
  const latDelta = toRadians(to.lat - from.lat);
  const lngDelta = toRadians(to.lng - from.lng);
  const fromLat = toRadians(from.lat);
  const toLat = toRadians(to.lat);
  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(lngDelta / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

export function assertVisitPositionNearPlace(
  position: VisitPlaceCoordinates,
  place: VisitPlaceCoordinates
) {
  const distanceMeters = calculateDistanceMeters(position, place);

  if (distanceMeters > VISIT_GPS_VERIFICATION_MAX_DISTANCE_METERS) {
    throw new Error(
      `장소 근처에서만 인증할 수 있어요. 현재 위치가 약 ${Math.round(
        distanceMeters
      )}m 떨어져 있어요.`
    );
  }

  return distanceMeters;
}

export async function requestCurrentPosition() {
  const nativeBridge = getRouteOneNativeBridge();

  if (!nativeBridge?.getCurrentPosition) {
    throw new Error("앱에서만 위치 인증을 사용할 수 있어요.");
  }

  return nativeBridge.getCurrentPosition();
}

export async function requestVisitVerificationPosition(
  place: VisitPlaceCoordinates
) {
  if (isVisitVerificationBypassEnabled()) {
    return {
      lat: place.lat,
      lng: place.lng,
      accuracyMeters: 1,
      timestamp: Date.now(),
    } satisfies RouteOneNativePosition;
  }

  const position = await requestCurrentPosition();

  assertVisitPositionNearPlace(position, place);

  return position;
}

export async function requestVisitPhoto(source: VisitPhotoSource) {
  const nativeBridge = getRouteOneNativeBridge();

  if (!nativeBridge?.takeVisitPhoto) {
    throw new Error("앱에서만 사진 인증을 사용할 수 있어요.");
  }

  return nativeBridge.takeVisitPhoto({ source });
}

async function requestVisitPhotoUpload(
  photoUri: string,
  uploadTarget: RouteOneNativePhotoUploadTarget
) {
  const nativeBridge = getRouteOneNativeBridge();

  if (!nativeBridge?.uploadVisitPhoto) {
    return null;
  }

  return nativeBridge.uploadVisitPhoto({
    photoUri,
    uploadTarget,
  });
}

function assertCloudflareUploadUrl(uploadUrl: string) {
  const url = new URL(uploadUrl);

  if (url.protocol !== "https:" || url.hostname !== "upload.imagedelivery.net") {
    throw new Error("사진 업로드 URL이 올바르지 않아요.");
  }
}

function getCloudflareUploadError(payload: CloudflareImageUploadResponse) {
  return (
    payload.errors
      ?.map((error) => error.message)
      .filter(Boolean)
      .join(", ") || "사진 업로드에 실패했어요."
  );
}

function createBlobFromDataUrl(dataUrl: string) {
  const separatorIndex = dataUrl.indexOf(",");

  if (!dataUrl.startsWith("data:") || separatorIndex < 0) {
    throw new Error("사진 데이터 형식이 올바르지 않아요.");
  }

  const metadata = dataUrl.slice(5, separatorIndex).split(";");
  const mimeType = metadata[0] || "image/jpeg";
  const isBase64 = metadata
    .slice(1)
    .some((part) => part.trim().toLowerCase() === "base64");

  if (!isBase64) {
    throw new Error("사진 데이터 형식이 올바르지 않아요.");
  }

  const byteString = window.atob(dataUrl.slice(separatorIndex + 1));
  const chunks: ArrayBuffer[] = [];

  for (let offset = 0; offset < byteString.length; offset += 1024) {
    const slice = byteString.slice(offset, offset + 1024);
    const buffer = new ArrayBuffer(slice.length);
    const bytes = new Uint8Array(buffer);

    for (let index = 0; index < slice.length; index += 1) {
      bytes[index] = slice.charCodeAt(index);
    }

    chunks.push(buffer);
  }

  return new Blob(chunks, {
    type: mimeType,
  });
}

async function parseCloudflareUploadResponse(response: Response) {
  try {
    return (await response.json()) as CloudflareImageUploadResponse;
  } catch {
    return {
      success: false,
      errors: [{ message: "사진 업로드 응답을 읽지 못했어요." }],
    };
  }
}

export async function uploadVerifiedVisitPhoto(
  uploadTarget: RouteOneNativePhotoUploadTarget,
  photo: RouteOneNativePhoto
) {
  if (photo.uploadedImageUrl) {
    return photo.uploadedImageUrl;
  }

  if (!uploadTarget.uploadUrl) {
    if (photo.dataUrl) {
      return photo.dataUrl;
    }

    return uploadTarget.imageUrl;
  }

  if (photo.uri) {
    const nativeUploadResult = await requestVisitPhotoUpload(
      photo.uri,
      uploadTarget
    );

    if (nativeUploadResult) {
      return nativeUploadResult.uploadedImageUrl ?? uploadTarget.imageUrl;
    }
  }

  if (!photo.dataUrl) {
    throw new Error("사진 업로드에 사용할 데이터를 찾지 못했어요.");
  }

  assertCloudflareUploadUrl(uploadTarget.uploadUrl);

  const formData = new FormData();

  formData.append(
    "file",
    createBlobFromDataUrl(photo.dataUrl),
    uploadTarget.fileName
  );

  const response = await fetch(uploadTarget.uploadUrl, {
    method: "POST",
    body: formData,
  });
  const payload = await parseCloudflareUploadResponse(response);

  if (!response.ok || !payload.success) {
    throw new Error(getCloudflareUploadError(payload));
  }

  return payload.result?.variants?.[0] ?? uploadTarget.imageUrl;
}
