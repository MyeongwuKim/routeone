import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { MdArrowBack, MdLogin, MdPassword } from "react-icons/md";
import { authApi, ME_QUERY_KEY } from "@/api/authApi";
import { MY_ROUTES_QUERY_KEY } from "@/features/my-route/myRouteCache";
import { setAuthToken } from "@/lib/authToken";
import { useAuthUserStore } from "@/stores/authUserStore";
import { useUiToastStore } from "@/stores/uiToastStore";

function getAuthErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "계정 처리에 실패했어요. 다시 시도해 주세요.";
}

function MyAccountPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const showToast = useUiToastStore((state) => state.showToast);
  const setAuthUser = useAuthUserStore((state) => state.setUser);
  const [accountId, setAccountId] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const refreshAccountBoundData = () => {
    void queryClient.invalidateQueries({
      queryKey: MY_ROUTES_QUERY_KEY,
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = await authApi.loginWithPassword({
        accountId,
        password,
        displayName: displayName.trim() || undefined,
      });

      setAuthToken(payload.loginWithPassword.token);
      setAuthUser(payload.loginWithPassword.user);
      queryClient.setQueryData(ME_QUERY_KEY, {
        me: payload.loginWithPassword.user,
      });
      refreshAccountBoundData();
      showToast(
        `${payload.loginWithPassword.user.displayName ?? accountId} 계정으로 전환했어요.`
      );
      navigate("/me", {
        replace: true,
      });
    } catch (error) {
      showToast(getAuthErrorMessage(error), 2600);
      setIsSubmitting(false);
    }
  };

  return (
    <section className="space-y-4 pb-4 text-slate-900">
      <header className="flex items-center gap-3">
        <button
          type="button"
          aria-label="내 정보로 돌아가기"
          onClick={() => navigate("/me")}
          className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-xl text-brand-700 shadow-sm transition hover:bg-brand-100 dark:border-brand-400/30 dark:bg-[#0f3431] dark:text-brand-200 dark:shadow-[0_10px_24px_rgba(0,0,0,0.22)] dark:hover:bg-[#13423e]"
        >
          <MdArrowBack />
        </button>
        <div className="min-w-0">
          <p className="text-xs font-black text-brand-700">내 정보</p>
          <h1 className="truncate text-lg font-bold text-slate-900">
            계정 전환
          </h1>
        </div>
      </header>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-brand-100 bg-white p-4 shadow-sm"
      >
        <p className="text-sm font-semibold text-slate-900">
          사용할 계정을 입력해요
        </p>
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-xs font-semibold text-slate-500">아이디</span>
            <input
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
              autoComplete="username"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold outline-none focus:border-brand-500"
              placeholder="routeone"
              required
              minLength={3}
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-slate-500">비밀번호</span>
            <div className="mt-1 flex items-center rounded-xl border border-slate-200 bg-white px-3 focus-within:border-brand-500">
              <MdPassword className="mr-2 text-lg text-slate-400" />
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                autoComplete="current-password"
                className="min-w-0 flex-1 py-3 text-sm font-semibold outline-none"
                placeholder="4자 이상"
                required
                minLength={4}
              />
            </div>
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-slate-500">닉네임</span>
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              autoComplete="nickname"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold outline-none focus:border-brand-500"
              placeholder="선택"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-40"
        >
          <MdLogin className="text-lg" />
          {isSubmitting ? "처리 중..." : "계정 만들기 / 로그인"}
        </button>
      </form>
    </section>
  );
}

export default MyAccountPage;
