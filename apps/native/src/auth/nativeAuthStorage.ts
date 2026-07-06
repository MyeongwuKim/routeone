import AsyncStorage from "@react-native-async-storage/async-storage";

const NATIVE_AUTH_TOKEN_STORAGE_KEY = "routeone:native-auth-token:v1";

export async function readStoredNativeAuthToken() {
  const token = await AsyncStorage.getItem(NATIVE_AUTH_TOKEN_STORAGE_KEY);

  return token?.trim() || null;
}

export function storeNativeAuthToken(token: string) {
  return AsyncStorage.setItem(NATIVE_AUTH_TOKEN_STORAGE_KEY, token);
}

export function clearStoredNativeAuthToken() {
  return AsyncStorage.removeItem(NATIVE_AUTH_TOKEN_STORAGE_KEY);
}
