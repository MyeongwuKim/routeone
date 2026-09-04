/**
 * 용도:
 * 웹 화면과 처리 중 발생한 예외를 Sentry에 기록한다.
 *
 * 동작 방식:
 * 앱 렌더링 전에 SDK를 초기화하고 사용자 ID와 배포 정보를 태그로 연결한다.
 * 요청 본문, URL 쿼리, 인증 헤더처럼 민감할 수 있는 값은 전송 전에 제거한다.
 */
import * as Sentry from "@sentry/react";
import { useAuthUserStore } from "@/stores/authUserStore";

type WebErrorLevel = "error" | "warning";

type WebErrorContext = {
  source: string;
  level?: WebErrorLevel;
  tags?: Record<string, boolean | number | string | undefined>;
};

const SENSITIVE_DATA_KEYS = new Set([
  "authorization",
  "body",
  "cookie",
  "cookies",
  "data",
  "query",
  "query_string",
  "request_body",
  "response_body",
  "token",
  "variables",
]);

let isInitialized = false;

function getSentryDsn() {
  return import.meta.env.VITE_SENTRY_DSN?.trim() ?? "";
}

function getSentryEnvironment() {
  return (
    import.meta.env.VITE_SENTRY_ENVIRONMENT?.trim() ||
    (import.meta.env.PROD ? "prod" : "local")
  );
}

function getSentryRelease() {
  return (
    import.meta.env.VITE_SENTRY_RELEASE?.trim() ||
    import.meta.env.VITE_APP_VERSION?.trim() ||
    undefined
  );
}

function removeUrlDetails(value: string) {
  try {
    const url = new URL(value, window.location.origin);

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

function removeSensitiveHeaders(
  headers: Record<string, string> | undefined
) {
  if (!headers) {
    return headers;
  }

  return Object.fromEntries(
    Object.entries(headers).filter(
      ([key]) => !SENSITIVE_DATA_KEYS.has(key.toLowerCase())
    )
  );
}

function syncSentryUser() {
  const userId = useAuthUserStore.getState().user?.id;

  Sentry.setUser(userId ? { id: userId } : null);
}

export function initializeWebMonitoring() {
  if (isInitialized || typeof window === "undefined") {
    return;
  }

  const dsn = getSentryDsn();

  if (!dsn) {
    return;
  }

  Sentry.init({
    dsn,
    environment: getSentryEnvironment(),
    release: getSentryRelease(),
    sendDefaultPii: false,
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.category === "console") {
        return null;
      }

      return {
        ...breadcrumb,
        data: removeSensitiveRecordValues(breadcrumb.data),
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
        event.request.headers = removeSensitiveHeaders(event.request.headers);
      }

      event.user = event.user?.id
        ? { id: String(event.user.id) }
        : undefined;
      return event;
    },
  });

  isInitialized = true;
  syncSentryUser();
  useAuthUserStore.subscribe(syncSentryUser);
}

export function getReactRootMonitoringOptions() {
  if (!isInitialized) {
    return undefined;
  }

  return {
    onCaughtError: Sentry.reactErrorHandler(),
    onUncaughtError: Sentry.reactErrorHandler((error, errorInfo) => {
      console.error("[routeone-web] uncaught render error", error, errorInfo);
    }),
    onRecoverableError: Sentry.reactErrorHandler((error, errorInfo) => {
      console.error("[routeone-web] recoverable render error", error, errorInfo);
    }),
  };
}

export function reportHandledWebError(
  error: unknown,
  { source, level = "error", tags = {} }: WebErrorContext
) {
  if (!isInitialized) {
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

    return Sentry.captureException(error);
  });
}
