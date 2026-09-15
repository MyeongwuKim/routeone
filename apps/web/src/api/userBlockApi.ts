/**
 * 용도:
 * 개인별 차단 사용자 목록을 조회하고 차단·해제 요청을 전달한다.
 *
 * 동작 방식:
 * 로그인 세션으로 GraphQL 차단 API를 호출해 사용자 단위 숨김 상태를 관리한다.
 */
import {
  BlockedUsersDocument,
  BlockUserDocument,
  UnblockUserDocument,
} from "@/generated/graphql";
import { requestGraphQL } from "@/lib/graphqlClient";

export const BLOCKED_USERS_QUERY_KEY = ["blocked-users"] as const;

export const userBlockApi = {
  blockedUsers() {
    return requestGraphQL(BlockedUsersDocument);
  },
  blockUser(userId: string) {
    return requestGraphQL(BlockUserDocument, { userId });
  },
  unblockUser(userId: string) {
    return requestGraphQL(UnblockUserDocument, { userId });
  },
};
