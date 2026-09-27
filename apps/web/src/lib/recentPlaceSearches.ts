
const RECENT_PLACE_SEARCHES_STORAGE_KEY = "routeone:recent-place-searches";
const RECENT_PLACE_SEARCHES_LIMIT = 10;

function normalizeRecentPlaceSearches(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  const searches = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);

  return [...new Set(searches)].slice(0, RECENT_PLACE_SEARCHES_LIMIT);
}

/**
 * localStorage에 저장된 최근 장소 검색어를 읽어 공백 제거, 빈 값 제외, 중복 제거를 적용한다.
 * 최근 순서를 유지한 최대 10개를 반환하며, 브라우저가 아니거나 저장값 파싱에 실패하면 빈 배열을 반환한다.
 */
export function readRecentPlaceSearches() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const storedValue = window.localStorage.getItem(
      RECENT_PLACE_SEARCHES_STORAGE_KEY
    );
    return storedValue
      ? normalizeRecentPlaceSearches(JSON.parse(storedValue))
      : [];
  } catch {
    return [];
  }
}

/**
 * searches를 공백 제거, 빈 값 제외, 중복 제거한 뒤 최근 순서 기준 최대 10개만 localStorage에 저장한다.
 * 저장 공간에 접근할 수 없는 환경에서도 정규화한 배열은 반환하므로 검색 기능 자체는 계속 사용할 수 있다.
 */
export function writeRecentPlaceSearches(searches: string[]) {
  const normalizedSearches = normalizeRecentPlaceSearches(searches);

  if (typeof window === "undefined") {
    return normalizedSearches;
  }

  try {
    window.localStorage.setItem(
      RECENT_PLACE_SEARCHES_STORAGE_KEY,
      JSON.stringify(normalizedSearches)
    );
  } catch {
    // 검색은 저장 공간 접근이 제한된 환경에서도 계속 사용할 수 있어야 한다.
  }

  return normalizedSearches;
}
