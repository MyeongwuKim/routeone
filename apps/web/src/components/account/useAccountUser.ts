/**
 * 계정 화면에서 표시할 사용자를 전역 인증 Store에서 우선 읽고, 값이 없을 때만 me Query를 실행한다.
 * 조회에 성공하면 사용자 정보를 Store에 저장해 다른 계정 화면이 재사용하게 한다.
 */
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { authApi, ME_QUERY_KEY, ME_QUERY_STALE_TIME_MS } from "@/api/authApi";
import { useAuthUserStore } from "@/stores/authUserStore";

export function useAccountUser() {
  const authUser = useAuthUserStore((state) => state.user);
  const setAuthUser = useAuthUserStore((state) => state.setUser);
  const meQuery = useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: authApi.me,
    enabled: !authUser,
    staleTime: ME_QUERY_STALE_TIME_MS,
  });
  const user = authUser ?? meQuery.data?.me ?? null;

  useEffect(() => {
    if (meQuery.data?.me) {
      setAuthUser(meQuery.data.me);
    }
  }, [meQuery.data?.me, setAuthUser]);

  return {
    user,
    /** 캐시와 Store에 사용자가 없고 실제 Query가 대기 또는 요청 중일 때만 true다. */
    isLoading:
      !user &&
      (meQuery.isFetching || (meQuery.isPending && !meQuery.isPaused)),
    /** 현재 me Query를 다시 요청한다. 반환 Promise는 화면에 노출하지 않는다. */
    retry: () => {
      void meQuery.refetch();
    },
  };
}
