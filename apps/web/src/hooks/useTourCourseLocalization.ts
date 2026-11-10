import { useQuery } from "@tanstack/react-query";
import { placeLocalizationApi } from "@/api/placeLocalizationApi";
import type { AppLanguage } from "@/stores/appLanguageStore";

const COURSE_TRANSLATION_STALE_TIME = 60 * 60 * 1000;
const KOREAN_TEXT = /\p{Script=Hangul}/u;

function readEnglishTranslation(value?: string) {
  const translated = value?.trim();
  if (!translated || KOREAN_TEXT.test(translated)) {
    throw new Error("English course translation is unavailable.");
  }
  return translated;
}

function describeCourseText(text: string) {
  return { text, lang: KOREAN_TEXT.test(text) ? "ko" : "en" };
}

/** 영어 모드에서 보이는 코스의 제목만 번역하고, 번역을 받기 전에는 원문을 표시한다. */
export function useTourCourseTitle(courseId: string, title: string, language: AppLanguage, enabled: boolean) {
  const contentId = "tour-course:" + courseId;
  const shouldTranslate = language === "en" && KOREAN_TEXT.test(title);
  const query = useQuery({
    queryKey: ["tour-course-title-en", contentId, title],
    enabled: enabled && shouldTranslate,
    staleTime: COURSE_TRANSLATION_STALE_TIME,
    retry: false,
    queryFn: async () => {
      const { localizeTourPlaces } = await placeLocalizationApi.localizeTourPlaces(
        [{ contentId, contentTypeId: "25", title }],
        true,
      );
      return readEnglishTranslation(localizeTourPlaces.find((item) => item.contentId === contentId)?.title);
    },
  });
  return describeCourseText((shouldTranslate && query.data) || title);
}

/** 코스 소개나 방문지 설명을 번역한다. 호출자가 넘긴 코스별 ID로 일반 장소 설명의 캐시와 분리한다. */
export function useTourCourseDescription(
  contentId: string,
  description: string,
  language: AppLanguage,
  enabled = true,
) {
  const shouldTranslate = language === "en" && KOREAN_TEXT.test(description);
  const query = useQuery({
    queryKey: ["tour-course-description-en", contentId, description],
    enabled: enabled && Boolean(contentId) && shouldTranslate,
    staleTime: COURSE_TRANSLATION_STALE_TIME,
    retry: false,
    queryFn: async () => {
      const { localizeTourPlaceOverview } = await placeLocalizationApi.localizeTourPlaceOverview({
        contentId,
        overview: description,
      });
      return readEnglishTranslation(localizeTourPlaceOverview.overview);
    },
  });
  return describeCourseText((shouldTranslate && query.data) || description);
}
