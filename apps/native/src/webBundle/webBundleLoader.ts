import { Platform } from "react-native";
import { WEB_BUNDLE_UPDATE_CONFIG } from "../config/webBundleUpdateConfig";
import {
  WEB_BUNDLE_BASE_URL,
  WEB_BUNDLE_HTML
} from "../generated/webBundle";
import { fetchWebBundleManifest } from "./webBundleManifest";
import {
  confirmWebBundleReady,
  installWebBundle,
  prepareWebBundleStorage,
  rollbackWebBundle
} from "./webBundleStorage";
import type {
  InstalledWebBundle,
  NativeWebBundlePlatform,
  ResolvedWebBundle,
  WebBundleManifest,
  WebBundleProgressReporter
} from "./webBundleTypes";
import { emitWebBundleProgress } from "./webBundleProgress";
import { isFatalWebBundleInstallError } from "./webBundleErrors";
import {
  compareWebBundleVersions,
  shouldInstallWebBundle
} from "./webBundleVersionChecker";

const DEFAULT_EMBEDDED_BASE_URL = "https://routeone.native/";

function getEmbeddedBaseUrl() {
  return WEB_BUNDLE_UPDATE_CONFIG.publicBaseUrl
    ? `${WEB_BUNDLE_UPDATE_CONFIG.publicBaseUrl}/`
    : WEB_BUNDLE_BASE_URL;
}

function createEmbeddedHtml(baseUrl: string) {
  return WEB_BUNDLE_HTML.replaceAll(DEFAULT_EMBEDDED_BASE_URL, baseUrl);
}

function createEmbeddedBundle(): ResolvedWebBundle {
  const baseUrl = getEmbeddedBaseUrl();

  return {
    key: "embedded",
    kind: "embedded",
    version: null,
    source: {
      html: createEmbeddedHtml(baseUrl),
      baseUrl
    },
    pending: false,
    readySignalRequired: true
  };
}

function createInstalledBundle(
  bundle: InstalledWebBundle
): ResolvedWebBundle {
  const source = { uri: bundle.entryUrl ?? bundle.entryUri };

  return {
    key: `installed-${bundle.version}-${bundle.pending ? "pending" : "ready"}`,
    kind: "installed",
    version: bundle.version,
    source,
    ...(bundle.entryUrl
      ? {}
      : { allowingReadAccessToUrl: bundle.directoryUri }),
    pending: bundle.pending,
    readySignalRequired: bundle.readySignalRequired
  };
}

function createRemoteBundle(
  manifest: WebBundleManifest
): ResolvedWebBundle | null {
  if (!manifest.entryUrl) {
    return null;
  }

  return {
    key: `remote-${manifest.version}`,
    kind: "remote",
    version: manifest.version,
    source: { uri: manifest.entryUrl },
    pending: false,
    readySignalRequired: manifest.readySignalRequired
  };
}

function readHttpOrigin(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);

    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.origin;
    }
  } catch {
    return null;
  }

  return null;
}

function getNativeWebBundlePlatform(): NativeWebBundlePlatform | null {
  return Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : null;
}

function shouldUseInstalledBundle(bundle: InstalledWebBundle | null) {
  if (!bundle) {
    return false;
  }

  const expectedOrigin = WEB_BUNDLE_UPDATE_CONFIG.publicOrigin;

  if (!expectedOrigin) {
    return true;
  }

  return readHttpOrigin(bundle.entryUrl) === expectedOrigin;
}

function isManifestRemoteEntryAllowed(manifest: WebBundleManifest) {
  if (!manifest.entryUrl) {
    return false;
  }

  const entryOrigin = readHttpOrigin(manifest.entryUrl);
  const expectedOrigin = WEB_BUNDLE_UPDATE_CONFIG.publicOrigin;

  if (!entryOrigin) {
    return false;
  }

  return !expectedOrigin || entryOrigin === expectedOrigin;
}

function isManifestCompatibleWithNative(manifest: WebBundleManifest) {
  const manifestChannel = manifest.channel ?? manifest.appVariant;
  const platform = getNativeWebBundlePlatform();
  const minimumNativeVersion = platform
    ? manifest.minimumNativeVersion?.[platform]
    : null;

  if (manifestChannel !== WEB_BUNDLE_UPDATE_CONFIG.channel) {
    return false;
  }

  return (
    !minimumNativeVersion ||
    compareWebBundleVersions(
      WEB_BUNDLE_UPDATE_CONFIG.nativeVersion,
      minimumNativeVersion
    ) >= 0
  );
}

function createRemoteFallbackBundle(
  manifest: WebBundleManifest,
  failedVersions: readonly string[]
) {
  if (
    failedVersions.includes(manifest.version) ||
    !isManifestCompatibleWithNative(manifest) ||
    !isManifestRemoteEntryAllowed(manifest)
  ) {
    return null;
  }

  return createRemoteBundle(manifest);
}

export async function resolveWebBundle(
  reportProgress?: WebBundleProgressReporter
): Promise<ResolvedWebBundle> {
  let fallback = createEmbeddedBundle();

  try {
    if (!WEB_BUNDLE_UPDATE_CONFIG.updatesEnabled) {
      emitWebBundleProgress(reportProgress, {
        stage: "loading",
        progress: 0.92,
        message: "로컬 RouteOne을 불러오고 있어요."
      });
      return fallback;
    }

    emitWebBundleProgress(reportProgress, {
      stage: "preparing",
      progress: 0.08,
      message: "저장된 버전을 확인하고 있어요."
    });
    const snapshot = await prepareWebBundleStorage();
    const activeInstalledBundle = shouldUseInstalledBundle(snapshot.active)
      ? snapshot.active
      : null;
    fallback = activeInstalledBundle
      ? createInstalledBundle(activeInstalledBundle)
      : createEmbeddedBundle();
    const { channel, manifestUrl, nativeVersion } = WEB_BUNDLE_UPDATE_CONFIG;

    if (
      !manifestUrl ||
      (Platform.OS !== "android" && Platform.OS !== "ios")
    ) {
      emitWebBundleProgress(reportProgress, {
        stage: "loading",
        progress: 0.92,
        message: "RouteOne을 불러오고 있어요."
      });
      return fallback;
    }

    emitWebBundleProgress(reportProgress, {
      stage: "checking",
      progress: 0.16,
      message: "최신 버전을 확인하고 있어요."
    });
    const manifest = await fetchWebBundleManifest(manifestUrl);
    const platform = getNativeWebBundlePlatform();
    const remoteFallbackBundle = createRemoteFallbackBundle(
      manifest,
      snapshot.failedVersions
    );

    if (
      !platform ||
      !shouldInstallWebBundle({
        manifest,
        currentWebVersion: activeInstalledBundle?.version ?? null,
        nativeVersion,
        platform,
        expectedChannel: channel,
        failedVersions: snapshot.failedVersions
      })
    ) {
      emitWebBundleProgress(reportProgress, {
        stage: "loading",
        progress: 0.92,
        message: "RouteOne을 불러오고 있어요."
      });
      return activeInstalledBundle ? fallback : remoteFallbackBundle ?? fallback;
    }

    try {
      return createInstalledBundle(
        await installWebBundle(manifest, reportProgress)
      );
    } catch (error) {
      if (isFatalWebBundleInstallError(error)) {
        throw error;
      }

      if (remoteFallbackBundle) {
        console.warn(
          "[web-bundle] install failed; using remote entry url",
          error
        );
        emitWebBundleProgress(reportProgress, {
          stage: "loading",
          progress: 0.92,
          message: "RouteOne을 불러오고 있어요."
        });
        return remoteFallbackBundle;
      }

      throw error;
    }
  } catch (error) {
    if (isFatalWebBundleInstallError(error)) {
      throw error;
    }

    console.warn("[web-bundle] update check failed; using local bundle", error);
    emitWebBundleProgress(reportProgress, {
      stage: "loading",
      progress: 0.92,
      message: "저장된 RouteOne을 불러오고 있어요."
    });
    return fallback;
  }
}

export async function markResolvedWebBundleReady(bundle: ResolvedWebBundle) {
  if (bundle.kind === "installed" && bundle.version && bundle.pending) {
    await confirmWebBundleReady(bundle.version);
  }
}

export async function rollbackResolvedWebBundle(bundle: ResolvedWebBundle) {
  if (bundle.kind !== "installed" || !bundle.version) {
    return createEmbeddedBundle();
  }

  const restoredBundle = await rollbackWebBundle(bundle.version);
  return restoredBundle
    ? createInstalledBundle(restoredBundle)
    : createEmbeddedBundle();
}

export type { ResolvedWebBundle } from "./webBundleTypes";
