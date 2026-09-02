/**
 * 용도:
 * 테스트 지역과 GPS 시연 기능을 사용할 수 있는 실행 조건을 판단한다.
 *
 * 동작 방식:
 * 개발 앱에서는 계정 역할과 관계없이 허용하고,
 * 운영 앱에서는 OWNER 마스터 계정에만 허용한다.
 */
import type { NativeAuthRole } from "./nativeAuthStorage";

export function isNativeTestFeatureEnabled(
  role: NativeAuthRole | null,
  appVariant: "dev" | "prod"
) {
  return appVariant === "dev" || role === "OWNER";
}
