/**
 * 용도:
 * API에서 발생한 처리되지 않은 오류를 Sentry에 기록한다.
 *
 * 동작 방식:
 * 서버 시작 전에 SDK를 초기화하고 Fastify 오류와 직접 전달받은 예외를 수집한다.
 * 요청 본문, 쿼리, 쿠키와 인증 헤더는 전송 전에 제거한다.
 */
import * as Sentry from "@sentry/node";
import type { FastifyInstance } from "fastify";

type ApiErrorContext = {
  source: string;
  userId?: string | null;
  tags?: Record<string, boolean | number | string | undefined>;
};

let isInitialized = false;

function normalizeEnvironmentName(value: string | undefined) {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) {
    return null;
  }

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

export function resolveApiSentryEnvironment(
  environment: NodeJS.ProcessEnv = process.env
) {
  const explicitEnvironment =
    normalizeEnvironmentName(environment.SENTRY_ENVIRONMENT) ??
    normalizeEnvironmentName(environment.ROUTEONE_ENV) ??
    normalizeEnvironmentName(environment.APP_ENV);

  if (explicitEnvironment) {
    return explicitEnvironment;
  }

  return environment.NODE_ENV?.trim().toLowerCase() === "production"
    ? "prod"
    : "local";
}

function getApiRelease() {
  const explicitRelease = process.env.SENTRY_RELEASE?.trim();

  if (explicitRelease) {
    return explicitRelease;
  }

  const cloudRunRevision = process.env.K_REVISION?.trim();
  return cloudRunRevision ? `routeone-api@${cloudRunRevision}` : undefined;
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

export function initializeApiMonitoring() {
  if (isInitialized) {
    return;
  }

  const dsn = process.env.SENTRY_DSN?.trim();

  if (!dsn) {
    return;
  }

  Sentry.init({
    dsn,
    environment: resolveApiSentryEnvironment(),
    release: getApiRelease(),
    sendDefaultPii: false,
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.category === "console") {
        return null;
      }

      if (typeof breadcrumb.data?.url === "string") {
        breadcrumb.data.url = removeUrlDetails(breadcrumb.data.url);
      }

      return breadcrumb;
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
        event.request.env = undefined;
      }

      event.user = event.user?.id
        ? { id: String(event.user.id) }
        : undefined;
      return event;
    },
  });

  isInitialized = true;
}

export function setupApiFastifyMonitoring(app: FastifyInstance) {
  if (!isInitialized) {
    return;
  }

  Sentry.setupFastifyErrorHandler(app);
}

export function reportUnexpectedApiError(
  error: unknown,
  { source, userId, tags = {} }: ApiErrorContext
) {
  if (!isInitialized) {
    return null;
  }

  return Sentry.withScope((scope) => {
    scope.setLevel("error");
    scope.setTag("routeone.source", source);

    if (userId) {
      scope.setUser({ id: userId });
    }

    Object.entries(tags).forEach(([key, value]) => {
      if (value !== undefined) {
        scope.setTag(key, value);
      }
    });

    return Sentry.captureException(error);
  });
}
