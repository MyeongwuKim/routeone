import type { ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  MdChevronRight,
  MdHistory,
  MdLogin,
  MdLogout,
  MdOutlineAccountCircle,
} from "react-icons/md";
import { authApi } from "@/api/authApi";
import { MY_ROUTES_QUERY_KEY } from "@/features/my-route/myRouteCache";
import { clearAuthToken } from "@/lib/authToken";
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
      className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 active:scale-[0.99]"
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

function MyInfoPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const showToast = useUiToastStore((state) => state.showToast);
  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: authApi.me,
  });
  const user = meQuery.data?.me;
  const activeAccountLabel =
    user?.accountId ?? user?.displayName ?? user?.email ?? "로컬 테스트 계정";

  const refreshAccountBoundData = () => {
    void queryClient.invalidateQueries({
      queryKey: ["me"],
    });
    void queryClient.invalidateQueries({
      queryKey: MY_ROUTES_QUERY_KEY,
    });
  };

  const handleLogout = () => {
    clearAuthToken();
    refreshAccountBoundData();
    showToast("로그아웃했어요.");
    navigate("/login", {
      replace: true,
    });
  };

  return (
    <section className="space-y-4 pb-4 text-slate-900">
      <div className="rounded-2xl border border-brand-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-full bg-brand-50 text-2xl text-brand-700">
            <MdOutlineAccountCircle />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-brand-700">내 정보</p>
            <p className="mt-1 truncate text-lg font-bold text-slate-900">
              {meQuery.isFetching ? "계정 확인 중" : activeAccountLabel}
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-500">
          필요한 메뉴를 선택해 상세 화면으로 이동해요.
        </p>
      </div>

      <section className="overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-sm">
        <div className="border-b border-brand-50 px-4 py-3">
          <p className="text-xs font-black text-brand-700">내 정보 메뉴</p>
        </div>

        <MyInfoMenuRow
          icon={<MdHistory />}
          title="다녀온 루트"
          description="완료했거나 지난 일정 모아보기"
          onClick={() => navigate("/me/routes")}
        />

        <div className="border-b border-brand-50" />

        <MyInfoMenuRow
          icon={<MdLogin />}
          title="계정 전환"
          description={activeAccountLabel}
          onClick={() => navigate("/me/account")}
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
