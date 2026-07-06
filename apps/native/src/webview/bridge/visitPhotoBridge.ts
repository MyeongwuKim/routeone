import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { Alert, Linking } from "react-native";
import {
  postNativePhotoResponse,
  postNativePhotoUploadResponse,
} from "./responses";
import type {
  NativePhotoRequest,
  NativePhotoResponse,
  NativePhotoUploadRequest,
  NativePhotoUploadTarget,
  WebViewRef,
} from "./types";

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

type NativeFormDataFile = {
  uri: string;
  name: string;
  type: string;
};

type NativeVisitPhotoUploadFile = {
  uri: string;
  fileName: string;
  mimeType: string;
  dataUrl?: string | null;
  width?: number | null;
  height?: number | null;
};

const VISIT_PHOTO_MAX_DIMENSION = 1280;

function getCloudflareUploadError(payload: CloudflareImageUploadResponse) {
  return (
    payload.errors
      ?.map((error) => error.message)
      .filter(Boolean)
      .join(", ") || "사진 업로드에 실패했어요."
  );
}

function assertCloudflareUploadUrl(uploadUrl: string) {
  const url = new URL(uploadUrl);

  if (url.protocol !== "https:" || url.hostname !== "upload.imagedelivery.net") {
    throw new Error("사진 업로드 URL이 올바르지 않아요.");
  }
}

function getNativeVisitPhotoResizeActions(asset: ImagePicker.ImagePickerAsset) {
  const actions: Parameters<typeof manipulateAsync>[1] = [];
  const width = asset.width ?? 0;
  const height = asset.height ?? 0;
  const maxDimension = Math.max(width, height);

  if (maxDimension <= VISIT_PHOTO_MAX_DIMENSION) {
    return actions;
  }

  actions.push({
    resize:
      width >= height
        ? { width: VISIT_PHOTO_MAX_DIMENSION }
        : { height: VISIT_PHOTO_MAX_DIMENSION }
  });

  return actions;
}

async function getNativeVisitPhotoFile(
  asset: ImagePicker.ImagePickerAsset
): Promise<NativeVisitPhotoUploadFile> {
  const convertedImage = await manipulateAsync(
    asset.uri,
    getNativeVisitPhotoResizeActions(asset),
    {
      base64: true,
      compress: 0.78,
      format: SaveFormat.JPEG
    }
  );

  if (!convertedImage.base64) {
    throw new Error("사진 데이터를 읽지 못했어요.");
  }

  return {
    uri: convertedImage.uri,
    fileName: `routeone-visit-${Date.now()}.jpg`,
    mimeType: "image/jpeg",
    dataUrl: `data:image/jpeg;base64,${convertedImage.base64}`,
    width: convertedImage.width ?? asset.width ?? null,
    height: convertedImage.height ?? asset.height ?? null
  };
}

function getNativeVisitPhotoUploadFileFromUri(
  photoUri: string
): NativeVisitPhotoUploadFile {
  const trimmedUri = photoUri.trim();

  if (!trimmedUri) {
    throw new Error("업로드할 사진을 찾지 못했어요.");
  }

  return {
    uri: trimmedUri,
    fileName: `routeone-visit-${Date.now()}.jpg`,
    mimeType: "image/jpeg"
  };
}

function parseCloudflareUploadResponse(responseText: string) {
  try {
    return JSON.parse(responseText) as CloudflareImageUploadResponse;
  } catch {
    return {
      success: false,
      errors: [{ message: "사진 업로드 응답을 읽지 못했어요." }]
    };
  }
}

function uploadFormDataWithXhr(uploadUrl: string, formData: FormData) {
  return new Promise<{
    ok: boolean;
    payload: CloudflareImageUploadResponse;
  }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open("POST", uploadUrl);
    xhr.timeout = 30_000;
    xhr.onload = () => {
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        payload: parseCloudflareUploadResponse(xhr.responseText)
      });
    };
    xhr.onerror = () => {
      reject(new Error("사진 업로드 요청에 실패했어요."));
    };
    xhr.ontimeout = () => {
      reject(new Error("사진 업로드 시간이 초과됐어요."));
    };
    xhr.send(formData);
  });
}

function showCameraPermissionSettingsAlert() {
  return new Promise<void>((resolve) => {
    Alert.alert(
      "카메라 권한이 꺼져 있어요",
      "사진 인증을 하려면 설정에서 카메라 권한을 켜야 해요.",
      [
        {
          text: "취소",
          style: "cancel",
          onPress: () => resolve()
        },
        {
          text: "설정 열기",
          onPress: () => {
            void Linking.openSettings()
              .catch(() => undefined)
              .finally(resolve);
          }
        }
      ],
      {
        cancelable: true,
        onDismiss: () => resolve()
      }
    );
  });
}

async function ensureCameraPermission() {
  const permission = await ImagePicker.getCameraPermissionsAsync();

  if (permission.status === "granted") {
    return;
  }

  if (!permission.canAskAgain) {
    await showCameraPermissionSettingsAlert();
    throw new Error("설정에서 카메라 권한을 켜야 사진 인증을 할 수 있어요.");
  }

  const nextPermission = await ImagePicker.requestCameraPermissionsAsync();

  if (nextPermission.status === "granted") {
    return;
  }

  if (!nextPermission.canAskAgain) {
    await showCameraPermissionSettingsAlert();
    throw new Error("설정에서 카메라 권한을 켜야 사진 인증을 할 수 있어요.");
  }

  throw new Error("카메라 권한을 허용해야 사진 인증을 할 수 있어요.");
}

async function uploadNativeVisitPhotoFile(
  uploadFile: NativeVisitPhotoUploadFile,
  uploadTarget: NativePhotoUploadTarget
) {
  if (!uploadTarget.uploadUrl) {
    return {
      uploadedImageId: null,
      uploadedImageUrl: null
    };
  }

  assertCloudflareUploadUrl(uploadTarget.uploadUrl);

  const formData = new FormData();

  formData.append("file", {
    uri: uploadFile.uri,
    name: uploadFile.fileName,
    type: uploadFile.mimeType
  } satisfies NativeFormDataFile as unknown as Blob);

  const { ok, payload } = await uploadFormDataWithXhr(
    uploadTarget.uploadUrl,
    formData
  );

  if (!ok || !payload.success) {
    throw new Error(getCloudflareUploadError(payload));
  }

  return {
    uploadedImageId: payload.result?.id ?? uploadTarget.imageId ?? null,
    uploadedImageUrl:
      payload.result?.variants?.[0] ?? uploadTarget.imageUrl ?? null
  };
}

async function takeNativeVisitPhoto(
  uploadTarget?: NativePhotoRequest["uploadTarget"]
): Promise<NativePhotoResponse> {
  await ensureCameraPermission();

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: false,
    mediaTypes: ["images"],
    preferredAssetRepresentationMode:
      ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    quality: 0.72,
    exif: false
  });

  if (result.canceled) {
    throw new Error("사진 인증을 취소했어요.");
  }

  const asset = result.assets[0];

  if (!asset) {
    throw new Error("사진 인증에 사용할 사진을 찾지 못했어요.");
  }

  const photoFile = await getNativeVisitPhotoFile(asset);
  const uploadResult = uploadTarget
    ? await uploadNativeVisitPhotoFile(photoFile, uploadTarget)
    : {
        uploadedImageId: null,
        uploadedImageUrl: null
      };

  return {
    ok: true,
    uri: photoFile.uri,
    dataUrl: photoFile.dataUrl,
    width: photoFile.width ?? null,
    height: photoFile.height ?? null,
    uploadedImageId: uploadResult.uploadedImageId,
    uploadedImageUrl: uploadResult.uploadedImageUrl
  };
}

export async function handleNativePhotoRequest(
  message: NativePhotoRequest,
  webViewRef: WebViewRef
) {
  try {
    postNativePhotoResponse(
      webViewRef,
      message.id,
      await takeNativeVisitPhoto(message.uploadTarget)
    );
  } catch (error) {
    postNativePhotoResponse(webViewRef, message.id, {
      ok: false,
      error: error instanceof Error ? error.message : "Native photo failed"
    });
  }
}

export async function handleNativePhotoUploadRequest(
  message: NativePhotoUploadRequest,
  webViewRef: WebViewRef
) {
  try {
    postNativePhotoUploadResponse(webViewRef, message.id, {
      ok: true,
      ...(await uploadNativeVisitPhotoFile(
        getNativeVisitPhotoUploadFileFromUri(message.photoUri),
        message.uploadTarget
      )),
    });
  } catch (error) {
    postNativePhotoUploadResponse(webViewRef, message.id, {
      ok: false,
      error: error instanceof Error ? error.message : "Native photo upload failed"
    });
  }
}
