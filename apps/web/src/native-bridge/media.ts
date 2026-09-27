
import { getNativeBridgeApi } from "./runtime";
import type {
  NativePhotoUploadTarget,
  NativeSaveImageOptions,
  NativeVisitPhotoSource,
} from "./types";

/** 카메라 또는 사진 보관함으로 방문 인증 사진 선택을 요청한다. 미지원 환경에서는 null을 반환한다. */
export function takeNativeVisitPhoto(source: NativeVisitPhotoSource) {
  const takeVisitPhoto = getNativeBridgeApi()?.takeVisitPhoto;

  return takeVisitPhoto ? takeVisitPhoto({ source }) : null;
}

/** 네이티브가 가진 photoUri를 발급된 업로드 대상에 전송하도록 요청한다. 미지원 환경에서는 null을 반환한다. */
export function uploadNativeVisitPhoto(
  photoUri: string,
  uploadTarget: NativePhotoUploadTarget
) {
  const uploadVisitPhoto = getNativeBridgeApi()?.uploadVisitPhoto;

  return uploadVisitPhoto
    ? uploadVisitPhoto({
        photoUri,
        uploadTarget,
      })
    : null;
}

/** data URL 이미지를 네이티브 저장·공유 화면으로 전달한다. 미지원 환경에서는 null을 반환한다. */
export function saveNativeImage(options: NativeSaveImageOptions) {
  const saveImage = getNativeBridgeApi()?.saveImage;

  return saveImage ? saveImage(options) : null;
}
