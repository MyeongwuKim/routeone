import { print } from "graphql";
import type { TypedDocumentNode } from "@graphql-typed-document-node/core";

const GRAPHQL_ENDPOINT =
  import.meta.env.VITE_GRAPHQL_ENDPOINT ?? "/graphql";

type GraphQLResponse<TResult> = {
  data?: TResult;
  errors?: Array<{
    message: string;
  }>;
};

export async function requestGraphQL<TResult, TVariables>(
  document: TypedDocumentNode<TResult, TVariables>,
  variables?: TVariables
) {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: print(document),
      variables,
    }),
  });

  const payload = (await response.json()) as GraphQLResponse<TResult>;

  if (!response.ok || payload.errors?.length) {
    throw new Error(
      payload.errors?.[0]?.message ?? `GraphQL request failed: ${response.status}`
    );
  }

  if (!payload.data) {
    throw new Error("GraphQL 응답 데이터가 비어있습니다.");
  }

  return payload.data;
}
