import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MdAccessTime,
  MdArrowBack,
  MdCelebration,
  MdCheck,
  MdExpandMore,
  MdLocationOn,
  MdOutlineRoute,
} from "react-icons/md";
import { useNavigate } from "react-router-dom";
import {
  notificationApi,
  NOTIFICATION_SETTINGS_QUERY_KEY,
} from "@/api/notificationApi";
import NotificationSettingsSkeleton from "@/components/feedback/NotificationSettingsSkeleton";
import { GANGWON_REGIONS } from "@/data/gangwonRegions";
import { useUiText } from "@/lib/uiText";
import { nativeBridge } from "@/native-bridge";
import { useUiToastStore } from "@/stores/uiToastStore";

type NotificationSettingKey =
  | "routeStartEnabled"
  | "routeReviewEnabled"
  | "routeArrivalEnabled";

function NotificationToggleRow({
  checked,
  description,
  disabled,
  icon,
  onToggle,
  title,
}: {
  checked: boolean;
  description: string;
  disabled?: boolean;
  icon: ReactNode;
  onToggle: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onToggle}
      className="flex w-full items-center gap-3 px-4 py-4 text-left transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60 dark:hover:bg-slate-800/70"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-xl text-brand-700 dark:bg-brand-400/10 dark:text-brand-200">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-slate-900 dark:text-white">
          {title}
        </span>
        <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500 dark:text-slate-300">
          {description}
        </span>
      </span>
      <span
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${
          checked ? "bg-brand-600" : "bg-slate-200 dark:bg-slate-700"
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

function FestivalNotificationSettingRow({
  description,
  disabled,
  expanded,
  onOpen,
  status,
}: {
  description: string;
  disabled?: boolean;
  expanded: boolean;
  onOpen: () => void;
  status: string;
}) {
  const text = useUiText();

  return (
    <button
      type="button"
      aria-controls="festival-region-settings"
      aria-expanded={expanded}
      disabled={disabled}
      onClick={onOpen}
      className="flex w-full items-center gap-3 px-4 py-4 text-left transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60 dark:hover:bg-slate-800/70"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-xl text-brand-700 dark:bg-brand-400/10 dark:text-brand-200">
        <MdCelebration aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-slate-900 dark:text-white">
          {text.notificationSettings.festivalTitle}
        </span>
        <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500 dark:text-slate-300">
          {description}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        <span className="rounded-full bg-brand-50 px-2 py-1 text-[11px] font-black text-brand-700 dark:bg-brand-400/10 dark:text-brand-200">
          {status}
        </span>
        <MdExpandMore
          className={`text-xl text-slate-400 transition-transform duration-300 motion-reduce:transition-none ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </span>
    </button>
  );
}

function NotificationSettingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const text = useUiText();
  const showToast = useUiToastStore((state) => state.showToast);
  const [isRegionPickerOpen, setIsRegionPickerOpen] = useState(false);
  const [draftRegionCodes, setDraftRegionCodes] = useState<string[] | null>(
    null
  );
  const settingsQuery = useQuery({
    queryKey: NOTIFICATION_SETTINGS_QUERY_KEY,
    queryFn: notificationApi.settings,
  });
  const updateMutation = useMutation({
    mutationFn: notificationApi.updateSettings,
    onSuccess: (result) => {
      queryClient.setQueryData(NOTIFICATION_SETTINGS_QUERY_KEY, {
        notificationSettings: result.updateNotificationSettings,
      });
    },
  });
  const settings =
    updateMutation.data?.updateNotificationSettings ??
    settingsQuery.data?.notificationSettings ??
    null;
  const savedFestivalRegionCodes =
    settings?.festivalEnabled ? settings.festivalRegionCodes : [];
  const selectedRegionLabels =
    savedFestivalRegionCodes
      .map(
        (regionCode) =>
          GANGWON_REGIONS.find(
            (region) => region.sigunguCode === regionCode
          )
      )
      .filter(
        (
          region
        ): region is NonNullable<typeof region> =>
          region !== undefined
      ) ??
    [];
  const localizedSelectedRegionLabels = selectedRegionLabels.map(
    (region) => text.labels.regions[region.label] ?? region.label
  );
  const activeDraftRegionCodes =
    draftRegionCodes ?? savedFestivalRegionCodes;

  const registerPushToken = async () => {
    const pushToken = await nativeBridge.notifications.getPushToken(true);

    if (!pushToken) {
      return;
    }

    if (!pushToken.expoPushToken) {
      if (pushToken.permissionStatus === "denied") {
        showToast(text.notificationSettings.permissionDeniedToast, 2600);
        nativeBridge.permissions.openSettings();
      }
      return;
    }

    if (pushToken.platform !== "ios" && pushToken.platform !== "android") {
      return;
    }

    await notificationApi.registerPushDevice({
      expoPushToken: pushToken.expoPushToken,
      platform: pushToken.platform === "ios" ? "IOS" : "ANDROID",
      appVariant: pushToken.appVariant,
    });
  };

  const updateSettings = async (
    input: Parameters<typeof notificationApi.updateSettings>[0],
    requestPermission = false
  ) => {
    try {
      await updateMutation.mutateAsync(input);

      if (requestPermission) {
        try {
          await registerPushToken();
        } catch (error) {
          console.warn(
            "[push-device] token registration failed",
            error instanceof Error ? error.message : error
          );
        }
      }

      showToast(text.notificationSettings.savedToast);
      return true;
    } catch {
      showToast(text.notificationSettings.saveError, 2600);
      return false;
    }
  };

  const handleToggle = (key: NotificationSettingKey) => {
    if (!settings || updateMutation.isPending) {
      return;
    }

    const nextEnabled = !settings[key];

    void updateSettings(
      {
        [key]: nextEnabled,
      },
      nextEnabled
    );

    if (key === "routeArrivalEnabled" && !nextEnabled) {
      void nativeBridge.notifications.syncRouteArrivals({
        places: [],
      });
    }
  };

  const handleFestivalSettingOpen = () => {
    if (updateMutation.isPending) {
      return;
    }

    if (isRegionPickerOpen) {
      setIsRegionPickerOpen(false);
      setDraftRegionCodes(null);
      return;
    }

    setDraftRegionCodes([...savedFestivalRegionCodes]);
    setIsRegionPickerOpen(true);
  };

  const handleRegionToggle = (regionCode: string) => {
    const nextRegions = activeDraftRegionCodes.includes(regionCode)
      ? activeDraftRegionCodes.filter((code) => code !== regionCode)
      : [...activeDraftRegionCodes, regionCode];

    if (nextRegions.length > 2) {
      showToast(text.notificationSettings.maxRegionToast);
      return;
    }

    setDraftRegionCodes(nextRegions);
  };

  const handleFinishRegionSelection = async () => {
    const shouldEnableFestivalNotification =
      activeDraftRegionCodes.length > 0;

    const isSaved = await updateSettings(
      {
        festivalEnabled: shouldEnableFestivalNotification,
        festivalRegionCodes: activeDraftRegionCodes,
      },
      shouldEnableFestivalNotification
    );

    if (!isSaved) {
      return;
    }

    setIsRegionPickerOpen(false);
    setDraftRegionCodes(null);
  };

  if (!settings) {
    if (!settingsQuery.isError) {
      return <NotificationSettingsSkeleton />;
    }

    return (
      <section className="space-y-4 pb-4 text-slate-900 dark:text-slate-100">
        <header className="flex items-center gap-3">
          <button
            type="button"
            aria-label={text.common.backToMyInfo}
            onClick={() => navigate("/me")}
            className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-xl text-brand-700"
          >
            <MdArrowBack />
          </button>
          <h1 className="text-lg font-bold">
            {text.routeShell.notificationSettingsTitle}
          </h1>
        </header>
        <p className="px-1 text-sm font-semibold text-slate-500">
          {text.notificationSettings.saveError}
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4 pb-4 text-slate-900 dark:text-slate-100">
      <header className="flex items-center gap-3">
        <button
          type="button"
          aria-label={text.common.backToMyInfo}
          onClick={() => navigate("/me")}
          className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-xl text-brand-700 shadow-sm transition hover:bg-brand-100 dark:border-brand-400/30 dark:bg-[#0f3431] dark:text-brand-200"
        >
          <MdArrowBack />
        </button>
        <div className="min-w-0">
          <p className="text-xs font-black text-brand-700 dark:text-brand-200">
            {text.routeShell.appSettings}
          </p>
          <h1 className="truncate text-lg font-bold text-slate-900 dark:text-white">
            {text.routeShell.notificationSettingsTitle}
          </h1>
        </div>
      </header>

      <section className="overflow-hidden rounded-lg border border-brand-100 bg-white shadow-sm dark:border-brand-400/25 dark:bg-[#071f1d]">
        <div className="border-b border-brand-50 px-4 py-3 dark:border-brand-400/15">
          <p className="text-xs font-black text-brand-700 dark:text-brand-200">
            {text.notificationSettings.sectionTitle}
          </p>
        </div>
        <FestivalNotificationSettingRow
          disabled={updateMutation.isPending}
          expanded={isRegionPickerOpen}
          description={
            settings.festivalEnabled && localizedSelectedRegionLabels.length
              ? text.notificationSettings.festivalOnDescription(
                  localizedSelectedRegionLabels.join(", ")
                )
              : text.notificationSettings.festivalOffDescription
          }
          status={text.notificationSettings.festivalStatus(
            savedFestivalRegionCodes.length
          )}
          onOpen={handleFestivalSettingOpen}
        />
        <div
          id="festival-region-settings"
          className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${
            isRegionPickerOpen
              ? "grid-rows-[1fr] opacity-100"
              : "grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="min-h-0 overflow-hidden">
            <section
              aria-hidden={!isRegionPickerOpen}
              inert={!isRegionPickerOpen}
              className="border-t border-brand-100 bg-brand-50/45 px-4 pb-4 pt-3 dark:border-brand-400/20 dark:bg-brand-400/5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold">
                    {text.notificationSettings.regionSectionTitle}
                  </p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-slate-500 dark:text-slate-300">
                    {text.notificationSettings.regionSectionDescription}
                  </p>
                </div>
                <span className="shrink-0 text-xs font-bold text-brand-700 dark:text-brand-200">
                  {text.notificationSettings.selectedRegionCount(
                    activeDraftRegionCodes.length
                  )}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-4">
                {GANGWON_REGIONS.map((region) => {
                  const isSelected = activeDraftRegionCodes.includes(
                    region.sigunguCode
                  );

                  return (
                    <button
                      key={region.sigunguCode}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() =>
                        handleRegionToggle(region.sigunguCode)
                      }
                      className={`flex min-h-11 items-center justify-center gap-1 rounded-lg border px-2 text-sm font-bold transition ${
                        isSelected
                          ? "border-brand-600 bg-brand-600 text-white"
                          : "border-slate-200 bg-white text-slate-700 dark:border-brand-400/25 dark:bg-[#0b211f] dark:text-slate-100"
                      }`}
                    >
                      {isSelected ? <MdCheck /> : null}
                      {text.labels.regions[region.label] ?? region.label}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={updateMutation.isPending}
                  onClick={() => void handleFinishRegionSelection()}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-bold text-white transition hover:bg-brand-700 disabled:bg-slate-300"
                >
                  <MdCheck />
                  {text.notificationSettings.finishRegionSelection}
                </button>
                <button
                  type="button"
                  disabled={updateMutation.isPending}
                  onClick={handleFestivalSettingOpen}
                  className="h-12 w-full rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-500 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60 dark:border-brand-400/25 dark:bg-[#0b211f] dark:text-slate-300 dark:hover:bg-brand-400/10"
                >
                  {text.common.cancel}
                </button>
              </div>
            </section>
          </div>
        </div>
        <div className="border-b border-brand-50 dark:border-brand-400/15" />
        <NotificationToggleRow
          checked={settings.routeStartEnabled}
          disabled={updateMutation.isPending}
          icon={<MdAccessTime />}
          title={text.notificationSettings.routeStartTitle}
          description={text.notificationSettings.routeStartDescription}
          onToggle={() => handleToggle("routeStartEnabled")}
        />
        <div className="border-b border-brand-50 dark:border-brand-400/15" />
        <NotificationToggleRow
          checked={settings.routeReviewEnabled}
          disabled={updateMutation.isPending}
          icon={<MdOutlineRoute />}
          title={text.notificationSettings.routeReviewTitle}
          description={text.notificationSettings.routeReviewDescription}
          onToggle={() => handleToggle("routeReviewEnabled")}
        />
        <div className="border-b border-brand-50 dark:border-brand-400/15" />
        <NotificationToggleRow
          checked={settings.routeArrivalEnabled}
          disabled={updateMutation.isPending}
          icon={<MdLocationOn />}
          title={text.notificationSettings.routeArrivalTitle}
          description={text.notificationSettings.routeArrivalDescription}
          onToggle={() => handleToggle("routeArrivalEnabled")}
        />
      </section>
    </section>
  );
}

export default NotificationSettingsPage;
