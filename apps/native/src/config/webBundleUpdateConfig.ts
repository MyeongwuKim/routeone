type AppVariant = "dev" | "prod";

const DEFAULT_WEB_BUNDLE_PREFIX = "routeone-web-bundles";

function normalizeAppVariant(value: string | undefined): AppVariant {
  return value?.trim().toLowerCase() === "prod" ? "prod" : "dev";
}

function trimSlashes(value: string) {
  return value.replace(/^\/+|\/+$/g, "");
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
    return null;
  }

  const prefix = trimSlashes(
    process.env.EXPO_PUBLIC_WEB_BUNDLE_PREFIX?.trim() ||
      DEFAULT_WEB_BUNDLE_PREFIX
  );

  return `${trimTrailingSlashes(baseUrl)}/${prefix}/${appVariant}/manifest.json`;
}

const appVariant = normalizeAppVariant(process.env.EXPO_PUBLIC_APP_VARIANT);
const manifestUrl = readManifestUrl(appVariant);

export const WEB_BUNDLE_UPDATE_CONFIG = {
  appVariant,
  channel: appVariant,
  manifestUrl,
  versionsUrl: manifestUrl
    ? manifestUrl.replace(/\/manifest\.json$/, "/versions.json")
    : null
} as const;
