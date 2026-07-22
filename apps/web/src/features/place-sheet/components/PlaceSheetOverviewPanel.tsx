import { lazy, Suspense } from "react";
import PlaceResultCard from "@/components/place/PlaceResultCard";
import { localizePlaceCategoryLabel, type UiText } from "@/lib/uiText";
import type { NearbyTouristPlace } from "@/lib/visitKoreaTourApi";
import type { AppLanguage } from "@/stores/appLanguageStore";
import type { MapSheetDirectionOrigin } from "@/stores/mapSheetStore";
import type { MapSheetPlace } from "@/types/place";
import type { PlaceSheetData } from "../hooks/usePlaceSheetData";
import {
  formatNearbyDistance,
  getNearbyPlaceCategoryIcon,
  getNearbyPlaceCategoryLabel,
  type PlaceSheetCoordinates,
} from "../placeSheetModel";
import PlaceDirectionsSection from "./PlaceDirectionsSection";
import {
  NearbyPlacesSkeleton,
  OverviewSkeleton,
  PlaceInfoRow,
  SkeletonBar,
} from "./PlaceSheetPrimitives";

const PlaceTrendChart = lazy(() => import("./PlaceTrendChart"));

type PlaceSheetOverviewPanelProps = {
  appLanguage: AppLanguage;
  currentLocation: PlaceSheetCoordinates;
  data: PlaceSheetData;
  directionOrigin: MapSheetDirectionOrigin;
  isDarkMode: boolean;
  isVisible: boolean;
  onSelectNearbyPlace: (place: NearbyTouristPlace) => void;
  selectedPlace: MapSheetPlace;
  showDirections: boolean;
  text: UiText;
};

function PlaceTrendChartFallback() {
  return (
    <section className="rounded-3xl border border-brand-200 bg-white p-4 shadow-sm dark:border-brand-400/30 dark:bg-slate-900/70">
      <div className="mb-3 flex items-center justify-between gap-3">
        <SkeletonBar className="h-4 w-28" />
        <SkeletonBar className="h-8 w-32" />
      </div>
      <div className="rounded-2xl border border-brand-100 bg-white px-3 py-3 dark:border-brand-400/25 dark:bg-slate-950/40">
        <SkeletonBar className="h-44 w-full" rounded="rounded-xl" />
      </div>
      <SkeletonBar className="mt-3 h-3 w-3/4" />
    </section>
  );
}

function PlaceSheetOverviewPanel({
  appLanguage,
  currentLocation,
  data,
  directionOrigin,
  isDarkMode,
  isVisible,
  onSelectNearbyPlace,
  selectedPlace,
  showDirections,
  text,
}: PlaceSheetOverviewPanelProps) {
  const {
    concentrationTrendError,
    concentrationTrendPoints,
    detailInfoCenter,
    detailOperatingHours,
    detailOverview,
    detailRestDate,
    isConcentrationTrendLoading,
    isNearbyTouristLoading,
    isRouteLoading,
    isSelectedPlaceDetailReady,
    isTouristAttraction,
    nearbyTouristError,
    nearbyTouristPlaces,
    routeDistanceText,
    routeDurationText,
    routeError,
    routePathPoints,
  } = data;

  return (
    <div
      className={`px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 transition-all duration-200 ${
        isVisible
          ? "min-h-0 opacity-100"
          : "pointer-events-none h-0 overflow-hidden opacity-0"
      }`}
    >
      <div className="space-y-4">
        <div className="rounded-3xl border border-brand-200/80 bg-white px-4 py-4 shadow-sm dark:border-brand-400/30 dark:bg-slate-900/70">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-trip text-sm text-brand-700">PLACE OVERVIEW</p>
            <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-700 dark:bg-brand-400/15 dark:text-brand-200">
              {text.placeSheet.detailTitle}
            </span>
          </div>
          {!isSelectedPlaceDetailReady ? (
            <OverviewSkeleton />
          ) : detailOverview ? (
            <p className="whitespace-pre-line rounded-2xl border border-brand-100 bg-brand-50/45 px-3 py-3 text-sm leading-7 text-slate-700 dark:border-brand-400/25 dark:bg-slate-950/45 dark:text-slate-200">
              {detailOverview}
            </p>
          ) : (
            <div className="rounded-2xl border border-dashed border-brand-200 bg-white/75 px-3 py-4 text-center text-sm text-slate-500 dark:border-brand-400/30 dark:bg-slate-950/35 dark:text-slate-300">
              {text.placeSheet.noOverview}
            </div>
          )}
          {detailOperatingHours || detailRestDate || detailInfoCenter ? (
            <div className="mt-3 grid gap-2">
              <PlaceInfoRow
                label={text.placeSheet.operatingHours}
                value={detailOperatingHours}
                icon="time"
              />
              <PlaceInfoRow
                label={text.placeSheet.closedDays}
                value={detailRestDate}
                icon="calendar"
              />
              <PlaceInfoRow
                label={text.placeSheet.contact}
                value={detailInfoCenter}
                icon="call"
              />
            </div>
          ) : null}
        </div>

        <Suspense fallback={<PlaceTrendChartFallback />}>
          <PlaceTrendChart
            points={concentrationTrendPoints}
            isLoading={isConcentrationTrendLoading}
            errorMessage={concentrationTrendError}
            isTouristAttraction={isTouristAttraction}
          />
        </Suspense>

        {showDirections ? (
          <PlaceDirectionsSection
            appLanguage={appLanguage}
            currentLocation={currentLocation}
            directionOrigin={directionOrigin}
            isDarkMode={isDarkMode}
            isRouteLoading={isRouteLoading}
            routeDistanceText={routeDistanceText}
            routeDurationText={routeDurationText}
            routeError={routeError}
            routePathPoints={routePathPoints}
            selectedPlace={selectedPlace}
            text={text}
          />
        ) : null}

        <section className="rounded-3xl border border-brand-200 bg-white p-4 shadow-sm dark:border-brand-400/30 dark:bg-slate-900/70">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-trip text-sm text-brand-700">
              {text.placeSheet.nearbyTitle}
            </p>
            <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-700 dark:bg-brand-400/15 dark:text-brand-200">
              {text.placeSheet.nearbyBadge}
            </span>
          </div>

          {isNearbyTouristLoading ? (
            <NearbyPlacesSkeleton />
          ) : nearbyTouristPlaces.length > 0 ? (
            <div className="space-y-2">
              {nearbyTouristPlaces.map((place) => {
                const thumbnailUrl = place.firstImage || place.secondImage;
                const distanceLabel = formatNearbyDistance(place.distanceM);
                const categoryLabel = localizePlaceCategoryLabel(
                  getNearbyPlaceCategoryLabel(place),
                  text
                );
                const categoryIcon = getNearbyPlaceCategoryIcon(place);

                return (
                  <PlaceResultCard
                    key={`${place.id}-${place.contentTypeId}`}
                    title={place.title}
                    address={place.address}
                    categoryLabel={categoryLabel}
                    thumbnailUrl={thumbnailUrl}
                    fallbackIcon={categoryIcon}
                    distanceLabel={distanceLabel}
                    surface="tinted"
                    onClick={() => onSelectNearbyPlace(place)}
                  />
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-brand-200 bg-brand-50 px-3 py-4 text-center text-sm text-slate-500 dark:border-brand-400/30 dark:bg-slate-950/35 dark:text-slate-300">
              {nearbyTouristError ?? text.placeSheet.nearbyEmpty}
            </div>
          )}
          <p className="mt-3 text-xs leading-5 text-slate-500">
            {text.placeSheet.nearbyFootnote}
          </p>
        </section>
      </div>
    </div>
  );
}

export default PlaceSheetOverviewPanel;
