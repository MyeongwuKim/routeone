import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  MdArrowBack,
  MdChevronRight,
  MdInfoOutline,
  MdLocationOn,
  MdNotifications,
  MdPhotoCamera,
  MdSystemUpdateAlt,
} from "react-icons/md";
import {
  nativeBridge,
  useNativeAppInfo,
  type NativeAppInfo,
  type NativePermissionStatus,
} from "@/native-bridge";

const APP_INFO_ROW_SKELETONS = [
  { label: "실행 환경", valueWidth: "w-20" },
  { label: "앱 버전", valueWidth: "w-24" },
  { label: "OS 버전", valueWidth: "w-28" },
  { label: "웹 번들 버전", valueWidth: "w-24" },
] as const;

const PERMISSION_ROW_CLASS_NAME =
  "flex w-full items-center gap-3 px-4 py-3 text-left";

function formatPlatform(platform: NativeAppInfo["platform"]) {
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
    return "Native App";
  }

  return platform;
}

function formatWebBundleVersion(info: NativeAppInfo | null) {
  if (!info) {
    return null;
  }

  if (info.webBundleVersion) {
    return info.webBundleVersion;
  }

  return info.webBundleKind === "embedded" ? "내장 번들" : null;
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
  status: NativePermissionStatus | null | undefined
) {
  if (status === "granted") {
    return "켜짐";
  }

  if (status === "denied") {
    return "꺼짐";
  }

  if (status === "undetermined") {
    return "미설정";
  }

  return "확인 불가";
}

function AppPermissionRow({
  icon,
  isLoading,
  label,
  status,
}: {
  icon: ReactNode;
  isLoading: boolean;
  label: string;
  status?: NativePermissionStatus | null;
}) {
  const isPending =
    isLoading && (status === null || status === undefined);
  const statusLabel = formatPermissionStatus(status);
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
              aria-label="권한 정보 확인 중"
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
  const navigate = useNavigate();
  const {
    appInfoState,
    isNativeBridgePending,
    isNativeRuntime,
    isPermissionLookupPending,
  } = useNativeAppInfo();

  const appInfo = appInfoState.info;

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
          <p className="text-xs font-black text-brand-700">앱 설정</p>
          <h1 className="truncate text-lg font-bold text-slate-900">
            버전 및 권한
          </h1>
        </div>
      </header>

      {isNativeBridgePending ? (
        <AppInfoNotice
          icon={<MdSystemUpdateAlt />}
          title="네이티브 버전 연동 준비 중"
          description="iOS와 Android에서 버전 브릿지가 연결되면 이 화면에 앱 버전이 표시돼요."
        />
      ) : null}

      {appInfoState.status === "error" ? (
        <AppInfoNotice
          icon={<MdInfoOutline />}
          title="버전 및 권한 정보를 불러오지 못했어요"
          description="잠시 후 다시 확인해 주세요."
        />
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-sm">
        <div className="border-b border-brand-50 px-4 py-3">
          <p className="text-xs font-black text-brand-700">앱 정보</p>
        </div>

        {appInfoState.status === "loading" ? (
          APP_INFO_ROW_SKELETONS.map((row, index) => (
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
              label="실행 환경"
              value={appInfo ? formatPlatform(appInfo.platform) : "확인 중"}
            />
            <div className="border-b border-brand-50" />
            <AppInfoRow
              label="앱 버전"
              value={appInfo?.appVersion}
              fallback={isNativeRuntime ? "네이티브 연동 대기" : "-"}
            />
            <div className="border-b border-brand-50" />
            <AppInfoRow label="OS 버전" value={appInfo?.osVersion} />
            <div className="border-b border-brand-50" />
            <AppInfoRow
              label="웹 번들 버전"
              value={formatWebBundleVersion(appInfo)}
            />
          </>
        )}
      </section>

      {isNativeRuntime ? (
        <section className="overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-sm">
          <div className="border-b border-brand-50 px-4 py-3">
            <p className="text-xs font-black text-brand-700">권한</p>
          </div>

          <AppPermissionRow
            icon={<MdLocationOn />}
            isLoading={isPermissionLookupPending}
            label="위치 권한"
            status={appInfo?.locationPermissionStatus}
          />
          <div className="border-b border-brand-50" />
          <AppPermissionRow
            icon={<MdNotifications />}
            isLoading={isPermissionLookupPending}
            label="푸시 알림 권한"
            status={appInfo?.notificationPermissionStatus}
          />
          <div className="border-b border-brand-50" />
          <AppPermissionRow
            icon={<MdPhotoCamera />}
            isLoading={isPermissionLookupPending}
            label="카메라 권한"
            status={appInfo?.cameraPermissionStatus}
          />
        </section>
      ) : null}
    </section>
  );
}

export default AppInfoPage;
