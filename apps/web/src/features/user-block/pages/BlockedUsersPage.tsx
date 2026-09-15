/**
 * 진입 경로: 내 정보 → 차단 사용자 관리
 *
 * 용도:
 * 내 화면에서 숨긴 사용자를 확인하고 필요할 때 차단을 해제한다.
 *
 * 구조:
 * 화면 안내, 차단 사용자 목록, 사용자별 차단 해제 버튼으로 구성되어 있다.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { MdArrowBack, MdBlock } from "react-icons/md";
import {
  BLOCKED_USERS_QUERY_KEY,
  userBlockApi,
} from "@/api/userBlockApi";
import AccountAvatar from "@/components/account/AccountAvatar";
import { PotatoLoadingCard } from "@/components/feedback/PotatoLoadingOverlay";
import { BlockedUsersListSkeleton } from "../components/BlockedUsersSkeleton";
import {
  LIKED_SHARED_ROUTES_QUERY_KEY,
  SHARED_ROUTES_QUERY_KEY,
} from "@/features/shared-route/queries/sharedRouteQueryKeys";
import type { BlockedUsersQuery } from "@/generated/graphql";
import { getAccountDisplayName } from "@/lib/accountDisplay";
import { useUiText } from "@/lib/uiText";
import { useUiToastStore } from "@/stores/uiToastStore";

function BlockedUsersPage() {
  const text = useUiText();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const showToast = useUiToastStore((state) => state.showToast);
  const blockedUsersQuery = useQuery({
    queryKey: BLOCKED_USERS_QUERY_KEY,
    queryFn: userBlockApi.blockedUsers,
  });
  const unblockMutation = useMutation({
    mutationFn: userBlockApi.unblockUser,
    onSuccess: (result) => {
      const unblockedUser = result.unblockUser;
      queryClient.setQueryData<BlockedUsersQuery>(
        BLOCKED_USERS_QUERY_KEY,
        (current) =>
          current
            ? {
                blockedUsers: current.blockedUsers.filter(
                  (user) => user.id !== unblockedUser.id
                ),
              }
            : current
      );
      void queryClient.invalidateQueries({ queryKey: SHARED_ROUTES_QUERY_KEY });
      void queryClient.invalidateQueries({
        queryKey: LIKED_SHARED_ROUTES_QUERY_KEY,
      });
      void queryClient.invalidateQueries({ queryKey: ["place-photos"] });
      showToast(
        text.userBlock.unblockedToast(
          getAccountDisplayName(unblockedUser, text.account.fallbackName)
        )
      );
    },
    onError: (error) => {
      showToast(
        error instanceof Error ? error.message : text.userBlock.unblockFailed,
        3000
      );
    },
  });
  const blockedUsers = blockedUsersQuery.data?.blockedUsers ?? [];

  return (
    <section className="space-y-4 pb-8 text-slate-900">
      <header className="flex items-center gap-3">
        <button
          type="button"
          aria-label={text.common.backToMyInfo}
          onClick={() => navigate("/me")}
          className="inline-flex size-12 shrink-0 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-xl text-brand-700 shadow-sm transition hover:bg-brand-100 dark:border-brand-400/30 dark:bg-[#0f3431] dark:text-brand-200"
        >
          <MdArrowBack />
        </button>
        <div className="min-w-0">
          <p className="text-xs font-black text-brand-700">
            {text.routeShell.myInfoTitle}
          </p>
          <h1 className="truncate text-lg font-bold text-slate-900 dark:text-white">
            {text.userBlock.pageTitle}
          </h1>
        </div>
      </header>

      <div className="rounded-2xl border border-brand-100 bg-white p-4 text-sm font-semibold leading-6 text-slate-600 shadow-sm dark:border-brand-400/25 dark:bg-slate-950/40 dark:text-slate-300">
        {text.userBlock.pageDescription}
      </div>

      {blockedUsersQuery.isPending ? (
        <BlockedUsersListSkeleton />
      ) : blockedUsersQuery.isError ? (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-semibold text-rose-700 dark:border-rose-400/30 dark:bg-rose-950/30 dark:text-rose-200">
          <p>{text.userBlock.loadError}</p>
          <button
            type="button"
            onClick={() => void blockedUsersQuery.refetch()}
            className="mt-3 rounded-full bg-rose-600 px-4 py-2 text-xs font-bold text-white"
          >
            {text.common.retry}
          </button>
        </div>
      ) : blockedUsers.length === 0 ? (
        <PotatoLoadingCard
          title={text.userBlock.emptyTitle}
          description={text.userBlock.emptyDescription}
          animation="empty"
          compact
        />
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-sm dark:border-brand-400/25 dark:bg-slate-950/40">
          {blockedUsers.map((user, index) => {
            const displayName = getAccountDisplayName(
              user,
              text.account.fallbackName
            );
            const isPending =
              unblockMutation.isPending && unblockMutation.variables === user.id;

            return (
              <li
                key={user.id}
                className={`flex items-center gap-3 px-4 py-3 ${
                  index > 0 ? "border-t border-brand-50" : ""
                }`}
              >
                <AccountAvatar
                  user={user}
                  fallbackName={text.account.fallbackName}
                  className="size-11 ring-2"
                  textClassName="text-base"
                />
                <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-900 dark:text-white">
                  {displayName}
                </span>
                <button
                  type="button"
                  aria-label={text.userBlock.unblockAria(displayName)}
                  disabled={isPending}
                  onClick={() => unblockMutation.mutate(user.id)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  <MdBlock />
                  {text.userBlock.unblock}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default BlockedUsersPage;
