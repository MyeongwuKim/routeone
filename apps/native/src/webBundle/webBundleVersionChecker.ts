import type {
  NativeWebBundlePlatform,
  WebBundleChannel,
  WebBundleManifest
} from "./webBundleTypes";
import { compareVersions } from "../version/compareVersions";

export function compareWebBundleVersions(leftValue: string, rightValue: string) {
  return compareVersions(leftValue, rightValue);
}

export function shouldInstallWebBundle(options: {
  manifest: WebBundleManifest;
  currentWebVersion: string | null;
  nativeVersion: string;
  platform: NativeWebBundlePlatform;
  expectedChannel: WebBundleChannel;
  failedVersions: readonly string[];
}) {
  const {
    manifest,
    currentWebVersion,
    nativeVersion,
    platform,
    expectedChannel,
    failedVersions
  } = options;
  const minimumNativeVersion = manifest.minimumNativeVersion?.[platform];
  const manifestChannel = manifest.channel ?? manifest.appVariant;

  if (manifestChannel !== expectedChannel) {
    return false;
  }

  if (
    minimumNativeVersion &&
    compareWebBundleVersions(nativeVersion, minimumNativeVersion) < 0
  ) {
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
