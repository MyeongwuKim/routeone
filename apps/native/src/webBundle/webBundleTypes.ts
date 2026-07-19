export type NativeWebBundlePlatform = "android" | "ios";

export type WebBundleManifest = {
  version: string;
  bundleUrl: string;
  entryPath: string;
  sha256: string;
  createdAt: string | null;
  readySignalRequired: boolean;
  minimumNativeVersion: Partial<
    Record<NativeWebBundlePlatform, string>
  > | null;
};

export type InstalledWebBundle = {
  version: string;
  entryPath: string;
  entryUri: string;
  directoryUri: string;
  sha256: string;
  pending: boolean;
  readySignalRequired: boolean;
};

export type WebBundleSource =
  | {
      html: string;
      baseUrl: string;
    }
  | {
      uri: string;
    };

export type ResolvedWebBundle = {
  key: string;
  kind: "embedded" | "installed";
  version: string | null;
  source: WebBundleSource;
  allowingReadAccessToUrl?: string;
  pending: boolean;
  readySignalRequired: boolean;
};

export type WebBundleProgressStage =
  | "preparing"
  | "checking"
  | "downloading"
  | "verifying"
  | "extracting"
  | "applying"
  | "loading"
  | "ready"
  | "rollback";

export type WebBundleProgress = {
  stage: WebBundleProgressStage;
  progress: number;
  message: string;
};

export type WebBundleProgressReporter = (
  update: WebBundleProgress
) => void;
