import type { AppLanguage } from "@/stores/appLanguageStore";
import type { HomeRecommendationText } from "./homeRecommendationText";
import type { useHomeCoursePreview } from "./useHomeRecommendations";

type Props = {
  language: AppLanguage;
  text: HomeRecommendationText;
  facts: Pick<ReturnType<typeof useHomeCoursePreview>, "distance" | "duration" | "theme">;
};

/** 카드와 상세 팝업에 같은 거리·시간·테마를 표시하고, 영어 테마는 번역이 있을 때만 추가한다. */
export default function HomeCourseFacts({ language, text, facts }: Props) {
  const showTheme = facts.theme.text && (language === "ko" || facts.theme.lang === "en");
  const items = [
    { label: text.courseDistance, value: facts.distance },
    { label: text.courseDuration, value: facts.duration },
    ...(showTheme ? [{ label: text.courseTheme, value: facts.theme }] : []),
  ];

  return (
    <dl className="flex flex-wrap gap-2">
      {items.map(({ label, value }) => (
        <div key={label} className="flex min-w-0 max-w-full flex-wrap items-baseline gap-x-1.5 rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs dark:bg-brand-900/40">
          <dt className="font-semibold text-brand-800 dark:text-brand-200">{label}</dt>
          <dd lang={value.lang} className="min-w-0 break-words text-slate-700 empty:hidden dark:text-slate-200">
            {language === "ko" || value.lang === "en" ? value.text : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}
