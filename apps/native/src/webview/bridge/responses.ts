import type {
  NativeFetchResponse,
  NativeLocationResponse,
  NativePhotoUploadResponse,
  NativePhotoResponse,
  NativeRouteArrivalNotificationSyncResponse,
  NativeSaveImageResponse,
  WebViewRef,
} from "./types";

function postNativeResponse(
  webViewRef: WebViewRef,
  handlerName: string,
  id: string,
  payload: unknown
) {
  webViewRef.current?.injectJavaScript(
    `window.${handlerName}(${JSON.stringify(id)}, ${JSON.stringify(
      payload
    )}); true;`
  );
}

export function postNativeFetchResponse(
  webViewRef: WebViewRef,
  id: string,
  payload: NativeFetchResponse
) {
  postNativeResponse(
    webViewRef,
    "__ROUTEONE_NATIVE_FETCH_RESPONSE__",
    id,
    payload
  );
}

export function postNativeLocationResponse(
  webViewRef: WebViewRef,
  id: string,
  payload: NativeLocationResponse
) {
  postNativeResponse(
    webViewRef,
    "__ROUTEONE_NATIVE_LOCATION_RESPONSE__",
    id,
    payload
  );
}

export function postNativePhotoResponse(
  webViewRef: WebViewRef,
  id: string,
  payload: NativePhotoResponse
) {
  postNativeResponse(
    webViewRef,
    "__ROUTEONE_NATIVE_PHOTO_RESPONSE__",
    id,
    payload
  );
}

export function postNativePhotoUploadResponse(
  webViewRef: WebViewRef,
  id: string,
  payload: NativePhotoUploadResponse
) {
  postNativeResponse(
    webViewRef,
    "__ROUTEONE_NATIVE_PHOTO_UPLOAD_RESPONSE__",
    id,
    payload
  );
}

export function postNativeRouteArrivalNotificationSyncResponse(
  webViewRef: WebViewRef,
  id: string,
  payload: NativeRouteArrivalNotificationSyncResponse
) {
  postNativeResponse(
    webViewRef,
    "__ROUTEONE_NATIVE_ROUTE_ARRIVAL_NOTIFICATIONS_SYNC_RESPONSE__",
    id,
    payload
  );
}

export function postNativeSaveImageResponse(
  webViewRef: WebViewRef,
  id: string,
  payload: NativeSaveImageResponse
) {
  postNativeResponse(
    webViewRef,
    "__ROUTEONE_NATIVE_SAVE_IMAGE_RESPONSE__",
    id,
    payload
  );
}
