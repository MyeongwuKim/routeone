/**
 * 사용 위치: 내 정보 → 차단 사용자 관리 화면의 코드·목록 로딩 상태
 *
 * 용도:
 * 차단 사용자 화면과 같은 구조를 먼저 보여줘 화면 전환 시 빈 영역을 줄인다.
 *
 * 구조:
 * 페이지용 헤더·안내 영역과 재사용 가능한 사용자 행 스켈레톤으로 구성되어 있다.
 */
import { useNavigate } from "react-router-dom";
import { MdArrowBack } from "react-icons/md";
import { useUiText } from "@/lib/uiText";

export function BlockedUsersListSkeleton() {
  return (
    <ul
      aria-hidden="true"
      className="overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-sm dark:border-brand-400/25 dark:bg-slate-950/40"
    >
      {["first", "second", "third"].map((rowKey, index) => (
        <li
          key={rowKey}
          className={`flex items-center gap-3 px-4 py-3 ${
            index > 0 ? "border-t border-brand-50" : ""
          }`}
        >
          <div className="skeleton-shimmer size-11 shrink-0 rounded-full bg-brand-100 dark:bg-brand-400/15" />
          <div className="skeleton-shimmer h-4 w-28 max-w-[40%] rounded-full bg-slate-200 dark:bg-slate-700" />
          <div className="skeleton-shimmer ml-auto h-9 w-20 shrink-0 rounded-full bg-slate-100 dark:bg-slate-800" />
        </li>
      ))}
    </ul>
  );
}

function BlockedUsersPageSkeleton() {
  const text = useUiText();
  const navigate = useNavigate();

  return (
    <section
      aria-busy="true"
      className="space-y-4 pb-8 text-slate-900 dark:text-slate-100"
    >
      <header className="flex items-center gap-3">
        <button
          type="button"
          aria-label={text.common.backToMyInfo}
          onClick={() => navigate("/me")}
          className="inline-flex size-12 shrink-0 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-xl text-brand-700 shadow-sm transition hover:bg-brand-100 dark:border-brand-400/30 dark:bg-[#0f3431] dark:text-brand-200"
        >
          <MdArrowBack />
        </button>
        <div className="min-w-0">
          <p className="text-xs font-black text-brand-700">
            {text.routeShell.myInfoTitle}
          </p>
          <h1 className="truncate text-lg font-bold text-slate-900 dark:text-white">
            {text.userBlock.pageTitle}
          </h1>
        </div>
      </header>

      <div className="rounded-2xl border border-brand-100 bg-white p-4 text-sm font-semibold leading-6 text-slate-600 shadow-sm dark:border-brand-400/25 dark:bg-slate-950/40 dark:text-slate-300">
        {text.userBlock.pageDescription}
      </div>

      <BlockedUsersListSkeleton />
    </section>
  );
}

export default BlockedUsersPageSkeleton;
