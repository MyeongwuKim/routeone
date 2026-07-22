import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  MdArrowBack,
  MdInfoOutline,
  MdPhoneIphone,
  MdSystemUpdateAlt,
} from "react-icons/md";
import {
  getRouteOneAppInfo,
  isRouteOneNativeRuntime,
  type RouteOneAppInfo,
} from "@/lib/appInfo";

type AppInfoState =
  | {
      status: "loading";
      info: null;
    }
  | {
      status: "success";
      info: RouteOneAppInfo;
    }
  | {
      status: "error";
      info: null;
    };

function formatPlatform(platform: RouteOneAppInfo["platform"]) {
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

function formatWebBundleVersion(info: RouteOneAppInfo | null) {
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

function AppInfoRowSkeleton({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <span className="text-sm font-semibold text-slate-500">{label}</span>
      <span className="h-4 w-28 animate-pulse rounded-full bg-slate-200" />
    </div>
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
  const [appInfoState, setAppInfoState] = useState<AppInfoState>({
    status: "loading",
    info: null,
  });
  const isNativeRuntime = isRouteOneNativeRuntime();

  useEffect(() => {
    let isMounted = true;

    getRouteOneAppInfo()
      .then((info) => {
        if (isMounted) {
          setAppInfoState({
            status: "success",
            info,
          });
        }
      })
      .catch(() => {
        if (isMounted) {
          setAppInfoState({
            status: "error",
            info: null,
          });
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const appInfo = appInfoState.info;
  const isNativeBridgePending =
    isNativeRuntime &&
    appInfoState.status === "success" &&
    appInfo !== null &&
    appInfo.platform === "native" &&
    !appInfo.appVersion;

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
            버전 정보
          </h1>
        </div>
      </header>

      {isNativeBridgePending ? (
        <AppInfoNotice
          icon={<MdSystemUpdateAlt />}
          title="네이티브 버전 연동 준비 중"
          description="iOS와 Android에서 버전 브릿지가 연결되면 이 화면에 앱 버전과 빌드 번호가 표시돼요."
        />
      ) : null}

      {appInfoState.status === "error" ? (
        <AppInfoNotice
          icon={<MdInfoOutline />}
          title="버전 정보를 불러오지 못했어요"
          description="잠시 후 다시 확인해 주세요."
        />
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-sm">
        <div className="border-b border-brand-50 px-4 py-3">
          <p className="text-xs font-black text-brand-700">앱 정보</p>
        </div>

        {appInfoState.status === "loading" ? (
          <>
            <AppInfoRowSkeleton label="실행 환경" />
            <div className="border-b border-brand-50" />
            <AppInfoRowSkeleton label="앱 버전" />
            <div className="border-b border-brand-50" />
            <AppInfoRowSkeleton label="빌드 번호" />
            <div className="border-b border-brand-50" />
            <AppInfoRowSkeleton label="런타임 버전" />
            <div className="border-b border-brand-50" />
            <AppInfoRowSkeleton label="OS 버전" />
            <div className="border-b border-brand-50" />
            <AppInfoRowSkeleton label="웹 번들 버전" />
            <div className="border-b border-brand-50" />
            <AppInfoRowSkeleton label="업데이트 채널" />
            <div className="border-b border-brand-50" />
            <AppInfoRowSkeleton label="번들 ID" />
          </>
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
            <AppInfoRow label="빌드 번호" value={appInfo?.buildNumber} />
            <div className="border-b border-brand-50" />
            <AppInfoRow label="런타임 버전" value={appInfo?.runtimeVersion} />
            <div className="border-b border-brand-50" />
            <AppInfoRow label="OS 버전" value={appInfo?.osVersion} />
            <div className="border-b border-brand-50" />
            <AppInfoRow
              label="웹 번들 버전"
              value={formatWebBundleVersion(appInfo)}
            />
            <div className="border-b border-brand-50" />
            <AppInfoRow
              label="업데이트 채널"
              value={appInfo?.webBundleChannel}
            />
            <div className="border-b border-brand-50" />
            <AppInfoRow label="번들 ID" value={appInfo?.bundleIdentifier} />
          </>
        )}
      </section>

      <AppInfoNotice
        icon={<MdPhoneIphone />}
        title="iOS와 Android 공통 화면"
        description="네이티브에서 전달하는 플랫폼별 버전 정보를 같은 화면에서 확인하도록 구성했어요."
      />
    </section>
  );
}

export default AppInfoPage;
