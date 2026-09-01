export type HomeAttractionLoadingPhase =
  | "idle"
  | "fetching-places"
  | "ranking";

export type HomeLoadingPhase =
  | "location"
  | "places"
  | "ranking"
  | "markers";

type ResolveHomeLoadingPhaseOptions = {
  attractionLoadingPhase: HomeAttractionLoadingPhase;
  canShowAttractionLoading: boolean;
  hasAttractionData: boolean;
  isAttractionFetching: boolean;
  isInitialRegionLoading: boolean;
  isRenderingMarkers: boolean;
  isSearchPopupOpen: boolean;
};

export function resolveHomeLoadingPhase({
  attractionLoadingPhase,
  canShowAttractionLoading,
  hasAttractionData,
  isAttractionFetching,
  isInitialRegionLoading,
  isRenderingMarkers,
  isSearchPopupOpen,
}: ResolveHomeLoadingPhaseOptions): HomeLoadingPhase | null {
  if (isSearchPopupOpen) {
    return null;
  }

  if (isInitialRegionLoading) {
    return "location";
  }

  if (!canShowAttractionLoading) {
    return null;
  }

  if (
    attractionLoadingPhase === "fetching-places" ||
    (attractionLoadingPhase === "idle" &&
      isAttractionFetching &&
      !hasAttractionData)
  ) {
    return "places";
  }

  if (attractionLoadingPhase === "ranking" || isAttractionFetching) {
    return "ranking";
  }

  return isRenderingMarkers ? "markers" : null;
}
