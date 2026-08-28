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
    isLoading:
      !user &&
      (meQuery.isFetching || (meQuery.isPending && !meQuery.isPaused)),
    retry: () => {
      void meQuery.refetch();
    },
  };
}
