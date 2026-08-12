import { useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { FaHeart } from "react-icons/fa";
import {
  MdChevronRight,
  MdDarkMode,
  MdHistory,
  MdInfoOutline,
  MdLanguage,
  MdLightMode,
  MdLocationOn,
  MdNotifications,
} from "react-icons/md";
import { authApi, ME_QUERY_KEY, ME_QUERY_STALE_TIME_MS } from "@/api/authApi";
import AccountAvatar from "@/components/account/AccountAvatar";
import {
  getAccountDisplayName,
  getAccountIdentifier,
  getAccountProviderLabels,
} from "@/lib/accountDisplay";
import { useUiText } from "@/lib/uiText";
import { useAppLanguageStore } from "@/stores/appLanguageStore";
import { useAuthUserStore, type AuthUser } from "@/stores/authUserStore";
import {
  isDevelopmentServiceAreaEnabled,
  useEffectiveServiceArea,
} from "@/stores/serviceAreaStore";
import { useUiThemeStore } from "@/stores/uiThemeStore";

function MyInfoMenuRow({
  icon,
  title,
  description,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
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
      <MdChevronRight className="shrink-0 text-2xl text-slate-300" />
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
          className={`absolute top-1 size-5 rounded-full bg-white shadow-sm transition ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </span>
    </button>
  );
}

function AccountSummaryCard({
  user,
  isLoading,
  onClick,
}: {
  user: AuthUser | null;
  isLoading: boolean;
  onClick: () => void;
}) {
  const text = useUiText();
  const displayName = getAccountDisplayName(user, text.account.fallbackName);
  const identifier = isLoading
    ? text.myInfo.accountChecking
    : (getAccountIdentifier(user) ?? text.myInfo.localTestAccount);
  const providerSummary = isLoading
    ? text.myInfo.accountChecking
    : getAccountProviderLabels(user, text.account.providers).join(" · ");

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-4 overflow-hidden rounded-3xl border border-brand-200 bg-gradient-to-br from-white via-white to-brand-50 px-4 py-5 text-left shadow-sm transition hover:border-brand-300 active:scale-[0.99] dark:border-brand-400/25 dark:from-[#0d2926] dark:via-[#0b211f] dark:to-[#0f3431]"
    >
      <AccountAvatar
        user={user}
        fallbackName={text.account.fallbackName}
        className="size-[4.5rem]"
        textClassName="text-2xl"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-lg font-black text-slate-900">
          {displayName}
        </span>
        <span className="mt-1 block truncate text-sm font-semibold text-slate-500">
          {identifier}
        </span>
        <span className="mt-2 inline-flex rounded-full bg-brand-100 px-2.5 py-1 text-[11px] font-black text-brand-700 dark:bg-brand-400/15 dark:text-brand-100">
          {providerSummary}
        </span>
      </span>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/80 text-2xl text-brand-700 shadow-sm transition group-hover:translate-x-0.5 dark:bg-brand-400/10 dark:text-brand-100">
        <MdChevronRight />
      </span>
    </button>
  );
}

function MyInfoPage() {
  const text = useUiText();
  const navigate = useNavigate();
  const isDarkMode = useUiThemeStore((state) => state.mode === "dark");
  const toggleDarkMode = useUiThemeStore((state) => state.toggleDarkMode);
  const language = useAppLanguageStore((state) => state.language);
  const serviceArea = useEffectiveServiceArea();
  const canSelectServiceArea = isDevelopmentServiceAreaEnabled();
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

  return (
    <section className="space-y-4 pb-8 text-slate-900">
      <AccountSummaryCard
        user={user}
        isLoading={meQuery.isLoading}
        onClick={() => navigate("/me/account")}
      />

      <section className="overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-sm">
        <div className="border-b border-brand-50 px-4 py-3">
          <p className="text-xs font-black text-brand-700">
            {text.myInfo.menuSection}
          </p>
        </div>

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
          description={
            isDarkMode ? text.myInfo.darkModeOn : text.myInfo.darkModeOff
          }
          checked={isDarkMode}
          onToggle={toggleDarkMode}
        />

        <div className="border-b border-brand-50" />

        <MyInfoMenuRow
          icon={<MdLanguage />}
          title={text.myInfo.language}
          description={
            language === "ko" ? text.myInfo.korean : text.myInfo.english
          }
          onClick={() => navigate("/me/language")}
        />

        {canSelectServiceArea ? (
          <>
            <div className="border-b border-brand-50" />

            <MyInfoMenuRow
              icon={<MdLocationOn />}
              title={text.myInfo.serviceArea}
              description={text.myInfo.serviceAreaDescription(
                text.labels.regions[serviceArea.label] ?? serviceArea.label
              )}
              onClick={() => navigate("/me/service-area")}
            />
          </>
        ) : null}

        <div className="border-b border-brand-50" />

        <MyInfoMenuRow
          icon={<MdNotifications />}
          title={text.myInfo.notificationSettings}
          description={text.myInfo.notificationSettingsDescription}
          onClick={() => navigate("/me/notifications")}
        />

        <div className="border-b border-brand-50" />

        <MyInfoMenuRow
          icon={<MdInfoOutline />}
          title={text.myInfo.appInfo}
          description={text.myInfo.appInfoDescription}
          onClick={() => navigate("/me/app-info")}
        />
      </section>
    </section>
  );
}

export default MyInfoPage;
