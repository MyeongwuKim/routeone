const NAVER_DARK_MAP_STYLE_ID =
  import.meta.env.VITE_NCP_MAPS_DARK_STYLE_ID?.trim() ?? "";

type NaverMapLike = {
  setOptions?: (
    optionsOrKey: Record<string, unknown> | string,
    value?: unknown
  ) => void;
};

export function getNaverMapThemeOptions(isDarkMode: boolean) {
  const options: Record<string, unknown> = {
    gl: true,
  };

  if (isDarkMode && NAVER_DARK_MAP_STYLE_ID) {
    options.customStyleId = NAVER_DARK_MAP_STYLE_ID;
  }

  return options;
}

export function applyNaverMapTheme(
  map: NaverMapLike | null | undefined,
  isDarkMode: boolean
) {
  if (!map) {
    return;
  }

  if (typeof map.setOptions !== "function") {
    return;
  }

  map.setOptions({
    customStyleId:
      isDarkMode && NAVER_DARK_MAP_STYLE_ID
        ? NAVER_DARK_MAP_STYLE_ID
        : null,
  });
}
