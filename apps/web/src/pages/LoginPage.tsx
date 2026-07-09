import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { MdLogin, MdPassword, MdRoute } from "react-icons/md";
import { authApi, ME_QUERY_KEY } from "@/api/authApi";
import { setAuthToken } from "@/lib/authToken";
import { useAuthUserStore } from "@/stores/authUserStore";
import { useUiToastStore } from "@/stores/uiToastStore";

function getAuthErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "로그인에 실패했어요. 다시 시도해 주세요.";
}

function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const showToast = useUiToastStore((state) => state.showToast);
  const setAuthUser = useAuthUserStore((state) => state.setUser);
  const [accountId, setAccountId] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      void queryClient.invalidateQueries({
        queryKey: ["my-routes"],
      });
      showToast(`${payload.loginWithPassword.user.displayName ?? accountId} 계정으로 로그인했어요.`);
      navigate("/home", {
        replace: true,
      });
    } catch (error) {
      showToast(getAuthErrorMessage(error), 2600);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-brand-50 px-5 py-8 text-slate-900">
      <section className="w-full max-w-md rounded-2xl border border-brand-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-full bg-brand-600 text-2xl text-white">
            <MdRoute />
          </span>
          <div>
            <p className="font-trip text-sm text-brand-700">ROUTE ONE</p>
            <h1 className="text-xl font-bold text-slate-900">로그인</h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
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

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-40"
          >
            <MdLogin className="text-lg" />
            {isSubmitting ? "처리 중..." : "계정 만들기 / 로그인"}
          </button>
        </form>
      </section>
    </main>
  );
}

export default LoginPage;
