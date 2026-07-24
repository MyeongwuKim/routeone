import type {
  NativeBridgeApi,
  ReactNativeWebViewApi,
} from "../native-bridge/types";

declare global {
  interface Window {
    RouteOneRuntimeConfig?: {
      graphqlEndpoint?: string;
      routerMode?: "browser" | "hash";
      devVerificationBypass?: boolean;
      webBundlePublicOrigin?: string | null;
      nativeAppVariant?: string;
      webBundleChannel?: string;
      webBundleManifestUrl?: string | null;
    };
    RouteOneNative?: NativeBridgeApi;
    ReactNativeWebView?: ReactNativeWebViewApi;
  }
}

export {};
