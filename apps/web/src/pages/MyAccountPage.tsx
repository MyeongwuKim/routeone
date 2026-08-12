import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { FaApple } from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";
import {
  MdArrowBack,
  MdCalendarToday,
  MdChevronRight,
  MdDeleteOutline,
  MdEmail,
  MdKey,
  MdLogout,
  MdOutlineAccountCircle,
} from "react-icons/md";
import { authApi, ME_QUERY_KEY, ME_QUERY_STALE_TIME_MS } from "@/api/authApi";
import { notificationApi } from "@/api/notificationApi";
import AccountAvatar from "@/components/account/AccountAvatar";
import type { AuthProvider } from "@/generated/graphql";
import {
  getAccountDisplayName,
  getAccountIdentifier,
} from "@/lib/accountDisplay";
import { clearAuthToken } from "@/lib/authToken";
import { useUiText } from "@/lib/uiText";
import { nativeBridge } from "@/native-bridge";
import { useAppLanguageStore } from "@/stores/appLanguageStore";
import { useAuthUserStore } from "@/stores/authUserStore";
import { useHomeExploreStore } from "@/stores/homeExploreStore";
import { useMapSheetStore } from "@/stores/mapSheetStore";
import { useRouteEditFlowStore } from "@/stores/routeEditFlowStore";
import { useEffectiveServiceArea } from "@/stores/serviceAreaStore";
import { useUiModalStore } from "@/stores/uiModalStore";
import { useUiToastStore } from "@/stores/uiToastStore";

function AccountInfoRow({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-3.5">
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-lg text-brand-700">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold text-slate-500">
          {label}
        </span>
        <span className="mt-1 block break-all text-sm font-bold text-slate-900">
          {children}
        </span>
      </span>
    </div>
  );
}

function AccountActionRow({
  icon,
  title,
  description,
  tone = "default",
  disabled = false,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  tone?: "default" | "danger";
  disabled?: boolean;
  onClick: () => void;
}) {
  const isDanger = tone === "danger";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50 active:scale-[0.99] disabled:cursor-wait disabled:opacity-50 dark:hover:bg-slate-800/70"
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
        <span className="mt-0.5 block text-xs font-semibold text-slate-500">
          {description}
        </span>
      </span>
      <MdChevronRight
        className={`shrink-0 text-2xl ${
          isDanger ? "text-rose-300" : "text-slate-300"
        }`}
      />
    </button>
  );
}

function AuthProviderIcon({ provider }: { provider: AuthProvider }) {
  if (provider === "GOOGLE") {
    return <FcGoogle />;
  }

  if (provider === "APPLE") {
    return <FaApple />;
  }

  return provider === "PASSWORD" ? <MdKey /> : <MdOutlineAccountCircle />;
}

function formatJoinedAt(value: string | undefined, language: "ko" | "en") {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat(language === "ko" ? "ko-KR" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function MyAccountPage() {
  const text = useUiText();
  const language = useAppLanguageStore((state) => state.language);
  const serviceArea = useEffectiveServiceArea();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const showToast = useUiToastStore((state) => state.showToast);
  const openModal = useUiModalStore((state) => state.openModal);
  const authUser = useAuthUserStore((state) => state.user);
  const setAuthUser = useAuthUserStore((state) => state.setUser);
  const clearAuthUser = useAuthUserStore((state) => state.clearUser);
  const resetHomeForArea = useHomeExploreStore(
    (state) => state.resetForArea
  );
  const resetMapSheet = useMapSheetStore((state) => state.resetSheet);
  const clearAppendTarget = useRouteEditFlowStore(
    (state) => state.clearAppendTarget
  );
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const meQuery = useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: authApi.me,
    enabled: !authUser,
    staleTime: ME_QUERY_STALE_TIME_MS,
  });
  const user = authUser ?? meQuery.data?.me ?? null;
  const storedAuthProviders = user?.authProviders ?? [];
  const authProviders: AuthProvider[] =
    storedAuthProviders.length > 0 ? storedAuthProviders : ["UNKNOWN"];
  const displayNameLabel = getAccountDisplayName(
    user,
    text.account.fallbackName
  );
  const identifier =
    getAccountIdentifier(user) ?? text.myInfo.localTestAccount;
  const isBusy = isLoggingOut || isDeleting;

  useEffect(() => {
    if (meQuery.data?.me) {
      setAuthUser(meQuery.data.me);
    }
  }, [meQuery.data?.me, setAuthUser]);

  const clearNativeNotifications = async () => {
    await Promise.allSettled([
      nativeBridge.notifications.syncRouteArrivals({
        places: [],
      }),
      nativeBridge.notifications.syncFestivals([]),
      nativeBridge.notifications.syncRouteReviews([]),
    ]);
  };

  const unregisterPushDevice = async () => {
    try {
      const pushToken = await nativeBridge.notifications.getPushToken(false);

      if (pushToken?.expoPushToken) {
        await notificationApi.unregisterPushDevice(pushToken.expoPushToken);
      }
    } catch (error) {
      console.warn(
        "[push-device] account session cleanup failed",
        error instanceof Error ? error.message : error
      );
    }

    await clearNativeNotifications();
  };

  const finishSession = (toastMessage: string) => {
    resetHomeForArea(serviceArea.defaultRegion.sigunguCode);
    resetMapSheet();
    clearAppendTarget();
    clearAuthToken();
    clearAuthUser();
    queryClient.clear();
    showToast(toastMessage);
    navigate("/login", {
      replace: true,
    });
  };

  const handleLogout = async () => {
    if (isBusy) {
      return;
    }

    setIsLoggingOut(true);
    await unregisterPushDevice();
    finishSession(text.myInfo.logoutToast);
  };

  const handleDeleteAccount = async () => {
    if (isBusy) {
      return;
    }

    setIsDeleting(true);

    try {
      await unregisterPushDevice();
      await authApi.deleteMyAccount();
      finishSession(text.account.deleteSuccess);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : text.account.deleteError,
        3000
      );
      setIsDeleting(false);
    }
  };

  const handleRequestDeleteAccount = () => {
    if (isBusy) {
      return;
    }

    openModal({
      title: text.account.deleteConfirmTitle,
      description: text.account.deleteConfirmDescription,
      detail: text.account.deleteConfirmDetail,
      actions: [
        {
          label: text.common.cancel,
          variant: "secondary",
        },
        {
          label: text.account.deleteConfirmAction,
          variant: "danger",
          onClick: () => {
            void handleDeleteAccount();
          },
        },
      ],
    });
  };

  return (
    <section className="space-y-4 pb-8 text-slate-900">
      <header className="flex items-center gap-3">
        <button
          type="button"
          aria-label={text.common.backToMyInfo}
          onClick={() => navigate("/me")}
          className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-xl text-brand-700 shadow-sm transition hover:bg-brand-100 dark:border-brand-400/30 dark:bg-[#0f3431] dark:text-brand-200 dark:shadow-[0_10px_24px_rgba(0,0,0,0.22)] dark:hover:bg-[#13423e]"
        >
          <MdArrowBack />
        </button>
        <div className="min-w-0">
          <p className="text-xs font-black text-brand-700">
            {text.account.eyebrow}
          </p>
          <h1 className="truncate text-lg font-bold text-slate-900">
            {text.account.title}
          </h1>
        </div>
      </header>

      <section className="rounded-3xl border border-brand-200 bg-gradient-to-br from-white via-white to-brand-50 p-5 shadow-sm dark:border-brand-400/25 dark:from-[#0d2926] dark:via-[#0b211f] dark:to-[#0f3431]">
        <div className="flex items-center gap-4">
          <AccountAvatar
            user={user}
            fallbackName={text.account.fallbackName}
            className="size-20"
            textClassName="text-3xl"
          />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-black text-slate-900">
              {displayNameLabel}
            </h2>
            <p className="mt-1 truncate text-sm font-semibold text-slate-500">
              {identifier}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {authProviders.map((provider) => (
                <span
                  key={provider}
                  className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2.5 py-1 text-[11px] font-black text-brand-700 dark:bg-brand-400/15 dark:text-brand-100"
                >
                  <span className="text-sm">
                    <AuthProviderIcon provider={provider} />
                  </span>
                  {text.account.providers[provider]}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-sm">
        <div className="border-b border-brand-50 px-4 py-3">
          <p className="text-xs font-black text-brand-700">
            {text.account.accountSection}
          </p>
        </div>

        {user?.email ? (
          <>
            <AccountInfoRow icon={<MdEmail />} label={text.account.email}>
              {user.email}
            </AccountInfoRow>
            <div className="border-b border-brand-50" />
          </>
        ) : null}

        {user?.accountId ? (
          <>
            <AccountInfoRow
              icon={<MdOutlineAccountCircle />}
              label={text.account.accountId}
            >
              {user.accountId}
            </AccountInfoRow>
            <div className="border-b border-brand-50" />
          </>
        ) : null}

        <AccountInfoRow icon={<MdKey />} label={text.account.loginMethods}>
          <span className="flex flex-wrap gap-x-2 gap-y-1">
            {authProviders.map((provider) => (
              <span key={provider}>
                {text.account.providers[provider]}
              </span>
            ))}
          </span>
        </AccountInfoRow>

        <div className="border-b border-brand-50" />

        <AccountInfoRow
          icon={<MdCalendarToday />}
          label={text.account.joinedAt}
        >
          {formatJoinedAt(user?.createdAt, language)}
        </AccountInfoRow>
      </section>

      <section className="overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-sm">
        <div className="border-b border-brand-50 px-4 py-3">
          <p className="text-xs font-black text-brand-700">
            {text.account.managementSection}
          </p>
        </div>

        <AccountActionRow
          icon={<MdLogout />}
          title={text.account.logout}
          description={text.account.logoutDescription}
          disabled={isBusy}
          onClick={() => {
            void handleLogout();
          }}
        />

        <div className="border-b border-brand-50" />

        <AccountActionRow
          icon={<MdDeleteOutline />}
          title={
            isDeleting ? text.account.deleting : text.account.deleteAccount
          }
          description={text.account.deleteAccountDescription}
          tone="danger"
          disabled={isBusy}
          onClick={handleRequestDeleteAccount}
        />
      </section>
    </section>
  );
}

export default MyAccountPage;
