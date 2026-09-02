/**
 * 진입 경로: 내 정보 → 버전 및 권한
 *
 * 용도:
 * 현재 앱과 웹 번들의 버전, iPhone 권한 상태를 언어 설정에 맞춰 보여준다.
 *
 * 구조:
 * 앱 정보와 위치·알림·카메라·앨범 권한 영역으로 구성되어 있다.
 */
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  MdArrowBack,
  MdChevronRight,
  MdInfoOutline,
  MdLocationOn,
  MdNotifications,
  MdPhotoCamera,
  MdPhotoLibrary,
  MdSystemUpdateAlt,
} from "react-icons/md";
import {
  nativeBridge,
  useNativeAppInfo,
  type NativeAppInfo,
  type NativePermissionStatus,
} from "@/native-bridge";
import { useUiText, type UiText } from "@/lib/uiText";

const PERMISSION_ROW_CLASS_NAME =
  "flex w-full items-center gap-3 px-4 py-3 text-left";

function formatPlatform(
  platform: NativeAppInfo["platform"],
  text: UiText["appInfo"]
) {
  if (platform === "ios") {
    return "iOS";
  }

  if (platform === "android") {
    return "Android";
  }

  if (platform === "web") {
    return "Web";
  }

  if (platform === "native") {
    return text.nativeApp;
  }

  return platform;
}

function formatWebBundleVersion(
  info: NativeAppInfo | null,
  text: UiText["appInfo"]
) {
  if (!info) {
    return null;
  }

  if (info.webBundleVersion) {
    return info.webBundleVersion;
  }

  return info.webBundleKind === "embedded" ? text.embeddedBundle : null;
}

function AppInfoRow({
  label,
  value,
  fallback = "-",
}: {
  label: string;
  value?: string | null;
  fallback?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <span className="text-sm font-semibold text-slate-500">{label}</span>
      <span className="min-w-0 truncate text-right text-sm font-bold text-slate-900">
        {value || fallback}
      </span>
    </div>
  );
}

function AppInfoRowSkeleton({
  label,
  valueWidth = "w-28",
}: {
  label: string;
  valueWidth?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <span
        className={`skeleton-shimmer h-4 ${valueWidth} shrink-0 rounded-full bg-slate-200 dark:bg-slate-700`}
      />
    </div>
  );
}

function AppPermissionRowContent({
  icon,
  label,
  trailing,
}: {
  icon: ReactNode;
  label: string;
  trailing: ReactNode;
}) {
  return (
    <>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-lg text-brand-700">
        {icon}
      </span>
      <span className="min-w-0 flex-1 text-sm font-semibold text-slate-700">
        {label}
      </span>
      {trailing}
      <MdChevronRight className="shrink-0 text-lg text-slate-400" />
    </>
  );
}

function formatPermissionStatus(
  status: NativePermissionStatus | null | undefined,
  text: UiText["appInfo"]
) {
  return status
    ? text.permissionStatuses[status]
    : text.permissionStatuses.unavailable;
}

function AppPermissionRow({
  icon,
  isLoading,
  label,
  permissionCheckingAria,
  status,
  text,
}: {
  icon: ReactNode;
  isLoading: boolean;
  label: string;
  permissionCheckingAria: string;
  status?: NativePermissionStatus | null;
  text: UiText["appInfo"];
}) {
  const isPending =
    isLoading && (status === null || status === undefined);
  const statusLabel = formatPermissionStatus(status, text);
  const isGranted = status === "granted";

  return (
    <button
      type="button"
      onClick={nativeBridge.permissions.openSettings}
      className={`${PERMISSION_ROW_CLASS_NAME} transition hover:bg-brand-50/70 active:bg-brand-50`}
    >
      <AppPermissionRowContent
        icon={icon}
        label={label}
        trailing={
          isPending ? (
            <span
              role="status"
              aria-label={permissionCheckingAria}
              className="skeleton-shimmer h-3 w-12 shrink-0 rounded-full bg-slate-200 dark:bg-slate-700"
            />
          ) : (
            <span
              className={`text-xs font-bold ${
                isGranted ? "text-brand-700" : "text-slate-500"
              }`}
            >
              {statusLabel}
            </span>
          )
        }
      />
    </button>
  );
}

function AppInfoNotice({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-brand-100 bg-white p-4 shadow-sm">
      <div className="flex gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-xl text-brand-700">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-900">{title}</p>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}

function AppInfoPage() {
  const text = useUiText();
  const navigate = useNavigate();
  const {
    appInfoState,
    isNativeBridgePending,
    isNativeRuntime,
    isPermissionLookupPending,
  } = useNativeAppInfo();

  const appInfo = appInfoState.info;
  const appInfoText = text.appInfo;
  const appInfoRowSkeletons = [
    { label: appInfoText.runtimeEnvironment, valueWidth: "w-20" },
    { label: appInfoText.appVersion, valueWidth: "w-24" },
    { label: appInfoText.osVersion, valueWidth: "w-28" },
    { label: appInfoText.webBundleVersion, valueWidth: "w-24" },
  ] as const;

  return (
    <section className="space-y-4 pb-4 text-slate-900">
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
            {text.routeShell.appSettings}
          </p>
          <h1 className="truncate text-lg font-bold text-slate-900">
            {text.routeShell.appInfoTitle}
          </h1>
        </div>
      </header>

      {isNativeBridgePending ? (
        <AppInfoNotice
          icon={<MdSystemUpdateAlt />}
          title={appInfoText.bridgePendingTitle}
          description={appInfoText.bridgePendingDescription}
        />
      ) : null}

      {appInfoState.status === "error" ? (
        <AppInfoNotice
          icon={<MdInfoOutline />}
          title={appInfoText.loadErrorTitle}
          description={appInfoText.loadErrorDescription}
        />
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-sm">
        <div className="border-b border-brand-50 px-4 py-3">
          <p className="text-xs font-black text-brand-700">
            {appInfoText.infoSection}
          </p>
        </div>

        {appInfoState.status === "loading" ? (
          appInfoRowSkeletons.map((row, index) => (
            <div key={row.label}>
              {index > 0 ? <div className="border-b border-brand-50" /> : null}
              <AppInfoRowSkeleton
                label={row.label}
                valueWidth={row.valueWidth}
              />
            </div>
          ))
        ) : (
          <>
            <AppInfoRow
              label={appInfoText.runtimeEnvironment}
              value={
                appInfo
                  ? formatPlatform(appInfo.platform, appInfoText)
                  : appInfoText.checking
              }
            />
            <div className="border-b border-brand-50" />
            <AppInfoRow
              label={appInfoText.appVersion}
              value={appInfo?.appVersion}
              fallback={
                isNativeRuntime ? appInfoText.nativeIntegrationPending : "-"
              }
            />
            <div className="border-b border-brand-50" />
            <AppInfoRow
              label={appInfoText.osVersion}
              value={appInfo?.osVersion}
            />
            <div className="border-b border-brand-50" />
            <AppInfoRow
              label={appInfoText.webBundleVersion}
              value={formatWebBundleVersion(appInfo, appInfoText)}
            />
          </>
        )}
      </section>

      {isNativeRuntime ? (
        <section className="overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-sm">
          <div className="border-b border-brand-50 px-4 py-3">
            <p className="text-xs font-black text-brand-700">
              {appInfoText.permissionsSection}
            </p>
          </div>

          <AppPermissionRow
            icon={<MdLocationOn />}
            isLoading={isPermissionLookupPending}
            label={appInfoText.locationPermission}
            permissionCheckingAria={appInfoText.permissionCheckingAria}
            status={appInfo?.locationPermissionStatus}
            text={appInfoText}
          />
          <div className="border-b border-brand-50" />
          <AppPermissionRow
            icon={<MdNotifications />}
            isLoading={isPermissionLookupPending}
            label={appInfoText.notificationPermission}
            permissionCheckingAria={appInfoText.permissionCheckingAria}
            status={appInfo?.notificationPermissionStatus}
            text={appInfoText}
          />
          <div className="border-b border-brand-50" />
          <AppPermissionRow
            icon={<MdPhotoCamera />}
            isLoading={isPermissionLookupPending}
            label={appInfoText.cameraPermission}
            permissionCheckingAria={appInfoText.permissionCheckingAria}
            status={appInfo?.cameraPermissionStatus}
            text={appInfoText}
          />
          <div className="border-b border-brand-50" />
          <AppPermissionRow
            icon={<MdPhotoLibrary />}
            isLoading={isPermissionLookupPending}
            label={appInfoText.photoLibraryPermission}
            permissionCheckingAria={appInfoText.permissionCheckingAria}
            status={appInfo?.photoLibraryPermissionStatus}
            text={appInfoText}
          />
        </section>
      ) : null}
    </section>
  );
}

export default AppInfoPage;
