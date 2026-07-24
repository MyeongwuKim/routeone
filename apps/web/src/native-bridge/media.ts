import { getNativeBridgeApi } from "./runtime";
import type {
  NativePhotoUploadTarget,
  NativeSaveImageOptions,
  NativeVisitPhotoSource,
} from "./types";

export function takeNativeVisitPhoto(source: NativeVisitPhotoSource) {
  const takeVisitPhoto = getNativeBridgeApi()?.takeVisitPhoto;

  return takeVisitPhoto ? takeVisitPhoto({ source }) : null;
}

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

export function saveNativeImage(options: NativeSaveImageOptions) {
  const saveImage = getNativeBridgeApi()?.saveImage;

  return saveImage ? saveImage(options) : null;
}
