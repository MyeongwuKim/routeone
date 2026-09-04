/**
 * 용도:
 * 네이티브 앱과 기기 기능 처리 중 발생한 예외를 Sentry에 기록한다.
 *
 * 동작 방식:
 * 앱 진입 시 SDK를 초기화하고 자동 크래시와 직접 전달받은 예외를 수집한다.
 * 요청 본문, URL 쿼리, 쿠키와 인증 헤더는 전송 전에 제거한다.
 */
import * as Sentry from "@sentry/react-native";
import Constants from "expo-constants";
import { WEB_BUNDLE_UPDATE_CONFIG } from "@/config/webBundleUpdateConfig";

type NativeErrorLevel = "error" | "warning";

type NativeErrorContext = {
  source: string;
  level?: NativeErrorLevel;
  tags?: Record<string, boolean | number | string | undefined>;
};

const SENSITIVE_DATA_KEYS = new Set([
  "authorization",
  "body",
  "cookie",
  "cookies",
  "data",
  "headers",
  "password",
  "query",
  "query_string",
  "request_body",
  "response_body",
  "token",
  "variables"
]);

let isInitialized = false;

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEnvironmentName(value: string) {
  const normalized = value.toLowerCase();

  if (normalized === "production") {
    return "prod";
  }

  if (normalized === "development") {
    return "dev";
  }

  if (normalized === "none") {
    return "local";
  }

  return normalized;
}

export function resolveNativeSentryEnvironment() {
  const explicitEnvironment = readString(
    process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT
  );

  if (explicitEnvironment) {
    return normalizeEnvironmentName(explicitEnvironment);
  }

  return __DEV__ ? "local" : WEB_BUNDLE_UPDATE_CONFIG.appVariant;
}

function removeUrlDetails(value: string) {
  try {
    const url = new URL(value);

    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return value.split(/[?#]/, 1)[0] ?? value;
  }
}

function removeSensitiveRecordValues(
  values: Record<string, unknown> | undefined
) {
  if (!values) {
    return values;
  }

  return Object.fromEntries(
    Object.entries(values).flatMap(([key, value]) => {
      const normalizedKey = key.toLowerCase();

      if (SENSITIVE_DATA_KEYS.has(normalizedKey)) {
        return [];
      }

      if (
        typeof value === "string" &&
        ["from", "to", "url"].includes(normalizedKey)
      ) {
        return [[key, removeUrlDetails(value)]];
      }

      return [[key, value]];
    })
  );
}

function toError(error: unknown) {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === "string") {
    return new Error(error);
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return new Error(error.message);
  }

  return new Error("Unknown native error");
}

function setBuildTags() {
  const appVersion = readString(Constants.expoConfig?.version);
  const buildNumber =
    readString(Constants.expoConfig?.ios?.buildNumber) ||
    (typeof Constants.expoConfig?.android?.versionCode === "number"
      ? String(Constants.expoConfig.android.versionCode)
      : "");

  Sentry.setTag("routeone.app_variant", WEB_BUNDLE_UPDATE_CONFIG.appVariant);

  if (appVersion) {
    Sentry.setTag("routeone.app_version", appVersion);
  }

  if (buildNumber) {
    Sentry.setTag("routeone.build_number", buildNumber);
  }
}

export function initializeNativeMonitoring() {
  if (isInitialized) {
    return true;
  }

  const dsn = readString(process.env.EXPO_PUBLIC_SENTRY_DSN);

  if (!dsn) {
    return false;
  }

  Sentry.init({
    dsn,
    environment: resolveNativeSentryEnvironment(),
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.category === "console") {
        return null;
      }

      return {
        ...breadcrumb,
        data: removeSensitiveRecordValues(breadcrumb.data)
      };
    },
    beforeSend(event) {
      if (event.request) {
        event.request.url = event.request.url
          ? removeUrlDetails(event.request.url)
          : event.request.url;
        event.request.data = undefined;
        event.request.cookies = undefined;
        event.request.query_string = undefined;
        event.request.headers = undefined;
      }

      event.user = event.user?.id
        ? { id: String(event.user.id) }
        : undefined;
      return event;
    }
  });

  isInitialized = true;
  setBuildTags();
  return true;
}

export function reportHandledNativeError(
  error: unknown,
  { source, level = "error", tags = {} }: NativeErrorContext
) {
  if (!isInitialized && !initializeNativeMonitoring()) {
    return null;
  }

  return Sentry.withScope((scope) => {
    scope.setLevel(level);
    scope.setTag("routeone.source", source);

    Object.entries(tags).forEach(([key, value]) => {
      if (value !== undefined) {
        scope.setTag(key, value);
      }
    });

    return Sentry.captureException(toError(error));
  });
}
