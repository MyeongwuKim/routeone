import AsyncStorage from "@react-native-async-storage/async-storage";

const NATIVE_AUTH_TOKEN_STORAGE_KEY = "routeone:native-auth-token:v1";
const NATIVE_AUTH_EXPIRES_AT_STORAGE_KEY =
  "routeone:native-auth-expires-at:v1";
const NATIVE_AUTH_ROLE_STORAGE_KEY = "routeone:native-auth-role:v1";
const NATIVE_AUTH_SESSION_ID_STORAGE_KEY =
  "routeone:native-auth-session-id:v1";
const NATIVE_SESSION_CLEANUP_PENDING_STORAGE_KEY =
  "routeone:native-session-cleanup-pending:v1";
const NATIVE_SESSION_CLEANUP_PENDING_VALUE = "pending";
export const NATIVE_AUTH_SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 7;

export type NativeAuthRole = "USER" | "REVIEWER" | "OWNER";

export type StoredNativeAuthSession = {
  token: string | null;
  expiresAt: number | null;
  expired: boolean;
  role: NativeAuthRole | null;
  sessionId: string | null;
};

let nextNativeAuthSessionSequence = 0;
let nativeAuthSessionOperationQueue: Promise<void> = Promise.resolve();

export function enqueueNativeAuthSessionOperation<T>(
  operation: () => Promise<T>
) {
  const request = nativeAuthSessionOperationQueue.then(operation);
  nativeAuthSessionOperationQueue = request.then(
    () => undefined,
    () => undefined
  );

  return request;
}

export function createNativeAuthSessionId() {
  nextNativeAuthSessionSequence += 1;

  return [
    Date.now().toString(36),
    nextNativeAuthSessionSequence.toString(36),
    Math.random().toString(36).slice(2, 12)
  ].join("-");
}

function readStoredRole(value: string | null): NativeAuthRole | null {
  return value === "USER" || value === "REVIEWER" || value === "OWNER"
    ? value
    : null;
}

export async function readStoredNativeAuthSession(): Promise<StoredNativeAuthSession> {
  const [storedToken, storedExpiresAt, storedRole, storedSessionId] =
    await Promise.all([
      AsyncStorage.getItem(NATIVE_AUTH_TOKEN_STORAGE_KEY),
      AsyncStorage.getItem(NATIVE_AUTH_EXPIRES_AT_STORAGE_KEY),
      AsyncStorage.getItem(NATIVE_AUTH_ROLE_STORAGE_KEY),
      AsyncStorage.getItem(NATIVE_AUTH_SESSION_ID_STORAGE_KEY)
    ]);
  const token = storedToken?.trim() || null;

  if (!token) {
    return {
      token: null,
      expiresAt: null,
      expired: false,
      role: null,
      sessionId: storedSessionId?.trim() || null
    };
  }

  const parsedExpiresAt = Number(storedExpiresAt);
  const expiresAt =
    Number.isFinite(parsedExpiresAt) && parsedExpiresAt > 0
      ? parsedExpiresAt
      : Date.now() + NATIVE_AUTH_SESSION_DURATION_MS;

  if (expiresAt <= Date.now()) {
    return {
      token: null,
      expiresAt: null,
      expired: true,
      role: null,
      sessionId: storedSessionId?.trim() || null
    };
  }

  const sessionId = storedSessionId?.trim() || createNativeAuthSessionId();

  if (expiresAt !== parsedExpiresAt || !storedSessionId?.trim()) {
    await Promise.all([
      expiresAt !== parsedExpiresAt
        ? AsyncStorage.setItem(
            NATIVE_AUTH_EXPIRES_AT_STORAGE_KEY,
            String(expiresAt)
          )
        : Promise.resolve(),
      !storedSessionId?.trim()
        ? AsyncStorage.setItem(
            NATIVE_AUTH_SESSION_ID_STORAGE_KEY,
            sessionId
          )
        : Promise.resolve()
    ]);
  }

  return {
    token,
    expiresAt,
    expired: false,
    role: readStoredRole(storedRole),
    sessionId
  };
}

export function storeNativeAuthToken(
  token: string,
  expiresAt = Date.now() + NATIVE_AUTH_SESSION_DURATION_MS,
  role: NativeAuthRole = "USER",
  sessionId = createNativeAuthSessionId()
) {
  const normalizedSessionId =
    sessionId.trim() || createNativeAuthSessionId();

  return Promise.all([
    AsyncStorage.setItem(NATIVE_AUTH_TOKEN_STORAGE_KEY, token),
    AsyncStorage.setItem(
      NATIVE_AUTH_EXPIRES_AT_STORAGE_KEY,
      String(expiresAt)
    ),
    AsyncStorage.setItem(NATIVE_AUTH_ROLE_STORAGE_KEY, role),
    AsyncStorage.setItem(
      NATIVE_AUTH_SESSION_ID_STORAGE_KEY,
      normalizedSessionId
    )
  ]);
}

export function clearStoredNativeAuthToken() {
  return Promise.all([
    AsyncStorage.removeItem(NATIVE_AUTH_TOKEN_STORAGE_KEY),
    AsyncStorage.removeItem(NATIVE_AUTH_EXPIRES_AT_STORAGE_KEY),
    AsyncStorage.removeItem(NATIVE_AUTH_ROLE_STORAGE_KEY),
    AsyncStorage.removeItem(NATIVE_AUTH_SESSION_ID_STORAGE_KEY)
  ]);
}

export function markNativeSessionCleanupPending() {
  return AsyncStorage.setItem(
    NATIVE_SESSION_CLEANUP_PENDING_STORAGE_KEY,
    NATIVE_SESSION_CLEANUP_PENDING_VALUE
  );
}

export async function isNativeSessionCleanupPending() {
  return (
    (await AsyncStorage.getItem(
      NATIVE_SESSION_CLEANUP_PENDING_STORAGE_KEY
    )) === NATIVE_SESSION_CLEANUP_PENDING_VALUE
  );
}

export function clearNativeSessionCleanupPending() {
  return AsyncStorage.removeItem(
    NATIVE_SESSION_CLEANUP_PENDING_STORAGE_KEY
  );
}
