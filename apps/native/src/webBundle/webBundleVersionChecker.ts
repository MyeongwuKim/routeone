import type { WebBundleChannel, WebBundleManifest } from "./webBundleTypes";
import { compareVersions } from "@/version/compareVersions";

export function compareWebBundleVersions(leftValue: string, rightValue: string) {
  return compareVersions(leftValue, rightValue);
}

export function shouldInstallWebBundle(options: {
  manifest: WebBundleManifest;
  currentWebVersion: string | null;
  expectedChannel: WebBundleChannel;
  failedVersions: readonly string[];
}) {
  const {
    manifest,
    currentWebVersion,
    expectedChannel,
    failedVersions
  } = options;
  const manifestChannel = manifest.channel ?? manifest.appVariant;

  if (manifestChannel !== expectedChannel) {
    return false;
  }

  if (failedVersions.includes(manifest.version)) {
    return false;
  }

  return (
    !currentWebVersion ||
    compareWebBundleVersions(manifest.version, currentWebVersion) > 0
  );
}
