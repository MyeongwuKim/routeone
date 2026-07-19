import { Platform } from "react-native";
import { WEB_BUNDLE_UPDATE_CONFIG } from "../config/webBundleUpdateConfig";
import { WEB_BUNDLE_HTML } from "../generated/webBundle";
import { fetchWebBundleManifest } from "./webBundleManifest";
import {
  confirmWebBundleReady,
  installWebBundle,
  prepareWebBundleStorage,
  rollbackWebBundle
} from "./webBundleStorage";
import type {
  InstalledWebBundle,
  ResolvedWebBundle,
  WebBundleProgressReporter
} from "./webBundleTypes";
import { emitWebBundleProgress } from "./webBundleProgress";
import { shouldInstallWebBundle } from "./webBundleVersionChecker";

function createEmbeddedBundle(): ResolvedWebBundle {
  return {
    key: "embedded",
    kind: "embedded",
    version: null,
    source: {
      html: WEB_BUNDLE_HTML,
      baseUrl: "https://routeone.native/"
    },
    pending: false,
    readySignalRequired: false
  };
}

function createInstalledBundle(
  bundle: InstalledWebBundle
): ResolvedWebBundle {
  return {
    key: `installed-${bundle.version}-${bundle.pending ? "pending" : "ready"}`,
    kind: "installed",
    version: bundle.version,
    source: { uri: bundle.entryUri },
    allowingReadAccessToUrl: bundle.directoryUri,
    pending: bundle.pending,
    readySignalRequired: bundle.readySignalRequired
  };
}

export async function resolveWebBundle(
  reportProgress?: WebBundleProgressReporter
): Promise<ResolvedWebBundle> {
  let fallback = createEmbeddedBundle();

  try {
    emitWebBundleProgress(reportProgress, {
      stage: "preparing",
      progress: 0.08,
      message: "저장된 버전을 확인하고 있어요."
    });
    const snapshot = await prepareWebBundleStorage();
    fallback = snapshot.active
      ? createInstalledBundle(snapshot.active)
      : createEmbeddedBundle();
    const { manifestUrl, nativeVersion } = WEB_BUNDLE_UPDATE_CONFIG;

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

    if (
      !shouldInstallWebBundle({
        manifest,
        currentWebVersion: snapshot.active?.version ?? null,
        nativeVersion,
        platform: Platform.OS,
        failedVersions: snapshot.failedVersions
      })
    ) {
      emitWebBundleProgress(reportProgress, {
        stage: "loading",
        progress: 0.92,
        message: "RouteOne을 불러오고 있어요."
      });
      return fallback;
    }

    return createInstalledBundle(
      await installWebBundle(manifest, reportProgress)
    );
  } catch (error) {
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
