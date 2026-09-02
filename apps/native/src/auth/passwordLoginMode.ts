/**
 * 용도:
 * 네이티브 앱 variant에 맞춰 비밀번호 로그인 입력의 노출 방식을 정한다.
 *
 * 동작 방식:
 * 운영 앱에서는 입력을 숨기고, dev와 로컬 앱에서는 테스트 입력을 제공한다.
 */
export type PasswordLoginMode = "hidden" | "test";

export function getPasswordLoginMode(
  appVariant: "dev" | "prod"
): PasswordLoginMode {
  return appVariant === "prod" ? "hidden" : "test";
}
