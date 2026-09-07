/**
 * 사용 위치: DAY 포토카드 미리보기 → 테마 선택
 * 용도: 프레임과 장식이 다른 여행 기록 테마를 작은 견본과 함께 선택한다.
 */
import { useUiText } from "@/lib/uiText";
import { ROUTE_POSTER_THEMES, type RoutePosterThemeId } from "../models/routePosterTheme";

const THEME_SWATCHES = {
  journal: { background: "#f5f0e4", frame: "border-4 border-b-8 border-white bg-[#85a698] shadow-sm", font: "font-sans" },
  polaroid: { background: "linear-gradient(135deg,#fffaf0,#e5f4df)", frame: "rotate-[-6deg] rounded-sm border-4 border-b-8 border-white bg-[#b4cec2] shadow-sm", font: "font-sans" },
  blocks: { background: "radial-gradient(circle,#e9f7f4 2px,transparent 3px) 0 0 / 10px 10px,#b8d5d7", frame: "rounded-sm border-4 border-[#347cba] bg-[#ffd45d] shadow-[2px_2px_0_#477887]", font: "font-sans" },
  pixel: { background: "repeating-linear-gradient(0deg,#202b41 0 7px,#2c3850 7px 8px)", frame: "border-[3px] border-[#869bb0] bg-[#536681] shadow-[2px_2px_0_#0c1729]", font: "font-mono" },
  fantasy: { background: "linear-gradient(135deg,#fff5dd,#dcc79e)", frame: "border-[3px] border-double border-[#b79a60] bg-[#e8d9b8] shadow-sm", font: "font-serif" },
} as const;

export default function RoutePosterThemePicker({ value, disabled, onChange }: {
  value: RoutePosterThemeId;
  disabled: boolean;
  onChange: (themeId: RoutePosterThemeId) => void;
}) {
  const text = useUiText();
  const labels = {
    journal: text.routeHistory.themeJournal,
    polaroid: text.routeHistory.themePolaroid,
    blocks: text.routeHistory.themeBlocks,
    pixel: text.routeHistory.themePixel,
    fantasy: text.routeHistory.themeFantasy,
  };
  return (
    <div className="border-b border-amber-900/10 px-4 py-3 dark:border-white/10">
      <p className="mb-2 text-xs font-black text-slate-600 dark:text-slate-300">{text.routeHistory.themeTitle}</p>
      <div className="grid grid-cols-5 gap-1.5" role="group" aria-label={text.routeHistory.themeTitle}>
        {ROUTE_POSTER_THEMES.map((themeId) => {
          const swatch = THEME_SWATCHES[themeId];
          return (
            <button key={themeId} type="button" aria-pressed={value === themeId} disabled={disabled} onClick={() => onChange(themeId)}
              className={`min-w-0 rounded-xl border p-1 transition disabled:opacity-50 ${value === themeId ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600 dark:border-brand-300 dark:bg-brand-400/10 dark:ring-brand-300" : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"}`}>
              <span aria-hidden="true" className="flex h-11 items-center justify-center overflow-hidden rounded-md" style={{ background: swatch.background }}>
                <span className={`h-7 w-9 ${swatch.frame}`} />
              </span>
              <span className={`mt-1 block truncate text-[10px] font-bold sm:text-[11px] text-slate-700 dark:text-slate-100 ${swatch.font}`}>{labels[themeId]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
