type NaverMapInteractionOptionKey = "draggable" | "pinchZoom" | "scrollWheel";

type NaverMapPointerInteractionOptions = Record<
  NaverMapInteractionOptionKey,
  boolean
>;

type NaverMapPointerInteractionTarget = {
  setOptions?: (
    options:
      | Partial<NaverMapPointerInteractionOptions>
      | NaverMapInteractionOptionKey,
    value?: boolean
  ) => void;
};

const POINTER_INTERACTION_OPTIONS: NaverMapPointerInteractionOptions = {
  draggable: true,
  pinchZoom: true,
  scrollWheel: true,
};

export function enableNaverMapPointerInteractions(map: unknown) {
  const mapTarget = map as NaverMapPointerInteractionTarget | null;

  if (typeof mapTarget?.setOptions !== "function") {
    return;
  }

  try {
    mapTarget.setOptions(POINTER_INTERACTION_OPTIONS);
  } catch {
    (Object.keys(POINTER_INTERACTION_OPTIONS) as NaverMapInteractionOptionKey[])
      .forEach((key) => mapTarget.setOptions?.(key, true));
  }
}
