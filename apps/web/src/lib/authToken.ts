const AUTH_TOKEN_STORAGE_KEY = "routeone.authToken";

function postNativeAuthToken(token: string | null) {
  const reactNativeWebView = (window as Window & {
    ReactNativeWebView?: {
      postMessage: (message: string) => void;
    };
  }).ReactNativeWebView;

  if (!reactNativeWebView) {
    return;
  }

  reactNativeWebView.postMessage(
    JSON.stringify({
      type: "routeone:native-auth-token",
      token,
    })
  );
}

export function getAuthToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
}

export function setAuthToken(token: string) {
  window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
  postNativeAuthToken(token);
}

export function clearAuthToken() {
  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  postNativeAuthToken(null);
}
