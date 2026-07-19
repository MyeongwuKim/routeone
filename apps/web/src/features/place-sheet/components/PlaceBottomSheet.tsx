import { useEffect, useRef, useState } from "react";
import { DEFAULT_GANGWON_REGION } from "@/data/gangwonRegions";
import {
  IoBagAdd,
  IoBagAddOutline,
  IoClose,
  IoInformationCircleOutline,
} from "react-icons/io5";
import { usePlaceSheetLayout } from "../hooks/usePlaceSheetLayout";
import { usePlaceSheetData } from "../hooks/usePlaceSheetData";
import {
  buildGoogleImageSearchUrl,
  createMapSheetPlaceFromNearbyPlace,
  getTopRankBadgeStyle,
  type PlaceImageViewerTarget,
} from "../placeSheetModel";
import PlaceImageViewer from "./PlaceImageViewer";
import PlaceSheetMediaSection from "./PlaceSheetMediaSection";
import PlaceSheetOverviewPanel from "./PlaceSheetOverviewPanel";
import { CompactHoursBadge, SkeletonBar } from "./PlaceSheetPrimitives";
import { localizePlaceCategoryLabel, useUiText } from "@/lib/uiText";
import type { NearbyTouristPlace } from "@/lib/visitKoreaTourApi";
import { useMapSheetStore } from "@/stores/mapSheetStore";
import { useAppLanguageStore } from "@/stores/appLanguageStore";
import { usePlaceCartStore } from "@/stores/placeCartStore";
import { useUiThemeStore } from "@/stores/uiThemeStore";
import { useUiToastStore } from "@/stores/uiToastStore";

const SHEET_HEADER_HEIGHT_PX = 64;
const SHEET_HEADLINE_MIN_HEIGHT_PX = 108;

function PlaceBottomSheet() {
  const appLanguage = useAppLanguageStore((state) => state.language);
  const text = useUiText();
  const isDarkMode = useUiThemeStore((state) => state.mode === "dark");
  const {
    isOpen,
    sheetMode,
    sheetResetVersion,
    selectedPlace,
    openSheet,
    updateSelectedPlace,
    resetSheet,
  } = useMapSheetStore();
  const { savedPlaceIds, toggleSavedPlace } = usePlaceCartStore();
  const showToast = useUiToastStore((state) => state.showToast);
  const [isTopRankInfoOpen, setIsTopRankInfoOpen] = useState(false);
  const [imageViewerTarget, setImageViewerTarget] =
    useState<PlaceImageViewerTarget | null>(null);
  const contentScrollRef = useRef<HTMLDivElement | null>(null);

  const currentLocation = DEFAULT_GANGWON_REGION.center;

  const isFullPopupMode = sheetMode === "full-popup";
  const isCurrentPlaceSaved = selectedPlace
    ? savedPlaceIds.includes(selectedPlace.id)
    : false;

  const {
    isSheetExpanded,
    isDraggingSheet,
    sheetTop,
    showOverviewPanel,
    handleSheetPointerDown,
    handleSheetPointerMove,
    handleSheetPointerUp,
  } = usePlaceSheetLayout({
    isSheetOpen: isOpen && !isFullPopupMode,
    onRequestClose: resetSheet,
    resetVersion: sheetResetVersion,
  });

  const placeSheetData = usePlaceSheetData({
    appLanguage,
    currentLocation,
    isOpen,
    selectedPlace,
    text,
    updateSelectedPlace,
  });
  const {
    activeImageList,
    detailHoursBadgeValue,
    isPlacePhotosLoading,
    isSelectedPlaceDetailReady,
    placeStaySummaryLabel,
    selectedPlaceKey,
    userPlacePhotos,
    userPlacePhotoViewerUrls,
  } = placeSheetData;
  const shouldShowOverviewPanel = isFullPopupMode || showOverviewPanel;
  const shouldShowExpandedSection = isFullPopupMode || isSheetExpanded;
  const selectedTopRank = selectedPlace?.topRank ?? null;
  const topRankBadge = selectedTopRank
    ? getTopRankBadgeStyle(selectedTopRank, text)
    : null;
  const topRankButtonLabel = selectedTopRank
    ? text.placeSheet.predictionTop(selectedTopRank)
    : "";
  const selectedPlaceContentTypeLabel = localizePlaceCategoryLabel(
    selectedPlace?.contentTypeLabel,
    text
  );
  const selectedPlaceCategoryName = localizePlaceCategoryLabel(
    selectedPlace?.categoryName,
    text
  );
  const shouldShowCategoryName =
    Boolean(selectedPlace?.categoryName?.trim()) &&
    selectedPlaceCategoryName !== selectedPlaceContentTypeLabel;

  const handleOpenGoogleImageSearch = () => {
    if (!selectedPlace) {
      return;
    }

    const targetKeyword = `${selectedPlace.title} ${selectedPlace.address}`;
    window.open(
      buildGoogleImageSearchUrl(targetKeyword, text),
      "_blank",
      "noopener,noreferrer"
    );
  };
  const openImageViewer = (
    imageUrls: string[],
    index: number,
    title: string
  ) => {
    if (imageUrls.length === 0) {
      return;
    }

    setImageViewerTarget({
      imageUrls,
      index,
      title,
    });
  };
  const closeImageViewer = () => setImageViewerTarget(null);
  const handleImageViewerStep = (direction: -1 | 1) => {
    setImageViewerTarget((target) => {
      if (!target || target.imageUrls.length === 0) {
        return target;
      }

      return {
        ...target,
        index:
          (target.index + direction + target.imageUrls.length) %
          target.imageUrls.length,
      };
    });
  };

  const handleSelectNearbyPlace = (place: NearbyTouristPlace) => {
    if (!selectedPlace) {
      return;
    }

    openSheet(
      createMapSheetPlaceFromNearbyPlace({
        place,
        areaCode: selectedPlace.areaCode,
        signguCode: selectedPlace.signguCode,
      }),
      { mode: sheetMode }
    );

    requestAnimationFrame(() => {
      contentScrollRef.current?.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    });
  };

  useEffect(() => {
    contentScrollRef.current?.scrollTo({
      top: 0,
      behavior: "instant",
    });
  }, [selectedPlaceKey]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setIsTopRankInfoOpen(false);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [isOpen, selectedPlaceKey]);

  if (!isOpen || !selectedPlace) {
    return null;
  }

  const shouldOffsetSheetHeader = isSheetExpanded || isFullPopupMode;
  const sheetHeaderStyle = {
    minHeight: shouldOffsetSheetHeader
      ? `calc(${SHEET_HEADER_HEIGHT_PX}px + env(safe-area-inset-top))`
      : `${SHEET_HEADER_HEIGHT_PX}px`,
    paddingTop: shouldOffsetSheetHeader
      ? "env(safe-area-inset-top)"
      : undefined,
  };

  return (
    <>
      <button
        type="button"
        onClick={resetSheet}
        aria-label={text.placeSheet.bottomSheetCloseAria}
        className="fixed inset-0 z-[1800] bg-slate-900/25"
      />

      <section
        className={
          isFullPopupMode
            ? "fixed inset-0 z-[3000] w-full bg-white"
            : `fixed bottom-0 z-[1900] w-full bg-white ${
                isSheetExpanded
                  ? "inset-x-0 rounded-none border-0 shadow-none"
                  : "inset-x-0 mx-auto max-w-md rounded-t-3xl border border-brand-200 shadow-[0_-10px_32px_rgba(15,23,42,0.25)]"
              } ${
                isDraggingSheet
                  ? "transition-none"
                  : "transition-[top] duration-300"
              }`
        }
        style={isFullPopupMode ? undefined : { top: `${sheetTop}px` }}
      >
        <div className="flex h-full flex-col">
          <div
            role="button"
            tabIndex={0}
            className={`${isFullPopupMode ? "" : "touch-none"} ${
              isSheetExpanded || isFullPopupMode
                ? "rounded-none"
                : "rounded-t-3xl"
            }`}
            style={sheetHeaderStyle}
            onPointerDown={isFullPopupMode ? undefined : handleSheetPointerDown}
            onPointerMove={isFullPopupMode ? undefined : handleSheetPointerMove}
            onPointerUp={isFullPopupMode ? undefined : handleSheetPointerUp}
            onPointerCancel={isFullPopupMode ? undefined : handleSheetPointerUp}
          >
            <div
              className={`flex items-center px-4 ${
                isSheetExpanded || isFullPopupMode
                  ? "h-full justify-end"
                  : "h-full justify-center"
              }`}
            >
              {isSheetExpanded || isFullPopupMode ? (
                <button
                  type="button"
                  aria-label={text.placeSheet.sheetCloseAria}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={resetSheet}
                  className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-xl text-brand-700 shadow-sm transition hover:bg-brand-100 dark:border-brand-400/30 dark:bg-[#0f3431] dark:text-brand-200 dark:shadow-[0_10px_24px_rgba(0,0,0,0.22)] dark:hover:bg-[#13423e]"
                >
                  <IoClose />
                </button>
              ) : (
                <div className="flex cursor-grab justify-center active:cursor-grabbing">
                  <div className="h-1.5 w-12 rounded-full bg-brand-200" />
                </div>
              )}
            </div>
          </div>

          <div
            ref={contentScrollRef}
            className={`min-h-0 flex-1 ${
              isSheetExpanded || isFullPopupMode
                ? "scrollbar-hide overflow-y-auto"
                : "overflow-hidden"
            }`}
          >
            <div
              className="px-5 pt-4"
              style={{ minHeight: `${SHEET_HEADLINE_MIN_HEIGHT_PX}px` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-trip text-[30px] leading-[1.15] text-slate-900">
                    {selectedPlace.title}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-brand-700">
                      {selectedPlace.icon} {selectedPlaceContentTypeLabel}
                    </p>
                    {isSelectedPlaceDetailReady ? (
                      <CompactHoursBadge value={detailHoursBadgeValue} />
                    ) : (
                      <SkeletonBar className="h-7 w-28" />
                    )}
                  </div>
                  {shouldShowCategoryName ? (
                    <p className="mt-1 text-sm text-slate-600">
                      {selectedPlaceCategoryName}
                    </p>
                  ) : null}
                </div>
                <div className="mt-1 flex shrink-0 items-center gap-2">
                  {topRankBadge ? (
                    <button
                      type="button"
                      onClick={() => setIsTopRankInfoOpen(true)}
                      className={`inline-flex h-10 items-center gap-1 rounded-full border px-3 text-xs font-bold ${topRankBadge.className}`}
                    >
                      {topRankButtonLabel}
                      <IoInformationCircleOutline className="text-sm" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    aria-label={text.placeSheet.addToRouteAria}
                    onClick={() => {
                      if (selectedPlace) {
                        const willAddToCart = !isCurrentPlaceSaved;
                        toggleSavedPlace(selectedPlace, activeImageList[0] ?? "");
                        if (willAddToCart) {
                          showToast(text.placeSheet.addToCartToast);
                        }
                      }
                    }}
                    className="rounded-full border border-brand-200 bg-brand-50 p-2 text-brand-700"
                  >
                    {isCurrentPlaceSaved ? <IoBagAdd /> : <IoBagAddOutline />}
                  </button>
                </div>
              </div>

              <p className="mt-4 text-sm leading-6 text-slate-600">
                {selectedPlace.address}
              </p>

              <PlaceSheetMediaSection
                activeImageList={activeImageList}
                isPlacePhotosLoading={isPlacePhotosLoading}
                isSelectedPlaceDetailReady={isSelectedPlaceDetailReady}
                onOpenGoogleImageSearch={handleOpenGoogleImageSearch}
                onOpenImageViewer={openImageViewer}
                placeStaySummaryLabel={placeStaySummaryLabel}
                selectedPlace={selectedPlace}
                text={text}
                userPlacePhotos={userPlacePhotos}
                userPlacePhotoViewerUrls={userPlacePhotoViewerUrls}
              />
            </div>

            <PlaceSheetOverviewPanel
              appLanguage={appLanguage}
              currentLocation={currentLocation}
              data={placeSheetData}
              isDarkMode={isDarkMode}
              isVisible={shouldShowOverviewPanel}
              onSelectNearbyPlace={handleSelectNearbyPlace}
              selectedPlace={selectedPlace}
              showDirections={shouldShowExpandedSection}
              text={text}
            />
          </div>
        </div>
      </section>

      {isTopRankInfoOpen && topRankBadge ? (
        <div className="fixed inset-0 z-[2600] flex items-end justify-center bg-slate-900/35 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            aria-label={text.placeSheet.topRankInfoCloseAria}
            onClick={() => setIsTopRankInfoOpen(false)}
            className="absolute inset-0"
          />
          <section className="relative w-full max-w-md rounded-3xl border border-brand-200 bg-white px-5 py-5 shadow-[0_20px_60px_rgba(15,23,42,0.25)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-trip text-sm text-brand-700">
                  {text.placeSheet.topRankInfoTitle}
                </p>
                <p className="mt-1 text-xl font-semibold text-slate-900">
                  {topRankBadge.label}
                </p>
              </div>
              <button
                type="button"
                aria-label={text.placeSheet.topRankInfoCloseAria}
                onClick={() => setIsTopRankInfoOpen(false)}
                className="rounded-full border border-slate-200 bg-white p-2 text-slate-600"
              >
                <IoClose />
              </button>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              {text.placeSheet.topRankInfoDescription}
            </p>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              {text.placeSheet.topRankInfoNote}
            </p>
          </section>
        </div>
      ) : null}

      <PlaceImageViewer
        target={imageViewerTarget}
        text={text}
        onClose={closeImageViewer}
        onStep={handleImageViewerStep}
      />
    </>
  );
}

export default PlaceBottomSheet;
