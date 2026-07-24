import {
  LoginWithPasswordDocument,
  MeDocument,
  RefreshAuthSessionDocument,
  type PasswordLoginInput,
} from "@/generated/graphql";
import { requestGraphQL } from "@/lib/graphqlClient";

export const ME_QUERY_KEY = ["me"] as const;
export const ME_QUERY_STALE_TIME_MS = Number.POSITIVE_INFINITY;

export const authApi = {
  me() {
    return requestGraphQL(MeDocument);
  },
  loginWithPassword(input: PasswordLoginInput) {
    return requestGraphQL(LoginWithPasswordDocument, {
      input,
    });
  },
  refreshAuthSession() {
    return requestGraphQL(RefreshAuthSessionDocument);
  },
};
