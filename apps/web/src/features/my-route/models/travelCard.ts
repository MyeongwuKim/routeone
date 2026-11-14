import { resolveServiceRegion } from "@/data/serviceAreas";
import type { AppLanguage } from "@/stores/appLanguageStore";
import { getCompletedPosterDayGroups } from "../routeCompletionPoster";
import { getRouteDateKey } from "../routeDisplay";
import type { MyRoute } from "../types";

/** 카드 안에서만 쓰는 사진과 크롭 위치. 원본 URL과 방문 인증 데이터는 변경하지 않는다. */
export type TravelCardPhoto = {
  id: string;
  source: "verification" | "album";
  label: string;
  url: string;
  /** 0은 왼쪽·위, 1은 오른쪽·아래 끝이다. 미리보기 object-position과 출력에 같은 비율을 쓴다. */
  focal: { x: number; y: number };
};

/** 한 편집 세션의 입력. candidates는 조회한 인증 사진 후보이며 photos만 카드에 포함된다. */
export type TravelCardDraft = {
  routeId: string;
  title: string;
  caption: string;
  locationLabel: string;
  dateLabel: string;
  candidates: TravelCardPhoto[];
  photos: TravelCardPhoto[];
};

function validDateKey(value: string | null) {
  const key = getRouteDateKey(value);
  if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const date = new Date(`${key}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === key ? key : null;
}

/**
 * 기존 생성 가능 DAY의 실제 방문 사진을 정렬·중복 제거해 최대 네 장을 선택한다.
 * 여행 기록은 읽기만 하며, 앨범 사진이 없어도 시작할 수 있는 로컬 편집 초안을 반환한다.
 */
export function createTravelCardDraft(route: MyRoute, language: AppLanguage): TravelCardDraft {
  const days = getCompletedPosterDayGroups(route);
  if (!days.length || route.isMine === false) throw new Error("Travel card is not available for this route.");
  const candidates: TravelCardPhoto[] = [];
  const seen = new Set<string>();
  for (const stop of days.flatMap(day => day.stops)) {
    const url = stop.verificationPhotoUrl;
    if (!url || seen.has(url)) continue;
    seen.add(url);
    candidates.push({ id: stop.id, source: "verification", label: stop.place.title, url, focal: { x: 0.5, y: 0.5 } });
  }
  const region = resolveServiceRegion(route.primaryRegionLabelKey, route.primaryRegionCode)?.region;
  // 영어 명칭을 확인할 수 없는 지역을 자동 번역하지 않는다. 사용자는 제목을 직접 바꿀 수 있다.
  const locationLabel = language === "ko" ? region?.label ?? "" : "";
  const start = validDateKey(route.travelStartDate);
  const end = validDateKey(route.travelEndDate);
  const formatter = new Intl.DateTimeFormat(language === "ko" ? "ko-KR" : "en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
  const format = (key: string) => formatter.format(new Date(`${key}T12:00:00Z`));
  const dateLabel = start ? `${format(start)}${end && end > start ? ` – ${format(end)}` : ""}` : "";
  return {
    routeId: route.id,
    title: locationLabel ? `${locationLabel}에서 남긴 순간` : language === "ko" ? "나의 여행 기록" : "My travel memories",
    caption: "", locationLabel, dateLabel, candidates,
    photos: candidates.slice(0, 4),
  };
}
