import type { ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { FaHeart } from "react-icons/fa";
import {
  MdChevronRight,
  MdDarkMode,
  MdHistory,
  MdInfoOutline,
  MdLightMode,
  MdLogout,
  MdOutlineAccountCircle,
} from "react-icons/md";
import { authApi } from "@/api/authApi";
import {
  LIKED_SHARED_ROUTES_QUERY_KEY,
  MY_ROUTES_QUERY_KEY,
  SHARED_ROUTES_QUERY_KEY,
} from "@/features/my-route/myRouteCache";
import { clearAuthToken } from "@/lib/authToken";
import { useUiThemeStore } from "@/stores/uiThemeStore";
import { useUiToastStore } from "@/stores/uiToastStore";

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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const showToast = useUiToastStore((state) => state.showToast);
  const isDarkMode = useUiThemeStore((state) => state.mode === "dark");
  const toggleDarkMode = useUiThemeStore((state) => state.toggleDarkMode);
  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: authApi.me,
  });
  const user = meQuery.data?.me;
  const activeAccountLabel =
    user?.accountId ?? user?.displayName ?? user?.email ?? "로컬 테스트 계정";

  const handleLogout = () => {
    clearAuthToken();
    queryClient.removeQueries({
      queryKey: ["me"],
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
    showToast("로그아웃했어요.");
    navigate("/login", {
      replace: true,
    });
  };

  return (
    <section className="space-y-4 pb-4 text-slate-900">
      <div className="rounded-2xl border border-brand-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-xl text-brand-700">
            <MdOutlineAccountCircle />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900">내 정보</p>
            <p className="mt-0.5 text-xs font-semibold text-slate-500">
              계정과 다녀온 루트를 관리하는 메뉴
            </p>
          </div>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-sm">
        <div className="border-b border-brand-50 px-4 py-3">
          <p className="text-xs font-black text-brand-700">내 정보 메뉴</p>
        </div>

        <MyInfoMenuRow
          icon={<MdOutlineAccountCircle />}
          title="아이디 정보"
          description={meQuery.isFetching ? "계정 확인 중" : activeAccountLabel}
          onClick={() => navigate("/me/account")}
        />

        <div className="border-b border-brand-50" />

        <MyInfoMenuRow
          icon={<MdHistory />}
          title="다녀온 루트"
          description="완료했거나 지난 일정 모아보기"
          onClick={() => navigate("/me/routes")}
        />

        <div className="border-b border-brand-50" />

        <MyInfoMenuRow
          icon={<FaHeart />}
          title="좋아요한 공유 루트"
          description="내가 좋아요한 공유 루트 모아보기"
          onClick={() => navigate("/me/liked-routes")}
        />
      </section>

      <section className="overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-sm">
        <div className="border-b border-brand-50 px-4 py-3">
          <p className="text-xs font-black text-brand-700">앱 설정</p>
        </div>

        <MyInfoToggleRow
          icon={isDarkMode ? <MdDarkMode /> : <MdLightMode />}
          title="다크 모드"
          description={isDarkMode ? "어두운 화면으로 보기" : "밝은 화면으로 보기"}
          checked={isDarkMode}
          onToggle={toggleDarkMode}
        />

        <div className="border-b border-brand-50" />

        <MyInfoMenuRow
          icon={<MdInfoOutline />}
          title="버전 정보"
          description="iOS, Android 앱 버전 확인"
          onClick={() => navigate("/me/app-info")}
        />

        <div className="border-b border-brand-50" />

        <MyInfoMenuRow
          icon={<MdLogout />}
          title="로그아웃"
          description="현재 계정에서 나가기"
          tone="danger"
          onClick={handleLogout}
        />
      </section>
    </section>
  );
}

export default MyInfoPage;
