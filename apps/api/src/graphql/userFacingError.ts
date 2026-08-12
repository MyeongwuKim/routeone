import { unwrapResolverError } from "@apollo/server/errors";
import type { GraphQLFormattedError } from "graphql";

export const UNEXPECTED_SERVER_ERROR_MESSAGE =
  "요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.";

export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserFacingError";
  }
}

function createFormattedError(
  formattedError: GraphQLFormattedError,
  message: string,
  code: "USER_FACING_ERROR" | "INTERNAL_SERVER_ERROR"
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
