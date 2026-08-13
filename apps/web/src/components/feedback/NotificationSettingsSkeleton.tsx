import { MdArrowBack } from "react-icons/md";
import { useNavigate } from "react-router-dom";
import { useUiText } from "@/lib/uiText";

const SETTING_ROW_SKELETONS = [
  {
    key: "festival",
    titleWidth: "w-24",
    descriptionWidth: "w-48",
    festival: true,
  },
  {
    key: "route-start",
    titleWidth: "w-28",
    descriptionWidth: "w-52",
    festival: false,
  },
  {
    key: "route-review",
    titleWidth: "w-28",
    descriptionWidth: "w-52",
    festival: false,
  },
  {
    key: "route-arrival",
    titleWidth: "w-24",
    descriptionWidth: "w-44",
    festival: false,
  },
] as const;

export default function NotificationSettingsSkeleton() {
  const navigate = useNavigate();
  const text = useUiText();

  return (
    <section
      aria-busy="true"
      aria-label={text.notificationSettings.loading}
      className="space-y-4 pb-4 text-slate-900 dark:text-slate-100"
    >
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

        {SETTING_ROW_SKELETONS.map((row, index) => (
          <div key={row.key}>
            <div className="flex w-full items-center gap-3 px-4 py-4">
              <div className="skeleton-shimmer size-10 shrink-0 rounded-lg bg-brand-50 dark:bg-brand-400/10" />
              <div className="min-w-0 flex-1">
                <div
                  className={`skeleton-shimmer h-4 ${row.titleWidth} rounded-full bg-slate-200 dark:bg-slate-700`}
                />
                <div
                  className={`skeleton-shimmer mt-2 h-3 ${row.descriptionWidth} max-w-full rounded-full bg-slate-100 dark:bg-slate-800`}
                />
              </div>
              {row.festival ? (
                <div className="flex shrink-0 items-center gap-1.5">
                  <div className="skeleton-shimmer h-6 w-10 rounded-full bg-brand-50 dark:bg-brand-400/10" />
                  <div className="skeleton-shimmer size-5 rounded-full bg-slate-100 dark:bg-slate-800" />
                </div>
              ) : (
                <div className="skeleton-shimmer h-7 w-12 shrink-0 rounded-full bg-slate-200 dark:bg-slate-700" />
              )}
            </div>
            {index < SETTING_ROW_SKELETONS.length - 1 ? (
              <div className="border-b border-brand-50 dark:border-brand-400/15" />
            ) : null}
          </div>
        ))}
      </section>
    </section>
  );
}
