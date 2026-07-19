import { IoTimeOutline } from "react-icons/io5";
import type { UiText } from "@/lib/uiText";
import type { MapSheetPlace } from "@/types/place";
import type { PlaceSheetData } from "../hooks/usePlaceSheetData";
import {
  ImageStripSkeleton,
  PlacePhotoThumbnail,
} from "./PlaceSheetPrimitives";

type PlaceSheetMediaSectionProps = Pick<
  PlaceSheetData,
  | "activeImageList"
  | "isPlacePhotosLoading"
  | "isSelectedPlaceDetailReady"
  | "placeStaySummaryLabel"
  | "userPlacePhotos"
  | "userPlacePhotoViewerUrls"
> & {
  onOpenGoogleImageSearch: () => void;
  onOpenImageViewer: (
    imageUrls: string[],
    index: number,
    title: string
  ) => void;
  selectedPlace: MapSheetPlace;
  text: UiText;
};

function PlaceSheetMediaSection({
  activeImageList,
  isPlacePhotosLoading,
  isSelectedPlaceDetailReady,
  onOpenGoogleImageSearch,
  onOpenImageViewer,
  placeStaySummaryLabel,
  selectedPlace,
  text,
  userPlacePhotos,
  userPlacePhotoViewerUrls,
}: PlaceSheetMediaSectionProps) {
  return (
    <>
      <div className="mt-3 flex items-center gap-3 rounded-2xl border border-brand-100 bg-brand-50/70 px-3 py-3 text-xs dark:border-brand-400/25 dark:bg-slate-950/35">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-base text-brand-600 shadow-sm dark:bg-brand-400/15 dark:text-brand-200">
          <IoTimeOutline />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-black text-brand-700 dark:text-brand-200">
            {text.placeSheet.userAverageStay}
          </p>
          <p className="mt-1 line-clamp-2 leading-5 text-slate-600 dark:text-slate-300">
            {placeStaySummaryLabel}
          </p>
        </div>
      </div>

      <div className="mt-5">
        <div className="scrollbar-hide -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1">
          {!isSelectedPlaceDetailReady ? (
            <ImageStripSkeleton />
          ) : activeImageList.length > 0 ? (
            <>
              {activeImageList.map((imageUrl, index) => (
                <img
                  key={`${imageUrl}-${index}`}
                  src={imageUrl}
                  alt={text.placeSheet.placeImageAlt(
                    selectedPlace.title,
                    index + 1
                  )}
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    onOpenImageViewer(
                      activeImageList,
                      index,
                      selectedPlace.title
                    )
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      onOpenImageViewer(
                        activeImageList,
                        index,
                        selectedPlace.title
                      );
                    }
                  }}
                  className="h-44 w-40 shrink-0 snap-start cursor-zoom-in rounded-2xl border border-brand-100 bg-brand-50 object-cover"
                />
              ))}
              <div className="flex h-44 w-40 shrink-0 snap-start flex-col items-center justify-center rounded-2xl border border-dashed border-brand-200 bg-brand-50 px-3 text-center text-sm text-slate-500">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-lg shadow-sm">
                  {selectedPlace.icon}
                </div>
                <p className="mt-3 text-xs font-semibold text-slate-600">
                  {text.placeSheet.searchMore}
                </p>
                <button
                  type="button"
                  onClick={onOpenGoogleImageSearch}
                  className="pointer-events-auto mt-3 rounded-full border border-brand-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-brand-700"
                >
                  {text.placeSheet.viewOnGoogle}
                </button>
              </div>
            </>
          ) : (
            <div className="flex h-52 w-full min-w-full shrink-0 snap-start flex-col items-center justify-center rounded-3xl border border-dashed border-brand-200 bg-brand-50 px-5 text-center text-sm text-slate-500">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-2xl shadow-sm">
                {selectedPlace.icon}
              </div>
              <p className="mt-4 text-sm font-semibold text-slate-700">
                {text.placeSheet.imageMissingTitle}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {text.placeSheet.imageMissingDescription}
              </p>
              <button
                type="button"
                onClick={onOpenGoogleImageSearch}
                className="pointer-events-auto mt-4 rounded-full border border-brand-300 bg-white px-4 py-2 text-xs font-semibold text-brand-700"
              >
                {text.placeSheet.viewOnGoogle}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-black text-slate-900 dark:text-white">
              {text.placeSheet.userPhotosTitle}
            </p>
            <p className="mt-0.5 text-xs font-semibold text-slate-500 dark:text-slate-300">
              {text.placeSheet.userPhotosDescription}
            </p>
          </div>
          {userPlacePhotos.length > 0 ? (
            <span className="shrink-0 rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-black text-brand-700 ring-1 ring-brand-100 dark:bg-brand-400/15 dark:text-brand-100 dark:ring-brand-400/25">
              {userPlacePhotos.length}
            </span>
          ) : null}
        </div>
        <div className="scrollbar-hide -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1">
          {isPlacePhotosLoading ? (
            <ImageStripSkeleton />
          ) : userPlacePhotos.length > 0 ? (
            userPlacePhotos.map((photo, index) => (
              <button
                key={photo.id}
                type="button"
                onClick={() =>
                  onOpenImageViewer(
                    userPlacePhotoViewerUrls,
                    index,
                    text.placeSheet.userPhotoViewerTitle(selectedPlace.title)
                  )
                }
                className="group relative h-44 w-40 shrink-0 snap-start overflow-hidden rounded-2xl border border-brand-100 bg-brand-50 text-left shadow-sm"
              >
                <PlacePhotoThumbnail
                  thumbnailUrl={photo.thumbnailUrl}
                  imageUrl={photo.imageUrl}
                  alt={text.placeSheet.userPhotoAlt(
                    selectedPlace.title,
                    index + 1
                  )}
                />
                <span className="absolute bottom-2 left-2 rounded-full bg-slate-950/60 px-2 py-1 text-[10px] font-black text-white backdrop-blur">
                  {text.placeSheet.visitPhoto}
                </span>
              </button>
            ))
          ) : (
            <div className="flex h-32 w-full min-w-full shrink-0 snap-start flex-col items-center justify-center rounded-2xl border border-dashed border-brand-200 bg-brand-50/70 px-4 text-center dark:border-brand-400/25 dark:bg-slate-950/35">
              <div className="flex size-10 items-center justify-center rounded-full bg-white text-lg shadow-sm dark:bg-brand-400/15">
                {selectedPlace.icon}
              </div>
              <p className="mt-3 text-sm font-black text-slate-700 dark:text-slate-100">
                {text.placeSheet.noUserPhotosTitle}
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-300">
                {text.placeSheet.noUserPhotosDescription}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default PlaceSheetMediaSection;
