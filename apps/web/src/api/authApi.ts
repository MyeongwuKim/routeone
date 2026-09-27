
import {
  DeleteMyAccountDocument,
  LoginWithPasswordDocument,
  MeDocument,
  RefreshAuthSessionDocument,
  type PasswordLoginInput,
} from "@/generated/graphql";
import { requestGraphQL } from "@/lib/graphqlClient";

/** 현재 사용자 조회 캐시를 식별하는 TanStack Query Key다. */
export const ME_QUERY_KEY = ["me"] as const;
/** 로그인 상태의 사용자 정보는 세션 변경 전까지 최신으로 간주하므로 만료 시간을 무한대로 둔다. */
export const ME_QUERY_STALE_TIME_MS = Number.POSITIVE_INFINITY;

/**
 * 사용자 조회, 비밀번호 로그인, 세션 갱신, 회원 탈퇴 GraphQL 요청을 제공한다.
 * 각 메서드는 requestGraphQL의 Promise를 그대로 반환해 호출부가 성공과 오류를 처리하게 한다.
 */
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
  deleteMyAccount() {
    return requestGraphQL(DeleteMyAccountDocument);
  },
};
