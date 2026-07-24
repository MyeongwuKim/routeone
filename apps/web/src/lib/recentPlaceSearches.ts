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
