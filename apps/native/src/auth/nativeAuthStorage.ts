import AsyncStorage from "@react-native-async-storage/async-storage";

const NATIVE_AUTH_TOKEN_STORAGE_KEY = "routeone:native-auth-token:v1";
const NATIVE_AUTH_EXPIRES_AT_STORAGE_KEY =
  "routeone:native-auth-expires-at:v1";
export const NATIVE_AUTH_SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 7;

export type StoredNativeAuthSession = {
  token: string | null;
  expiresAt: number | null;
  expired: boolean;
};

export async function readStoredNativeAuthSession(): Promise<StoredNativeAuthSession> {
  const [storedToken, storedExpiresAt] = await Promise.all([
    AsyncStorage.getItem(NATIVE_AUTH_TOKEN_STORAGE_KEY),
    AsyncStorage.getItem(NATIVE_AUTH_EXPIRES_AT_STORAGE_KEY)
  ]);
  const token = storedToken?.trim() || null;

  if (!token) {
    return {
      token: null,
      expiresAt: null,
      expired: false
    };
  }

  const parsedExpiresAt = Number(storedExpiresAt);
  const expiresAt =
    Number.isFinite(parsedExpiresAt) && parsedExpiresAt > 0
      ? parsedExpiresAt
      : Date.now() + NATIVE_AUTH_SESSION_DURATION_MS;

  if (expiresAt <= Date.now()) {
    await clearStoredNativeAuthToken();

    return {
      token: null,
      expiresAt: null,
      expired: true
    };
  }

  if (expiresAt !== parsedExpiresAt) {
    await AsyncStorage.setItem(
      NATIVE_AUTH_EXPIRES_AT_STORAGE_KEY,
      String(expiresAt)
    );
  }

  return {
    token,
    expiresAt,
    expired: false
  };
}

export function storeNativeAuthToken(
  token: string,
  expiresAt = Date.now() + NATIVE_AUTH_SESSION_DURATION_MS
) {
  return Promise.all([
    AsyncStorage.setItem(NATIVE_AUTH_TOKEN_STORAGE_KEY, token),
    AsyncStorage.setItem(
      NATIVE_AUTH_EXPIRES_AT_STORAGE_KEY,
      String(expiresAt)
    )
  ]);
}

export function clearStoredNativeAuthToken() {
  return Promise.all([
    AsyncStorage.removeItem(NATIVE_AUTH_TOKEN_STORAGE_KEY),
    AsyncStorage.removeItem(NATIVE_AUTH_EXPIRES_AT_STORAGE_KEY)
  ]);
}
