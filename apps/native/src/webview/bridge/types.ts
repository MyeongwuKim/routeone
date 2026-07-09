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
};

export type NativeAuthTokenMessage = {
  type: "routeone:native-auth-token";
  token?: string | null;
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
