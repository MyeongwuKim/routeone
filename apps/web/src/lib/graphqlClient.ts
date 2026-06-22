import { print } from "graphql";
import type { TypedDocumentNode } from "@graphql-typed-document-node/core";
import { getAuthToken } from "./authToken";

const GRAPHQL_ENDPOINT =
  import.meta.env.VITE_GRAPHQL_ENDPOINT ?? "/graphql";
const GRAPHQL_REQUEST_TIMEOUT_MS = getPositiveNumberEnv(
  import.meta.env.VITE_GRAPHQL_REQUEST_TIMEOUT_MS,
  45_000
);
const GRAPHQL_MAX_RETRY_COUNT = getPositiveNumberEnv(
  import.meta.env.VITE_GRAPHQL_MAX_RETRY_COUNT,
  5
);
const GRAPHQL_RETRY_BASE_DELAY_MS = 600;
const GRAPHQL_RETRY_MAX_DELAY_MS = 5_000;
const RETRYABLE_HTTP_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);

type GraphQLResponse<TResult> = {
  data?: TResult;
  errors?: Array<{
    message: string;
  }>;
};

class GraphQLRequestError extends Error {
  retryable: boolean;
  status?: number;

  constructor(message: string, options: { retryable: boolean; status?: number }) {
    super(message);
    this.name = "GraphQLRequestError";
    this.retryable = options.retryable;
    this.status = options.status;
  }
}

function getPositiveNumberEnv(value: string | undefined, fallback: number) {
  const parsedValue = Number(value);

  return Number.isFinite(parsedValue) && parsedValue > 0
    ? parsedValue
    : fallback;
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function getRetryDelayMs(retryIndex: number) {
  const exponentialDelay =
    GRAPHQL_RETRY_BASE_DELAY_MS * 2 ** Math.max(0, retryIndex);
  const jitterMs = Math.floor(Math.random() * 250);

  return Math.min(exponentialDelay + jitterMs, GRAPHQL_RETRY_MAX_DELAY_MS);
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function isRetryableGraphQLError(error: unknown) {
  if (error instanceof GraphQLRequestError) {
    return error.retryable;
  }

  return error instanceof TypeError || isAbortError(error);
}

async function readGraphQLPayload<TResult>(response: Response) {
  try {
    return (await response.json()) as GraphQLResponse<TResult>;
  } catch {
    if (RETRYABLE_HTTP_STATUS_CODES.has(response.status)) {
      throw new GraphQLRequestError(
        `GraphQL request failed: ${response.status}`,
        {
          retryable: true,
          status: response.status,
        }
      );
    }

    throw new GraphQLRequestError("GraphQL 응답을 읽지 못했어요.", {
      retryable: false,
      status: response.status,
    });
  }
}

async function executeGraphQLRequest<TResult>({
  headers,
  body,
}: {
  headers: Record<string, string>;
  body: string;
}) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => {
    controller.abort();
  }, GRAPHQL_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });
    const payload = await readGraphQLPayload<TResult>(response);

    if (!response.ok || payload.errors?.length) {
      throw new GraphQLRequestError(
        payload.errors?.[0]?.message ??
          `GraphQL request failed: ${response.status}`,
        {
          retryable: RETRYABLE_HTTP_STATUS_CODES.has(response.status),
          status: response.status,
        }
      );
    }

    if (!payload.data) {
      throw new GraphQLRequestError("GraphQL 응답 데이터가 비어있습니다.", {
        retryable: false,
      });
    }

    return payload.data;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function requestGraphQL<TResult, TVariables>(
  document: TypedDocumentNode<TResult, TVariables>,
  variables?: TVariables
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const token = getAuthToken();

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const body = JSON.stringify({
    query: print(document),
    variables,
  });

  for (let retryCount = 0; retryCount <= GRAPHQL_MAX_RETRY_COUNT; retryCount += 1) {
    try {
      return await executeGraphQLRequest<TResult>({
        headers,
        body,
      });
    } catch (error) {
      const canRetry =
        retryCount < GRAPHQL_MAX_RETRY_COUNT &&
        isRetryableGraphQLError(error);

      if (!canRetry) {
        throw error instanceof Error
          ? error
          : new Error("GraphQL 요청에 실패했어요.");
      }

      await sleep(getRetryDelayMs(retryCount));
    }
  }

  throw new Error("GraphQL 요청에 실패했어요.");
}
