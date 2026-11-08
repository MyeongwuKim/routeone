import { getWalkingRouteText } from "./walkingRouteText";
import type { AppLanguage } from "@/stores/appLanguageStore";
import type { WalkingRouteResult } from "./walkingTypes";

/** 도보 예상 시간의 계산 기준, 미확인 접근 간격, 공개 데이터 출처를 경로와 함께 표시한다. */
export default function WalkingRouteNotice({ language, result }: {
  language: AppLanguage; result?: WalkingRouteResult | null;
}) {
  const text = getWalkingRouteText(language);
  const accessDistance = (result?.startAccessDistanceM ?? 0) + (result?.goalAccessDistanceM ?? 0);
  return <div className="space-y-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
    <p>{text.estimate}</p>
    {accessDistance > 5 ? <p className="rounded-xl bg-amber-50 px-3 py-2 text-amber-900 dark:bg-amber-900/25 dark:text-amber-200">{text.accessNotice(accessDistance)}</p> : null}
    <p>
      <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline underline-offset-2">{text.source}</a>
      {result ? <span className="mt-0.5 block">{text.dataDate(result.dataDate)}</span> : null}
    </p>
  </div>;
}
