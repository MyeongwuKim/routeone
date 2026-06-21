import {
  LoginWithPasswordDocument,
  MeDocument,
  type PasswordLoginInput,
} from "@/generated/graphql";
import { requestGraphQL } from "@/lib/graphqlClient";

export const authApi = {
  me() {
    return requestGraphQL(MeDocument);
  },
  loginWithPassword(input: PasswordLoginInput) {
    return requestGraphQL(LoginWithPasswordDocument, {
      input,
    });
  },
};
