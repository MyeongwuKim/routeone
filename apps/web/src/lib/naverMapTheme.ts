const NAVER_DARK_MAP_STYLE_ID =
  import.meta.env.VITE_NCP_MAPS_DARK_STYLE_ID?.trim() ?? "";

type NaverMapLike = {
  setOptions?: (
    optionsOrKey: Record<string, unknown> | string,
    value?: unknown
  ) => void;
};

export function getNaverMapThemeOptions(isDarkMode: boolean) {
  if (!isDarkMode || !NAVER_DARK_MAP_STYLE_ID) {
    return {};
  }

  return {
    gl: true,
    customStyleId: NAVER_DARK_MAP_STYLE_ID,
  };
}

export function applyNaverMapTheme(
  map: NaverMapLike | null | undefined,
  isDarkMode: boolean
) {
  if (!map) {
    return;
  }

  if (!NAVER_DARK_MAP_STYLE_ID || typeof map.setOptions !== "function") {
    return;
  }

  map.setOptions({
    customStyleId: isDarkMode ? NAVER_DARK_MAP_STYLE_ID : null,
  });
}
