/**
 * 용도:
 * Apollo가 HTTP 응답으로 변환해 Fastify까지 전달하지 않는 서버 오류를 수집한다.
 *
 * 동작 방식:
 * 사용자에게 보여주기 위한 오류와 GraphQL 문법·검증 오류는 제외하고
 * 내부 서버 오류에 작업 이름, 필드 경로와 내부 사용자 ID를 연결한다.
 */
import type { ApolloServerPlugin } from "@apollo/server";
import { unwrapResolverError } from "@apollo/server/errors";
import type { GraphQLError } from "graphql";
import type { GraphQLContext } from "../context.js";
import { UserFacingError } from "../graphql/userFacingError.js";
import { reportUnexpectedApiError } from "./sentry.js";

function getErrorCode(error: GraphQLError) {
  const code = error.extensions.code;
  return typeof code === "string" ? code : undefined;
}

function shouldReportGraphQLError(error: GraphQLError) {
  const originalError = unwrapResolverError(error);

  if (originalError instanceof UserFacingError) {
    return false;
  }

  return getErrorCode(error) === "INTERNAL_SERVER_ERROR";
}

export function createApiSentryApolloPlugin(): ApolloServerPlugin<GraphQLContext> {
  return {
    async requestDidStart() {
      return {
        async didEncounterErrors(requestContext) {
          requestContext.errors
            .filter(shouldReportGraphQLError)
            .forEach((error) => {
              const originalError = unwrapResolverError(error);

              reportUnexpectedApiError(originalError, {
                source: "graphql",
                userId: requestContext.contextValue?.authenticatedUserId,
                tags: {
                  "graphql.error_code": getErrorCode(error),
                  "graphql.operation.name":
                    requestContext.operationName ?? "anonymous",
                  "graphql.path": error.path?.join(".") ?? "unknown",
                },
              });
            });
        },
      };
    },
  };
}
