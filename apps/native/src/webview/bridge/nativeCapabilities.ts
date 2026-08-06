export const NATIVE_CAPABILITIES = [
  "camera.capture.v1",
  "photo.save.v1"
] as const;

export type NativeCapability = (typeof NATIVE_CAPABILITIES)[number];
