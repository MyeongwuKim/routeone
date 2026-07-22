import Constants from "expo-constants";

type AppVariant = "dev" | "prod";

type RouteOneExtra = {
  appVariant?: unknown;
  webBundleChannel?: unknown;
  webBundleManifestUrl?: unknown;
  webBundleUpdatesEnabled?: unknown;
};

const routeOneExtra = (Constants.expoConfig?.extra?.routeone ?? {}) as RouteOneExtra;

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readPublicEnv(name: string) {
  return readString(process.env[name]);
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

function normalizeAppVariant(value: unknown): AppVariant {
  return readAppVariant(value) ?? "dev";
}

function readBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function trimTrailingSlashes(value: string) {
  return value.replace(/\/+$/g, "");
}

function readManifestUrl(appVariant: AppVariant, updatesEnabled: boolean) {
  if (!updatesEnabled) {
    return null;
  }

  const explicitUrl =
    appVariant === "prod"
      ? readPublicEnv("EXPO_PUBLIC_WEB_BUNDLE_MANIFEST_URL_PROD")
      : readPublicEnv("EXPO_PUBLIC_WEB_BUNDLE_MANIFEST_URL_DEV");

  if (explicitUrl) {
    return explicitUrl;
  }

  const baseUrl = readPublicEnv("EXPO_PUBLIC_WEB_BUNDLE_BASE_URL");

  if (!baseUrl) {
    return readString(routeOneExtra.webBundleManifestUrl) || null;
  }

  return `${trimTrailingSlashes(baseUrl)}/latest/manifest.json`;
}

const explicitRuntimeAppVariant = readAppVariant(
  readPublicEnv("EXPO_PUBLIC_APP_VARIANT")
);
const appVariant =
  explicitRuntimeAppVariant ?? readAppVariant(routeOneExtra.appVariant) ?? "dev";
const configuredUpdatesEnabled = readBoolean(
  routeOneExtra.webBundleUpdatesEnabled
);
const updatesEnabled =
  configuredUpdatesEnabled ?? Boolean(explicitRuntimeAppVariant);
const manifestUrl = readManifestUrl(appVariant, updatesEnabled);

export const WEB_BUNDLE_UPDATE_CONFIG = {
  appVariant,
  channel: normalizeAppVariant(routeOneExtra.webBundleChannel || appVariant),
  manifestUrl,
  updatesEnabled,
  nativeVersion: readString(Constants.expoConfig?.version) || "0.0.0"
} as const;
