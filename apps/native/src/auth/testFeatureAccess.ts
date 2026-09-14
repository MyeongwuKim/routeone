/**
 * 용도:
 * 테스트 지역과 GPS 시연 기능을 사용할 수 있는 실행 조건을 판단한다.
 *
 * 동작 방식:
 * 개발 앱 또는 심사용 계정에서만 GPS 시연 기능을 허용한다.
 */
import type { NativeAuthRole } from "./nativeAuthStorage";

export function isNativeTestFeatureEnabled(
  role: NativeAuthRole | null,
  appVariant: "dev" | "prod"
) {
  return appVariant === "dev" || role === "OWNER" || role === "REVIEWER";
}
