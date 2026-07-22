import Constants from "expo-constants";

type AppVariant = "dev" | "prod";

type RouteOneExtra = {
  appVariant?: unknown;
  webBundleChannel?: unknown;
  webBundleManifestUrl?: unknown;
};

const routeOneExtra = (Constants.expoConfig?.extra?.routeone ?? {}) as RouteOneExtra;

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readPublicEnv(name: string) {
  return readString(process.env[name]);
}

function normalizeAppVariant(value: unknown): AppVariant {
  return readString(value).toLowerCase() === "prod" ? "prod" : "dev";
}

function trimTrailingSlashes(value: string) {
  return value.replace(/\/+$/g, "");
}

function readManifestUrl(appVariant: AppVariant) {
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

const appVariant = normalizeAppVariant(
  readPublicEnv("EXPO_PUBLIC_APP_VARIANT") || routeOneExtra.appVariant
);
const manifestUrl = readManifestUrl(appVariant);

export const WEB_BUNDLE_UPDATE_CONFIG = {
  appVariant,
  channel: normalizeAppVariant(routeOneExtra.webBundleChannel || appVariant),
  manifestUrl,
  nativeVersion: readString(Constants.expoConfig?.version) || "0.0.0"
} as const;
