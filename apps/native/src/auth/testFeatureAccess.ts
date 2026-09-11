/**
 * 용도:
 * 테스트 지역과 GPS 시연 기능을 사용할 수 있는 실행 조건을 판단한다.
 *
 * 동작 방식:
 * 계정 역할과 관계없이 개발 앱에서만 테스트 기능을 허용한다.
 */
import type { NativeAuthRole } from "./nativeAuthStorage";

export function isNativeTestFeatureEnabled(
  _role: NativeAuthRole | null,
  appVariant: "dev" | "prod"
) {
  return appVariant === "dev";
}
