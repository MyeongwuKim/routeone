import { useEffect, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { FaHeart } from "react-icons/fa";
import {
  MdChevronRight,
  MdDarkMode,
  MdHistory,
  MdInfoOutline,
  MdLanguage,
  MdLightMode,
  MdLogout,
  MdOutlineAccountCircle,
} from "react-icons/md";
import {
  authApi,
  ME_QUERY_KEY,
  ME_QUERY_STALE_TIME_MS,
} from "@/api/authApi";
import {
  LIKED_SHARED_ROUTES_QUERY_KEY,
  MY_ROUTES_QUERY_KEY,
  SHARED_ROUTES_QUERY_KEY,
} from "@/features/my-route/myRouteCache";
import { clearAuthToken } from "@/lib/authToken";
import { useUiText } from "@/lib/uiText";
import {
  getAuthUserLabel,
  useAuthUserStore,
} from "@/stores/authUserStore";
import { useUiThemeStore } from "@/stores/uiThemeStore";
import { useUiToastStore } from "@/stores/uiToastStore";
import { useAppLanguageStore } from "@/stores/appLanguageStore";

function MyInfoMenuRow({
  icon,
  title,
  description,
  tone = "default",
  onClick,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  tone?: "default" | "danger";
  onClick: () => void;
}) {
  const isDanger = tone === "danger";

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 active:scale-[0.99] dark:hover:bg-slate-800/70"
    >
      <span
        className={`flex size-10 shrink-0 items-center justify-center rounded-2xl text-xl ${
          isDanger ? "bg-rose-50 text-rose-500" : "bg-brand-50 text-brand-700"
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={`block text-sm font-bold ${
            isDanger ? "text-rose-600" : "text-slate-900"
          }`}
        >
          {title}
        </span>
        <span className="mt-0.5 block truncate text-xs font-semibold text-slate-500">
          {description}
        </span>
      </span>
      {isDanger ? null : (
        <MdChevronRight className="shrink-0 text-2xl text-slate-300" />
      )}
    </button>
  );
}

function MyInfoToggleRow({
  icon,
  title,
  description,
  checked,
  onToggle,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onToggle}
      className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 active:scale-[0.99] dark:hover:bg-slate-800/70"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-xl text-brand-700">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-slate-900">{title}</span>
        <span className="mt-0.5 block truncate text-xs font-semibold text-slate-500">
          {description}
        </span>
      </span>
      <span
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${
          checked ? "bg-brand-600" : "bg-slate-200"
        }`}
      >
        <span
          className={`absolute top-1 size-5 rounded-full shadow-sm transition ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
          style={{ backgroundColor: "#fff" }}
        />
      </span>
    </button>
  );
}

function MyInfoPage() {
  const text = useUiText();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const showToast = useUiToastStore((state) => state.showToast);
  const isDarkMode = useUiThemeStore((state) => state.mode === "dark");
  const toggleDarkMode = useUiThemeStore((state) => state.toggleDarkMode);
  const language = useAppLanguageStore((state) => state.language);
  const authUser = useAuthUserStore((state) => state.user);
  const setAuthUser = useAuthUserStore((state) => state.setUser);
  const clearAuthUser = useAuthUserStore((state) => state.clearUser);
  const meQuery = useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: authApi.me,
    enabled: !authUser,
    staleTime: ME_QUERY_STALE_TIME_MS,
  });
  const user = authUser ?? meQuery.data?.me ?? null;
  const activeAccountLabel =
    getAuthUserLabel(user) ??
    (meQuery.isLoading
      ? text.myInfo.accountChecking
      : text.myInfo.localTestAccount);

  useEffect(() => {
    if (meQuery.data?.me) {
      setAuthUser(meQuery.data.me);
    }
  }, [meQuery.data?.me, setAuthUser]);

  const handleLogout = () => {
    clearAuthToken();
    clearAuthUser();
    queryClient.removeQueries({
      queryKey: ME_QUERY_KEY,
    });
    queryClient.removeQueries({
      queryKey: MY_ROUTES_QUERY_KEY,
    });
    queryClient.removeQueries({
      queryKey: SHARED_ROUTES_QUERY_KEY,
    });
    queryClient.removeQueries({
      queryKey: LIKED_SHARED_ROUTES_QUERY_KEY,
    });
    showToast(text.myInfo.logoutToast);
    navigate("/login", {
      replace: true,
    });
  };

  return (
    <section className="space-y-4 text-slate-900">
      <section className="overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-sm">
        <div className="border-b border-brand-50 px-4 py-3">
          <p className="text-xs font-black text-brand-700">
            {text.myInfo.menuSection}
          </p>
        </div>

        <MyInfoMenuRow
          icon={<MdOutlineAccountCircle />}
          title={text.myInfo.accountInfo}
          description={activeAccountLabel}
          onClick={() => navigate("/me/account")}
        />

        <div className="border-b border-brand-50" />

        <MyInfoMenuRow
          icon={<MdHistory />}
          title={text.myInfo.visitedRoutes}
          description={text.myInfo.visitedRoutesDescription}
          onClick={() => navigate("/me/routes")}
        />

        <div className="border-b border-brand-50" />

        <MyInfoMenuRow
          icon={<FaHeart />}
          title={text.myInfo.likedRoutes}
          description={text.myInfo.likedRoutesDescription}
          onClick={() => navigate("/me/liked-routes")}
        />
      </section>

      <section className="overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-sm">
        <div className="border-b border-brand-50 px-4 py-3">
          <p className="text-xs font-black text-brand-700">
            {text.myInfo.settingsSection}
          </p>
        </div>

        <MyInfoToggleRow
          icon={isDarkMode ? <MdDarkMode /> : <MdLightMode />}
          title={text.myInfo.darkMode}
          description={isDarkMode ? text.myInfo.darkModeOn : text.myInfo.darkModeOff}
          checked={isDarkMode}
          onToggle={toggleDarkMode}
        />

        <div className="border-b border-brand-50" />

        <MyInfoMenuRow
          icon={<MdLanguage />}
          title={text.myInfo.language}
          description={language === "ko" ? text.myInfo.korean : text.myInfo.english}
          onClick={() => navigate("/me/language")}
        />

        <div className="border-b border-brand-50" />

        <MyInfoMenuRow
          icon={<MdInfoOutline />}
          title={text.myInfo.appInfo}
          description={text.myInfo.appInfoDescription}
          onClick={() => navigate("/me/app-info")}
        />

        <div className="border-b border-brand-50" />

        <MyInfoMenuRow
          icon={<MdLogout />}
          title={text.myInfo.logout}
          description={text.myInfo.logoutDescription}
          tone="danger"
          onClick={handleLogout}
        />
      </section>
    </section>
  );
}

export default MyInfoPage;
