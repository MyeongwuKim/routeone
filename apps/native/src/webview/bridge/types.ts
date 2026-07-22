import type { MutableRefObject } from "react";

export type WebViewRef = MutableRefObject<{
  injectJavaScript: (script: string) => void;
} | null>;

export type NativeFetchRequest = {
  type: "routeone:native-fetch";
  id: string;
  url: string;
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  };
};

export type NativeBridgeReadyMessage = {
  type: "routeone:native-bridge-ready";
  graphqlEndpoint?: string;
  appVariant?: string;
  webBundleChannel?: string;
  webBundleManifestUrl?: string | null;
  devVerificationBypass?: boolean;
};

export type NativeAuthTokenMessage = {
  type: "routeone:native-auth-token";
  token?: string | null;
};

export type NativeAppInfoRequest = {
  type: "routeone:native-app-info";
  id: string;
};

export type NativeAppInfoContext = {
  webBundleVersion: string | null;
  webBundleKind: "embedded" | "installed";
};

export type NativeLocationRequest = {
  type: "routeone:native-location-current";
  id: string;
};

export type NativePhotoRequest = {
  type: "routeone:native-visit-photo";
  id: string;
  source?: "camera" | "library";
  uploadTarget?: NativePhotoUploadTarget;
};

export type NativePhotoUploadTarget = {
  uploadUrl?: string;
  imageId?: string;
  imageUrl?: string;
  fileName?: string;
  environment?: string;
};

export type NativePhotoUploadRequest = {
  type: "routeone:native-visit-photo-upload";
  id: string;
  photoUri: string;
  uploadTarget: NativePhotoUploadTarget;
};

export type NativeRouteArrivalNotificationPlace = {
  id: string;
  routeId: string;
  routeTitle?: string | null;
  dayId: string;
  dayIndex: number;
  stopId: string;
  title: string;
  lat: number;
  lng: number;
};

export type NativeRouteArrivalNotificationSyncRequest = {
  type: "routeone:native-route-arrival-notifications-sync";
  id: string;
  places: NativeRouteArrivalNotificationPlace[];
  radiusMeters?: number | null;
};

export type NativeExternalUrlRequest = {
  type: "routeone:native-open-url";
  url: string;
};

export type NativeSaveImageRequest = {
  type: "routeone:native-save-image";
  id: string;
  dataUrl: string;
  fileName: string;
  title?: string | null;
};

export type NativeFetchResponse =
  | {
      ok: true;
      status: number;
      statusText: string;
      headers: Record<string, string>;
      body: string;
      url: string;
    }
  | {
      ok: false;
      error: string;
    };

export type NativeFetchSuccessResponse = Extract<
  NativeFetchResponse,
  { ok: true }
>;

export type NativeLocationResponse =
  | {
      ok: true;
      lat: number;
      lng: number;
      accuracyMeters: number | null;
      timestamp: number;
    }
  | {
      ok: false;
      error: string;
    };

export type NativePhotoResponse =
  | {
      ok: true;
      uri: string | null;
      dataUrl?: string | null;
      width: number | null;
      height: number | null;
      uploadedImageId?: string | null;
      uploadedImageUrl?: string | null;
    }
  | {
      ok: false;
      error: string;
    };

export type NativePhotoUploadResponse =
  | {
      ok: true;
      uploadedImageId?: string | null;
      uploadedImageUrl?: string | null;
    }
  | {
      ok: false;
      error: string;
    };

export type NativeRouteArrivalNotificationSyncResponse =
  | {
      ok: true;
      activeCount: number;
      backgroundLocationStatus: string;
      notificationStatus: string;
    }
  | {
      ok: false;
      error: string;
    };

export type NativeSaveImageResponse =
  | {
      ok: true;
      shared: boolean;
      uri?: string | null;
    }
  | {
      ok: false;
      error: string;
    };

export type NativeAppInfoResponse = {
  ok: true;
  platform: string;
  appVersion: string | null;
  buildNumber: string | null;
  runtimeVersion: string | null;
  osVersion: string | null;
  bundleIdentifier: string | null;
  webBundleVersion: string | null;
  webBundleKind: NativeAppInfoContext["webBundleKind"];
  webBundleChannel: string;
  appVariant: string;
};
