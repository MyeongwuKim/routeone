import { NATIVE_GRAPHQL_ENDPOINT } from "../webview/bridge/fetchBridge";

export type NativeAuthUser = {
  id: string;
  accountId: string | null;
  email: string | null;
  displayName: string | null;
  locale: string | null;
};

export type NativeAuthPayload = {
  token: string;
  user: NativeAuthUser;
};

type GraphQLResponse<T> = {
  data?: T;
  errors?: Array<{
    message?: string;
  }>;
};

const AUTH_USER_FIELDS = `
  id
  accountId
  email
  displayName
  locale
`;

const LOGIN_WITH_PASSWORD_MUTATION = `
  mutation NativeLoginWithPassword($input: PasswordLoginInput!) {
    loginWithPassword(input: $input) {
      token
      user {
        ${AUTH_USER_FIELDS}
      }
    }
  }
`;

const LOGIN_WITH_NATIVE_OAUTH_MUTATION = `
  mutation NativeLoginWithOAuth($input: NativeOAuthLoginInput!) {
    loginWithNativeOAuth(input: $input) {
      token
      user {
        ${AUTH_USER_FIELDS}
      }
    }
  }
`;

async function requestNativeAuth<T>(
  query: string,
  variables: Record<string, unknown>
) {
  const response = await fetch(NATIVE_GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      query,
      variables
    })
  });
  const payload = (await response.json()) as GraphQLResponse<T>;
  const errorMessage = payload.errors
    ?.map((error) => error.message)
    .filter(Boolean)
    .join("\n");

  if (!response.ok || errorMessage) {
    throw new Error(errorMessage || "로그인 요청에 실패했어요.");
  }

  if (!payload.data) {
    throw new Error("로그인 응답을 읽지 못했어요.");
  }

  return payload.data;
}

export async function loginWithNativePassword(input: {
  accountId: string;
  password: string;
  displayName?: string;
}) {
  const data = await requestNativeAuth<{
    loginWithPassword: NativeAuthPayload;
  }>(LOGIN_WITH_PASSWORD_MUTATION, {
    input
  });

  return data.loginWithPassword;
}

export async function loginWithNativeOAuth(input: {
  provider: "GOOGLE" | "APPLE";
  identityToken: string;
  displayName?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
}) {
  const data = await requestNativeAuth<{
    loginWithNativeOAuth: NativeAuthPayload;
  }>(LOGIN_WITH_NATIVE_OAUTH_MUTATION, {
    input
  });

  return data.loginWithNativeOAuth;
}
