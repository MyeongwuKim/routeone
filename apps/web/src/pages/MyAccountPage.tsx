import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  MdArrowBack,
  MdChevronRight,
  MdDeleteOutline,
  MdLogout,
} from "react-icons/md";
import { authApi } from "@/api/authApi";
import { notificationApi } from "@/api/notificationApi";
import AccountDetailsSection from "@/components/account/AccountDetailsSection";
import { useAccountUser } from "@/components/account/useAccountUser";
import { clearAuthToken } from "@/lib/authToken";
import { clearRouteArrivalTransitions } from "@/features/my-route/services/routeArrivalTransitionLock";
import { clearRouteStartAttempts } from "@/features/my-route/services/routeStartAttemptJournal";
import { useUiText } from "@/lib/uiText";
import { nativeBridge } from "@/native-bridge";
import { useAuthUserStore } from "@/stores/authUserStore";
import { useHomeExploreStore } from "@/stores/homeExploreStore";
import { useMapSheetStore } from "@/stores/mapSheetStore";
import { useRouteEditFlowStore } from "@/stores/routeEditFlowStore";
import { useEffectiveServiceArea } from "@/stores/serviceAreaStore";
import { useUiModalStore } from "@/stores/uiModalStore";
import { useUiToastStore } from "@/stores/uiToastStore";

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

function MyAccountPage() {
  const text = useUiText();
  const serviceArea = useEffectiveServiceArea();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const showToast = useUiToastStore((state) => state.showToast);
  const openModal = useUiModalStore((state) => state.openModal);
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
  const { user, isLoading, retry } = useAccountUser();
  const isBusy = isLoggingOut || isDeleting;

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
    clearRouteArrivalTransitions();
    clearRouteStartAttempts();
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

      <AccountDetailsSection user={user} isLoading={isLoading} onRetry={retry} />

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

        {user?.role === "USER" ? (
          <>
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
          </>
        ) : null}
      </section>
    </section>
  );
}

export default MyAccountPage;
