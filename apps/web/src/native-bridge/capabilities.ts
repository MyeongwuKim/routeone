import type { NativeAppInfo } from "./types";

export const NATIVE_CAPABILITY = {
  cameraCapture: "camera.capture.v1",
  photoSave: "photo.save.v1",
} as const;

export type NativeCapability =
  (typeof NATIVE_CAPABILITY)[keyof typeof NATIVE_CAPABILITY];

export function hasNativeCapability(
  appInfo: NativeAppInfo | null | undefined,
  capability: NativeCapability,
) {
  return appInfo?.capabilities.includes(capability) ?? false;
}
