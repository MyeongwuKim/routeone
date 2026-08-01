import type {
  NativeAppInfoResponse,
  NativeDeliveredNotificationHistoryResponse,
  NativeFetchResponse,
  NativeFestivalNotificationSyncResponse,
  NativeLocationResponse,
  NativePhotoUploadResponse,
  NativePhotoResponse,
  NativePushTokenResponse,
  NativeRouteArrivalNotificationSyncResponse,
  NativeRouteArrivalTestLocationResponse,
  NativeRouteReviewNotificationSyncResponse,
  NativeSaveImageResponse,
  WebViewRef,
} from "./types";

export function postNativeAppInfoResponse(
  webViewRef: WebViewRef,
  id: string,
  payload: NativeAppInfoResponse
) {
  postNativeResponse(
    webViewRef,
    "__ROUTEONE_NATIVE_APP_INFO_RESPONSE__",
    id,
    payload
  );
}

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

export function postNativeRouteArrivalTestLocationResponse(
  webViewRef: WebViewRef,
  id: string,
  payload: NativeRouteArrivalTestLocationResponse
) {
  postNativeResponse(
    webViewRef,
    "__ROUTEONE_NATIVE_ROUTE_ARRIVAL_TEST_LOCATION_RESPONSE__",
    id,
    payload
  );
}

export function postNativeDeliveredNotificationHistoryResponse(
  webViewRef: WebViewRef,
  id: string,
  payload: NativeDeliveredNotificationHistoryResponse
) {
  postNativeResponse(
    webViewRef,
    "__ROUTEONE_NATIVE_DELIVERED_NOTIFICATION_HISTORY_RESPONSE__",
    id,
    payload
  );
}

export function postNativePushTokenResponse(
  webViewRef: WebViewRef,
  id: string,
  payload: NativePushTokenResponse
) {
  postNativeResponse(
    webViewRef,
    "__ROUTEONE_NATIVE_PUSH_TOKEN_RESPONSE__",
    id,
    payload
  );
}

export function postNativeFestivalNotificationSyncResponse(
  webViewRef: WebViewRef,
  id: string,
  payload: NativeFestivalNotificationSyncResponse
) {
  postNativeResponse(
    webViewRef,
    "__ROUTEONE_NATIVE_FESTIVAL_NOTIFICATIONS_SYNC_RESPONSE__",
    id,
    payload
  );
}

export function postNativeRouteReviewNotificationSyncResponse(
  webViewRef: WebViewRef,
  id: string,
  payload: NativeRouteReviewNotificationSyncResponse
) {
  postNativeResponse(
    webViewRef,
    "__ROUTEONE_NATIVE_ROUTE_REVIEW_NOTIFICATIONS_SYNC_RESPONSE__",
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
