import Constants from "expo-constants";

type AppVariant = "dev" | "prod";

type RouteOneExtra = {
  appVariant?: string;
  webBundleChannel?: string;
  webBundleManifestUrl?: string | null;
};

const routeOneExtra = (Constants.expoConfig?.extra?.routeone ?? {}) as RouteOneExtra;

function normalizeAppVariant(value: string | undefined): AppVariant {
  return value?.trim().toLowerCase() === "prod" ? "prod" : "dev";
}

function trimTrailingSlashes(value: string) {
  return value.replace(/\/+$/g, "");
}

function readManifestUrl(appVariant: AppVariant) {
  const explicitUrl =
    appVariant === "prod"
      ? process.env.EXPO_PUBLIC_WEB_BUNDLE_MANIFEST_URL_PROD?.trim()
      : process.env.EXPO_PUBLIC_WEB_BUNDLE_MANIFEST_URL_DEV?.trim();

  if (explicitUrl) {
    return explicitUrl;
  }

  const baseUrl = process.env.EXPO_PUBLIC_WEB_BUNDLE_BASE_URL?.trim();

  if (!baseUrl) {
    return routeOneExtra.webBundleManifestUrl?.trim() || null;
  }

  return `${trimTrailingSlashes(baseUrl)}/latest/manifest.json`;
}

const appVariant = normalizeAppVariant(
  process.env.EXPO_PUBLIC_APP_VARIANT ?? routeOneExtra.appVariant
);
const manifestUrl = readManifestUrl(appVariant);

export const WEB_BUNDLE_UPDATE_CONFIG = {
  appVariant,
  channel: routeOneExtra.webBundleChannel?.trim() || appVariant,
  manifestUrl,
  nativeVersion: Constants.expoConfig?.version?.trim() || "0.0.0"
} as const;
