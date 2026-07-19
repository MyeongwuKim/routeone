import { useRef, type PointerEvent } from "react";
import { IoClose } from "react-icons/io5";
import type { UiText } from "@/lib/uiText";
import type { PlaceImageViewerTarget } from "../placeSheetModel";

type PlaceImageViewerProps = {
  onClose: () => void;
  onStep: (direction: -1 | 1) => void;
  target: PlaceImageViewerTarget | null;
  text: UiText;
};

function PlaceImageViewer({
  onClose,
  onStep,
  target,
  text,
}: PlaceImageViewerProps) {
  const imageSwipeStartXRef = useRef<number | null>(null);
  const activeImageUrl = target?.imageUrls[target.index];

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
    <section className="fixed inset-0 z-[3600] flex items-center justify-center bg-white/35 px-4 py-[max(1rem,env(safe-area-inset-top))] backdrop-blur-xl">
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
        <div className="w-full overflow-hidden rounded-3xl">
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
                  className="max-h-[78dvh] max-w-full select-none rounded-3xl object-contain shadow-[0_24px_80px_rgba(15,23,42,0.22)]"
                />
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4 rounded-full bg-slate-900/45 px-3 py-1 text-xs font-bold text-white shadow-sm backdrop-blur">
          {target.index + 1} / {target.imageUrls.length}
        </div>
      </div>

      <button
        type="button"
        aria-label={text.placeSheet.previousImageAria}
        onClick={showPreviousImage}
        className="absolute left-3 top-1/2 z-20 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/65 text-2xl text-slate-700 shadow-sm backdrop-blur transition hover:bg-white/80"
      >
        ‹
      </button>
      <button
        type="button"
        aria-label={text.placeSheet.nextImageAria}
        onClick={showNextImage}
        className="absolute right-3 top-1/2 z-20 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/65 text-2xl text-slate-700 shadow-sm backdrop-blur transition hover:bg-white/80"
      >
        ›
      </button>
      <button
        type="button"
        aria-label={text.placeSheet.imageViewerCloseAria}
        onClick={onClose}
        className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-20 flex size-10 items-center justify-center rounded-full bg-white/65 text-xl text-slate-700 shadow-sm backdrop-blur transition hover:bg-white/80"
      >
        <IoClose />
      </button>
    </section>
  );
}

export default PlaceImageViewer;
