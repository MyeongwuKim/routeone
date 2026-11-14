import { unwrapResolverError } from "@apollo/server/errors";
import { GraphQLError } from "graphql";
import type { GraphQLFormattedError } from "graphql";

export const UNEXPECTED_SERVER_ERROR_MESSAGE =
  "요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.";

export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserFacingError";
  }
}

/** 먼저 읽은 방문 기록이 바뀌었으면 저장하지 않고, 클라이언트가 최신 상태를 조회하게 한다. */
export class RouteStopVisitConflictError extends UserFacingError {
  readonly extensions = { code: "USER_FACING_ERROR", http: { status: 409 } };

  constructor() {
    super("방문 기록이 다른 요청에서 변경됐어요. 최신 상태를 확인한 뒤 다시 시도해 주세요.");
  }
}

/** 요청 context에서도 오류 코드와 401을 유지해 클라이언트가 종료된 세션을 정리하게 한다. */
export class AuthSessionError extends GraphQLError {
  constructor(message: string) {
    super(message, { extensions: { code: "UNAUTHENTICATED", http: { status: 401 } } });
  }
}

function createFormattedError(
  formattedError: GraphQLFormattedError,
  message: string,
  code: "USER_FACING_ERROR" | "UNAUTHENTICATED" | "INTERNAL_SERVER_ERROR"
): GraphQLFormattedError {
  return {
    message,
    ...(formattedError.locations
      ? { locations: formattedError.locations }
      : {}),
    ...(formattedError.path ? { path: formattedError.path } : {}),
    extensions: {
      code,
    },
  };
}

export function formatRouteOneGraphQLError(
  formattedError: GraphQLFormattedError,
  error: unknown
): GraphQLFormattedError {
  const originalError = unwrapResolverError(error);

  if (originalError instanceof AuthSessionError) {
    return createFormattedError(formattedError, originalError.message, "UNAUTHENTICATED");
  }

  if (originalError instanceof UserFacingError) {
    return createFormattedError(
      formattedError,
      originalError.message,
      "USER_FACING_ERROR"
    );
  }

  console.error("[graphql] unexpected resolver error", originalError);

  return createFormattedError(
    formattedError,
    UNEXPECTED_SERVER_ERROR_MESSAGE,
    "INTERNAL_SERVER_ERROR"
  );
}
