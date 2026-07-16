import { WEB_BUNDLE_UPDATE_CONFIG } from "../../config/webBundleUpdateConfig";

const ROUTEONE_RUNTIME_CONFIG = {
  graphqlEndpoint: "/graphql",
  routerMode: "hash",
  nativeAppVariant: WEB_BUNDLE_UPDATE_CONFIG.appVariant,
  webBundleChannel: WEB_BUNDLE_UPDATE_CONFIG.channel,
  webBundleManifestUrl: WEB_BUNDLE_UPDATE_CONFIG.manifestUrl,
  webBundleVersionsUrl: WEB_BUNDLE_UPDATE_CONFIG.versionsUrl
};

export const ROUTEONE_WEBVIEW_BRIDGE_SCRIPT = `
(function installRouteOneNativeBridge() {
  if (window.__ROUTEONE_NATIVE_BRIDGE_INSTALLED__) {
    return true;
  }

  window.__ROUTEONE_NATIVE_BRIDGE_INSTALLED__ = true;
  window.RouteOneRuntimeConfig = Object.assign({}, window.RouteOneRuntimeConfig, ${JSON.stringify(
    ROUTEONE_RUNTIME_CONFIG
  )});

  var didPostBridgeReady = false;

  function postBridgeReady() {
    if (didPostBridgeReady || !window.ReactNativeWebView) {
      return;
    }

    didPostBridgeReady = true;
    window.ReactNativeWebView.postMessage(
      JSON.stringify({
        type: "routeone:native-bridge-ready",
        graphqlEndpoint: window.RouteOneRuntimeConfig.graphqlEndpoint,
        appVariant: window.RouteOneRuntimeConfig.nativeAppVariant,
        webBundleChannel: window.RouteOneRuntimeConfig.webBundleChannel,
        webBundleManifestUrl: window.RouteOneRuntimeConfig.webBundleManifestUrl
      })
    );
  }

  function lockViewportZoom() {
    var viewport = document.querySelector("meta[name='viewport']");

    if (!viewport) {
      viewport = document.createElement("meta");
      viewport.setAttribute("name", "viewport");

      if (document.head) {
        document.head.appendChild(viewport);
      }
    }

    viewport.setAttribute(
      "content",
      "width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no, viewport-fit=cover"
    );

    if (document.documentElement) {
      document.documentElement.style.touchAction = "manipulation";
    }

    if (document.body) {
      document.body.style.touchAction = "manipulation";
    }
  }

  var lastTouchEndAt = 0;

  lockViewportZoom();

  document.addEventListener("DOMContentLoaded", lockViewportZoom, { once: true });
  document.addEventListener(
    "dblclick",
    function preventDoubleClickZoom(event) {
      event.preventDefault();
    },
    { capture: true, passive: false }
  );
  document.addEventListener(
    "gesturestart",
    function preventGestureZoom(event) {
      event.preventDefault();
    },
    { capture: true, passive: false }
  );
  document.addEventListener(
    "touchend",
    function preventDoubleTapZoom(event) {
      var now = Date.now();

      if (now - lastTouchEndAt <= 320) {
        event.preventDefault();
      }

      lastTouchEndAt = now;
    },
    { capture: true, passive: false }
  );
  postBridgeReady();
  window.setTimeout(postBridgeReady, 250);

  var originalFetch = window.fetch.bind(window);
  var pendingRequests = Object.create(null);
  var pendingLocationRequests = Object.create(null);
  var pendingPhotoRequests = Object.create(null);
  var pendingPhotoUploadRequests = Object.create(null);
  var pendingRouteArrivalNotificationSyncRequests = Object.create(null);
  var pendingSaveImageRequests = Object.create(null);
  var requestSeq = 0;

  function getUrl(input) {
    if (typeof input === "string") {
      return input;
    }

    if (input && typeof input.url === "string") {
      return input.url;
    }

    return "";
  }

  function getMethod(input, init) {
    if (init && init.method) {
      return init.method;
    }

    if (input && typeof input.method === "string") {
      return input.method;
    }

    return "GET";
  }

  function getBody(init) {
    if (init && typeof init.body === "string") {
      return init.body;
    }

    return undefined;
  }

  function shouldUseNativeFetch(inputUrl) {
    try {
      var url = new URL(inputUrl, window.location.href);
      return (
        url.pathname === "/graphql" ||
        url.pathname.indexOf("/tour-api/") === 0 ||
        url.pathname.indexOf("/map-direction/") === 0
      );
    } catch (error) {
      return false;
    }
  }

  function shouldOpenExternalUrl(inputUrl) {
    if (!inputUrl) {
      return false;
    }

    try {
      var url = new URL(String(inputUrl), window.location.href);

      if (
        url.protocol === "about:" ||
        url.protocol === "data:" ||
        url.protocol === "blob:" ||
        url.protocol === "javascript:"
      ) {
        return false;
      }

      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return true;
      }

      return url.origin !== window.location.origin;
    } catch (error) {
      return false;
    }
  }

  function postOpenExternalUrl(inputUrl) {
    if (!window.ReactNativeWebView || !shouldOpenExternalUrl(inputUrl)) {
      return false;
    }

    var url = new URL(String(inputUrl), window.location.href);

    window.ReactNativeWebView.postMessage(
      JSON.stringify({
        type: "routeone:native-open-url",
        url: url.href
      })
    );

    return true;
  }

  function normalizeHeaders(headers) {
    var normalized = {};

    if (!headers) {
      return normalized;
    }

    if (typeof Headers !== "undefined" && headers instanceof Headers) {
      headers.forEach(function eachHeader(value, key) {
        normalized[key] = value;
      });
      return normalized;
    }

    if (Array.isArray(headers)) {
      headers.forEach(function eachHeader(entry) {
        if (entry && entry.length >= 2) {
          normalized[String(entry[0])] = String(entry[1]);
        }
      });
      return normalized;
    }

    Object.keys(headers).forEach(function eachHeader(key) {
      normalized[key] = String(headers[key]);
    });

    return normalized;
  }

  window.__ROUTEONE_NATIVE_FETCH_RESPONSE__ = function handleNativeFetchResponse(id, payload) {
    var handlers = pendingRequests[id];

    if (!handlers) {
      return;
    }

    delete pendingRequests[id];

    if (!payload || !payload.ok) {
      handlers.reject(new TypeError((payload && payload.error) || "Native fetch failed"));
      return;
    }

    handlers.resolve(
      new Response(payload.body, {
        status: payload.status,
        statusText: payload.statusText,
        headers: payload.headers
      })
    );
  };

  window.__ROUTEONE_NATIVE_LOCATION_RESPONSE__ = function handleNativeLocationResponse(id, payload) {
    var handlers = pendingLocationRequests[id];

    if (!handlers) {
      return;
    }

    delete pendingLocationRequests[id];

    if (!payload || !payload.ok) {
      handlers.reject(new Error((payload && payload.error) || "Native location failed"));
      return;
    }

    handlers.resolve({
      lat: payload.lat,
      lng: payload.lng,
      accuracyMeters: payload.accuracyMeters,
      timestamp: payload.timestamp
    });
  };

  window.__ROUTEONE_NATIVE_PHOTO_RESPONSE__ = function handleNativePhotoResponse(id, payload) {
    var handlers = pendingPhotoRequests[id];

    if (!handlers) {
      return;
    }

    delete pendingPhotoRequests[id];

    if (!payload || !payload.ok) {
      handlers.reject(new Error((payload && payload.error) || "Native photo failed"));
      return;
    }

    handlers.resolve({
      uri: payload.uri,
      dataUrl: payload.dataUrl,
      width: payload.width,
      height: payload.height,
      uploadedImageId: payload.uploadedImageId,
      uploadedImageUrl: payload.uploadedImageUrl
    });
  };

  window.__ROUTEONE_NATIVE_PHOTO_UPLOAD_RESPONSE__ = function handleNativePhotoUploadResponse(id, payload) {
    var handlers = pendingPhotoUploadRequests[id];

    if (!handlers) {
      return;
    }

    delete pendingPhotoUploadRequests[id];

    if (!payload || !payload.ok) {
      handlers.reject(new Error((payload && payload.error) || "Native photo upload failed"));
      return;
    }

    handlers.resolve({
      uploadedImageId: payload.uploadedImageId,
      uploadedImageUrl: payload.uploadedImageUrl
    });
  };

  window.__ROUTEONE_NATIVE_ROUTE_ARRIVAL_NOTIFICATIONS_SYNC_RESPONSE__ = function handleNativeRouteArrivalNotificationsSyncResponse(id, payload) {
    var handlers = pendingRouteArrivalNotificationSyncRequests[id];

    if (!handlers) {
      return;
    }

    delete pendingRouteArrivalNotificationSyncRequests[id];

    if (!payload || !payload.ok) {
      handlers.reject(new Error((payload && payload.error) || "Native route arrival notification sync failed"));
      return;
    }

    handlers.resolve({
      activeCount: payload.activeCount,
      backgroundLocationStatus: payload.backgroundLocationStatus,
      notificationStatus: payload.notificationStatus
    });
  };

  window.__ROUTEONE_NATIVE_SAVE_IMAGE_RESPONSE__ = function handleNativeSaveImageResponse(id, payload) {
    var handlers = pendingSaveImageRequests[id];

    if (!handlers) {
      return;
    }

    delete pendingSaveImageRequests[id];

    if (!payload || !payload.ok) {
      handlers.reject(new Error((payload && payload.error) || "Native image save failed"));
      return;
    }

    handlers.resolve({
      shared: payload.shared,
      uri: payload.uri
    });
  };

  window.RouteOneNative = Object.assign({}, window.RouteOneNative, {
    getCurrentPosition: function getCurrentPosition() {
      if (!window.ReactNativeWebView) {
        return Promise.reject(new Error("Native bridge is not available"));
      }

      var requestId = "native-location-" + Date.now() + "-" + requestSeq++;

      return new Promise(function routeOneNativeLocation(resolve, reject) {
        pendingLocationRequests[requestId] = { resolve: resolve, reject: reject };

        window.ReactNativeWebView.postMessage(
          JSON.stringify({
            type: "routeone:native-location-current",
            id: requestId
          })
        );
      });
    },
    takeVisitPhoto: function takeVisitPhoto(options) {
      if (!window.ReactNativeWebView) {
        return Promise.reject(new Error("Native bridge is not available"));
      }

      var requestId = "native-photo-" + Date.now() + "-" + requestSeq++;
      var uploadTarget = options && options.uploadTarget ? options.uploadTarget : null;
      var source = options && options.source === "library" ? "library" : "camera";

      return new Promise(function routeOneNativePhoto(resolve, reject) {
        pendingPhotoRequests[requestId] = { resolve: resolve, reject: reject };

        window.ReactNativeWebView.postMessage(
          JSON.stringify({
            type: "routeone:native-visit-photo",
            id: requestId,
            source: source,
            uploadTarget: uploadTarget
          })
        );
      });
    },
    uploadVisitPhoto: function uploadVisitPhoto(options) {
      if (!window.ReactNativeWebView) {
        return Promise.reject(new Error("Native bridge is not available"));
      }

      var requestId = "native-photo-upload-" + Date.now() + "-" + requestSeq++;
      var photoUri = options && options.photoUri ? options.photoUri : "";
      var uploadTarget = options && options.uploadTarget ? options.uploadTarget : null;

      return new Promise(function routeOneNativePhotoUpload(resolve, reject) {
        pendingPhotoUploadRequests[requestId] = { resolve: resolve, reject: reject };

        window.ReactNativeWebView.postMessage(
          JSON.stringify({
            type: "routeone:native-visit-photo-upload",
            id: requestId,
            photoUri: photoUri,
            uploadTarget: uploadTarget
          })
        );
      });
    },
    syncRouteArrivalNotifications: function syncRouteArrivalNotifications(options) {
      if (!window.ReactNativeWebView) {
        return Promise.reject(new Error("Native bridge is not available"));
      }

      var requestId = "native-route-arrival-notifications-" + Date.now() + "-" + requestSeq++;
      var places = options && Array.isArray(options.places) ? options.places : [];
      var radiusMeters = options && typeof options.radiusMeters === "number" ? options.radiusMeters : null;

      return new Promise(function routeOneNativeRouteArrivalNotifications(resolve, reject) {
        pendingRouteArrivalNotificationSyncRequests[requestId] = { resolve: resolve, reject: reject };

        window.ReactNativeWebView.postMessage(
          JSON.stringify({
            type: "routeone:native-route-arrival-notifications-sync",
            id: requestId,
            places: places,
            radiusMeters: radiusMeters
          })
        );
      });
    },
    saveImage: function saveImage(options) {
      if (!window.ReactNativeWebView) {
        return Promise.reject(new Error("Native bridge is not available"));
      }

      var requestId = "native-save-image-" + Date.now() + "-" + requestSeq++;
      var dataUrl = options && options.dataUrl ? options.dataUrl : "";
      var fileName = options && options.fileName ? options.fileName : "routeone-card.png";
      var title = options && options.title ? options.title : null;

      return new Promise(function routeOneNativeSaveImage(resolve, reject) {
        pendingSaveImageRequests[requestId] = { resolve: resolve, reject: reject };

        window.ReactNativeWebView.postMessage(
          JSON.stringify({
            type: "routeone:native-save-image",
            id: requestId,
            dataUrl: dataUrl,
            fileName: fileName,
            title: title
          })
        );
      });
    },
    openExternalUrl: function openExternalUrl(url) {
      return postOpenExternalUrl(url);
    }
  });

  var originalWindowOpen = window.open ? window.open.bind(window) : null;
  window.open = function routeOneWindowOpen(url, target, features) {
    if (postOpenExternalUrl(url)) {
      return null;
    }

    if (originalWindowOpen) {
      return originalWindowOpen(url, target, features);
    }

    return null;
  };

  window.fetch = function routeOneFetch(input, init) {
    var inputUrl = getUrl(input);

    if (!inputUrl || !shouldUseNativeFetch(inputUrl) || !window.ReactNativeWebView) {
      return originalFetch(input, init);
    }

    var requestInit = init || {};
    var requestId = "native-fetch-" + Date.now() + "-" + requestSeq++;

    return new Promise(function routeOneNativeFetch(resolve, reject) {
      pendingRequests[requestId] = { resolve: resolve, reject: reject };

      window.ReactNativeWebView.postMessage(
        JSON.stringify({
          type: "routeone:native-fetch",
          id: requestId,
          url: inputUrl,
          init: {
            method: getMethod(input, requestInit),
            headers: normalizeHeaders(requestInit.headers),
            body: getBody(requestInit)
          }
        })
      );
    });
  };

  return true;
})();
`;
