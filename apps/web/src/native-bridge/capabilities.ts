
import type { NativeAppInfo } from "./types";

/** 웹에서 기능 노출 여부를 판단할 때 네이티브 앱 정보와 비교하는 버전별 capability 이름이다. */
export const NATIVE_CAPABILITY = {
  cameraCapture: "camera.capture.v1",
  photoSave: "photo.save.v1",
} as const;

export type NativeCapability =
  (typeof NATIVE_CAPABILITY)[keyof typeof NATIVE_CAPABILITY];

/** 앱 정보의 capabilities에 지정한 브리지 기능 버전이 포함되어 있는지 확인한다. 정보가 없으면 false다. */
export function hasNativeCapability(
  appInfo: NativeAppInfo | null | undefined,
  capability: NativeCapability,
) {
  return appInfo?.capabilities.includes(capability) ?? false;
}
