import type {
  NativeBridgeApi,
  ReactNativeWebViewApi,
} from "../native-bridge/types";

declare global {
  interface Window {
    __ROUTEONE_NATIVE_AUTH_SESSION_ID__?: string | null;
    RouteOneRuntimeConfig?: {
      graphqlEndpoint?: string;
      routerMode?: "browser" | "hash";
      devVerificationBypass?: boolean;
      reviewerVerificationBypass?: boolean;
      testAccountMode?: boolean;
      arrivalNotificationTestMode?: boolean;
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
