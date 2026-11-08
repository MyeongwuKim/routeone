import Constants from "expo-constants";

type AppVariant = "dev" | "prod";

type RouteOneExtra = {
  appVariant?: unknown;
  nativeUpdateChecksEnabled?: unknown;
  nativeUpdatePolicyUrl?: unknown;
};

const routeOneExtra = (Constants.expoConfig?.extra?.routeone ?? {}) as RouteOneExtra;

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readAppVariant(value: unknown): AppVariant | null {
  const variant = readString(value).toLowerCase();

  if (
    !variant ||
    variant === "none" ||
    variant === "null" ||
    variant === "undefined"
  ) {
    return null;
  }

  return variant === "prod" ? "prod" : "dev";
}

function readBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function readPolicyUrl(appVariant: AppVariant) {
  const explicitUrl =
    appVariant === "prod"
      ? readString(process.env.EXPO_PUBLIC_NATIVE_UPDATE_POLICY_URL_PROD)
      : readString(process.env.EXPO_PUBLIC_NATIVE_UPDATE_POLICY_URL_DEV);

  return explicitUrl || readString(routeOneExtra.nativeUpdatePolicyUrl) || null;
}

const explicitRuntimeAppVariant = readAppVariant(
  process.env.EXPO_PUBLIC_APP_VARIANT
);
const appVariant =
  explicitRuntimeAppVariant ?? readAppVariant(routeOneExtra.appVariant) ?? "dev";
const policyUrl = readPolicyUrl(appVariant);
const configuredChecksEnabled = readBoolean(
  routeOneExtra.nativeUpdateChecksEnabled
);

export const NATIVE_UPDATE_CONFIG = {
  appVariant,
  checksEnabled:
    // Metro로 실행하는 로컬 개발 앱은 배포 채널 설정과 관계없이 최소 버전 검사를 건너뛴다.
    !__DEV__ &&
    (configuredChecksEnabled ?? Boolean(explicitRuntimeAppVariant)) &&
    Boolean(policyUrl),
  currentVersion: readString(Constants.expoConfig?.version) || "0.0.0",
  policyUrl
} as const;
