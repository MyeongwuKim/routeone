/**
 * 사용 위치: 장소 상세 → 공식 사진 또는 사용자 방문 사진 → 전체 화면
 *
 * 용도:
 * 사진을 크게 넘겨 보고, 사용자 방문 사진은 전체 화면에서도 신고하거나 신고를 취소한다.
 *
 * 구조:
 * 사진 슬라이더, 이동·닫기 버튼, 사용자 사진 신고 동작으로 구성되어 있다.
 */
import { useRef, useState, type PointerEvent } from "react";
import { IoClose } from "react-icons/io5";
import { MdFlag } from "react-icons/md";
import type { PlacePhotosQuery } from "@/generated/graphql";
import PhotoReportDialog from "@/features/photo-report/components/PhotoReportDialog";
import { usePlacePhotoReport } from "@/features/photo-report/hooks/usePlacePhotoReport";
import { useAuthSession } from "@/hooks/useAuthSession";
import { UI_LAYER_CLASS } from "@/lib/uiLayers";
import type { UiText } from "@/lib/uiText";
import type { PlaceImageViewerTarget } from "../placeSheetModel";

type PlaceImageViewerProps = {
  onClose: () => void;
  onStep: (direction: -1 | 1) => void;
  target: PlaceImageViewerTarget | null;
  text: UiText;
  userPhotos: PlacePhotosQuery["placePhotos"];
};

function PlaceImageViewer({
  onClose,
  onStep,
  target,
  text,
  userPhotos,
}: PlaceImageViewerProps) {
  const { isAuthenticated } = useAuthSession();
  const imageSwipeStartXRef = useRef<number | null>(null);
  const [reportPhotoId, setReportPhotoId] = useState<string | null>(null);
  const { cancelReport, isSubmitting, isUpdating, submitReport } =
    usePlacePhotoReport(text.photoReport);
  const activeImageUrl = target?.imageUrls[target.index];
  const activeUserPhoto = activeImageUrl
    ? userPhotos.find((photo) => photo.imageUrl === activeImageUrl)
    : null;
  const isReportedByMe = activeUserPhoto?.reportedByMe ?? false;

  if (!target || !activeImageUrl) {
    return null;
  }

  const showPreviousImage = () => {
    onStep(-1);
  };
  const showNextImage = () => {
    onStep(1);
  };
  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    imageSwipeStartXRef.current = event.clientX;
  };
  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const startX = imageSwipeStartXRef.current;
    imageSwipeStartXRef.current = null;

    if (startX == null) {
      return;
    }

    const deltaX = event.clientX - startX;
    const swipeThreshold = 48;

    if (Math.abs(deltaX) < swipeThreshold) {
      return;
    }

    if (deltaX < 0) {
      showNextImage();
    } else {
      showPreviousImage();
    }
  };

  return (
    <section
      className={`fixed inset-0 ${UI_LAYER_CLASS.mediaViewer} flex items-center justify-center bg-white/35 px-4 py-[max(1rem,env(safe-area-inset-top))] backdrop-blur-xl dark:bg-slate-950/80`}
    >
      <button
        type="button"
        aria-label={text.placeSheet.imageViewerCloseAria}
        onClick={onClose}
        className="absolute inset-0 cursor-zoom-out"
      />

      <div
        className="relative z-10 flex h-full w-full max-w-3xl touch-pan-y flex-col items-center justify-center"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          imageSwipeStartXRef.current = null;
        }}
      >
        <div className="relative w-full overflow-hidden rounded-3xl">
          <div
            className="flex transition-transform duration-300 ease-out"
            style={{
              transform: `translateX(-${target.index * 100}%)`,
            }}
          >
            {target.imageUrls.map((imageUrl, index) => (
              <div
                key={`${imageUrl}-viewer-${index}`}
                className="flex min-w-full items-center justify-center"
              >
                <img
                  src={imageUrl}
                  alt={`${target.title} ${index + 1}`}
                  draggable={false}
                  className={`max-h-[78dvh] max-w-full select-none rounded-3xl object-contain shadow-[0_24px_80px_rgba(15,23,42,0.22)] ${
                    userPhotos.some(
                      (photo) => photo.imageUrl === imageUrl && photo.reportedByMe
                    )
                      ? "scale-105 blur-2xl"
                      : ""
                  }`}
                />
              </div>
            ))}
          </div>
          {isReportedByMe ? (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
              <span className="flex items-center gap-2 rounded-full bg-slate-900/65 px-4 py-2.5 text-sm font-black text-white shadow-lg backdrop-blur">
                <MdFlag />
                {text.photoReport.reportedPhoto}
              </span>
            </div>
          ) : null}
        </div>
        <div className="mt-4 rounded-full bg-slate-900/45 px-3 py-1 text-xs font-bold text-white shadow-sm backdrop-blur">
          {target.index + 1} / {target.imageUrls.length}
        </div>
        {isAuthenticated && activeUserPhoto && !activeUserPhoto.isMine ? (
          isReportedByMe ? (
            <div className="relative z-20 mt-3 flex justify-center">
              <button
                type="button"
                disabled={isUpdating}
                onClick={() => cancelReport(activeUserPhoto.id)}
                className="rounded-full bg-white/90 px-4 py-2 text-xs font-black text-slate-700 shadow-sm backdrop-blur disabled:opacity-50 dark:bg-slate-900/80 dark:text-white"
              >
                {text.photoReport.cancelReport}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setReportPhotoId(activeUserPhoto.id)}
              disabled={isUpdating}
              className="relative z-20 mt-3 flex items-center gap-1.5 rounded-full bg-slate-900/60 px-4 py-2 text-xs font-black text-white shadow-sm backdrop-blur disabled:opacity-50"
            >
              <MdFlag />
              {text.photoReport.report}
            </button>
          )
        ) : null}
      </div>

      <button
        type="button"
        aria-label={text.placeSheet.previousImageAria}
        onClick={showPreviousImage}
        className="absolute left-3 top-1/2 z-20 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/70 text-2xl text-slate-700 shadow-sm backdrop-blur transition hover:bg-white/80 dark:bg-slate-900/80 dark:text-white dark:hover:bg-slate-800/90"
      >
        ‹
      </button>
      <button
        type="button"
        aria-label={text.placeSheet.nextImageAria}
        onClick={showNextImage}
        className="absolute right-3 top-1/2 z-20 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/70 text-2xl text-slate-700 shadow-sm backdrop-blur transition hover:bg-white/80 dark:bg-slate-900/80 dark:text-white dark:hover:bg-slate-800/90"
      >
        ›
      </button>
      <button
        type="button"
        aria-label={text.placeSheet.imageViewerCloseAria}
        onClick={onClose}
        className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-20 flex size-10 items-center justify-center rounded-full bg-white/70 text-xl text-slate-700 shadow-sm backdrop-blur transition hover:bg-white/80 dark:bg-slate-900/80 dark:text-white dark:hover:bg-slate-800/90"
      >
        <IoClose />
      </button>
      <PhotoReportDialog
        key={reportPhotoId ?? "closed"}
        isOpen={Boolean(reportPhotoId)}
        isSubmitting={isSubmitting}
        onClose={() => setReportPhotoId(null)}
        onSubmit={(reason, details) => {
          if (!reportPhotoId) return;
          submitReport({ photoId: reportPhotoId, reason, details });
          setReportPhotoId(null);
        }}
        text={text.photoReport}
      />
    </section>
  );
}

export default PlaceImageViewer;
