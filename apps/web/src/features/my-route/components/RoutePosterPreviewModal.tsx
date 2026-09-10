/**
 * 사용 위치: 내 정보 → 다녀온 루트 → DAY 포토카드
 * 용도: 카드 미리보기와 테마·배경 선택, 저장·공유 버튼을 보여준다.
 * 구조: DAY 선택, 꾸미기 옵션, PNG 미리보기, 하단 액션으로 구성한다.
 */
import { useRef, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import { MdClose, MdDownload, MdPhotoLibrary, MdShare } from "react-icons/md";
import { PotatoLoadingCard } from "@/components/feedback/PotatoLoadingOverlay";
import { useUiText } from "@/lib/uiText";
import { nativeBridge } from "@/native-bridge";
import { useUiToastStore } from "@/stores/uiToastStore";
import { ROUTE_COMPLETION_POSTER_BACKGROUNDS, prepareRouteCompletionPosterBackgroundImage, type RouteCompletionPosterBackgroundId } from "../routeCompletionPoster";
import { getRouteTitle } from "../routeDisplay";
import type { RoutePosterPreview } from "../hooks/useRoutePosterPreview";
import type { RoutePosterThemeId } from "../models/routePosterTheme";
import RoutePosterThemePicker from "./RoutePosterThemePicker";

export default function RoutePosterPreviewModal({
  preview,
  isGenerating,
  onSelectTheme,
  onClose,
  onSelectCard,
  onSelectBackground,
  onSelectCustomBackground,
  onDownload,
  onShare,
}: {
  preview: RoutePosterPreview;
  isGenerating: boolean;
  onSelectTheme: (themeId: RoutePosterThemeId) => void;
  onClose: () => void;
  onSelectCard: (index: number) => void;
  onSelectBackground: (backgroundId: RouteCompletionPosterBackgroundId) => void;
  onSelectCustomBackground: (dataUrl: string) => void;
  onDownload: () => void;
  onShare: () => void;
}) {
  const text = useUiText();
  const showToast = useUiToastStore((state) => state.showToast);
  const backgroundFileInputRef = useRef<HTMLInputElement>(null);
  const currentCard =
    preview.cards[preview.currentIndex] ?? preview.cards[0] ?? null;
  const backgroundLabels = {
    paper: text.routeHistory.backgroundPaper,
    sunset: text.routeHistory.backgroundSunset,
    ocean: text.routeHistory.backgroundOcean,
    forest: text.routeHistory.backgroundForest,
    lavender: text.routeHistory.backgroundLavender,
    dawn: text.routeHistory.backgroundDawn,
  } satisfies Record<
    (typeof ROUTE_COMPLETION_POSTER_BACKGROUNDS)[number]["id"],
    string
  >;

  const handleChooseAlbumBackground = async () => {
    const nativePhotoRequest = nativeBridge.media.takeVisitPhoto("library");

    if (!nativePhotoRequest) {
      backgroundFileInputRef.current?.click();
      return;
    }

    try {
      const photo = await nativePhotoRequest;

      if (!photo.dataUrl) {
        throw new Error("Selected photo data is unavailable.");
      }

      const backgroundDataUrl =
        await prepareRouteCompletionPosterBackgroundImage(photo.dataUrl);
      onSelectCustomBackground(backgroundDataUrl);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "";

      if (/취소|cancel/i.test(errorMessage)) {
        return;
      }

      console.error(error);
      showToast(text.routeHistory.backgroundChangeErrorToast);
    }
  };

  const handleBackgroundFileChange = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const input = event.currentTarget;
    const file = input.files?.[0];

    input.value = "";

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        if (typeof reader.result !== "string") {
          throw new Error("Selected photo data is unavailable.");
        }

        const backgroundDataUrl =
          await prepareRouteCompletionPosterBackgroundImage(reader.result);
        onSelectCustomBackground(backgroundDataUrl);
      } catch (error) {
        console.error(error);
        showToast(text.routeHistory.backgroundChangeErrorToast);
      }
    };
    reader.onerror = () => {
      showToast(text.routeHistory.backgroundChangeErrorToast);
    };
    reader.readAsDataURL(file);
  };

  if (!currentCard) {
    return null;
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[3200] flex flex-col bg-[#f6ead4] text-slate-900 dark:bg-[#071718] dark:text-slate-100"
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-amber-900/10 bg-[#fff7df]/95 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] shadow-sm dark:border-white/10 dark:bg-[#0b2523]/95">
        <div className="min-w-0">
          <p className="text-xs font-black text-brand-700">
            {text.routeHistory.posterTitle}
          </p>
          <h2 className="truncate text-base font-black text-slate-900">
            {getRouteTitle(preview.route, text)} · {currentCard.label}
          </h2>
        </div>
        <button
          type="button"
          aria-label={text.routeHistory.closeAria}
          onClick={onClose}
          className="flex size-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-xl text-slate-700 shadow-sm transition active:scale-95"
        >
          <MdClose />
        </button>
      </header>

      {preview.cards.length > 1 ? (
        <div className="flex shrink-0 gap-2 overflow-x-auto border-b border-amber-900/10 bg-[#fff7df]/80 px-4 py-3 dark:border-white/10 dark:bg-[#0b2523]/80">
          {preview.cards.map((card, index) => {
            const isSelected = index === preview.currentIndex;

            return (
              <button
                key={card.fileName}
                type="button"
                onClick={() => onSelectCard(index)}
                className={`h-9 shrink-0 rounded-full px-4 text-xs font-black transition active:scale-95 ${
                  isSelected
                    ? "bg-brand-600 text-white shadow-sm"
                    : "border border-brand-100 bg-white text-brand-700"
                }`}
              >
                {card.label}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="shrink-0">
        <RoutePosterThemePicker value={preview.themeId} disabled={isGenerating} onChange={onSelectTheme} />
      </div>

      <div className="shrink-0 border-b border-amber-900/10 bg-[#fff7df]/80 px-4 py-3 dark:border-white/10 dark:bg-[#0b2523]/80">
        <p className="mb-2 text-xs font-black text-slate-600">
          {text.routeHistory.backgroundTitle}
        </p>
        <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-0.5">
          {ROUTE_COMPLETION_POSTER_BACKGROUNDS.map((background) => {
            const isSelected = preview.backgroundId === background.id;

            return (
              <button
                key={background.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onSelectBackground(background.id)}
                disabled={isGenerating}
                className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-full border-2 py-0.5 pl-0.5 pr-3 text-xs font-black transition active:scale-95 ${
                  isSelected
                    ? "border-brand-600 bg-brand-600 text-white dark:border-brand-300"
                    : "border-brand-100 bg-white text-brand-700"
                }`}
              >
                <span
                  className="size-9 shrink-0 rounded-full border border-black/10 shadow-inner"
                  style={{ background: background.preview }}
                />
                {backgroundLabels[background.id]}
              </button>
            );
          })}
          <button
            type="button"
            aria-pressed={preview.backgroundId === "custom"}
            onClick={() => void handleChooseAlbumBackground()}
            disabled={isGenerating}
            className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-full border-2 py-0.5 pl-0.5 pr-3 text-xs font-black transition active:scale-95 ${
              preview.backgroundId === "custom"
                ? "border-brand-600 bg-brand-600 text-white dark:border-brand-300"
                : "border-brand-100 bg-white text-brand-700"
            }`}
          >
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-full border border-black/10 bg-cover bg-center text-lg shadow-inner"
              style={
                preview.customBackgroundDataUrl
                  ? {
                      backgroundImage: `url(${preview.customBackgroundDataUrl})`,
                    }
                  : undefined
              }
            >
              {preview.customBackgroundDataUrl ? null : <MdPhotoLibrary />}
            </span>
            {text.routeHistory.backgroundAlbum}
          </button>
        </div>
        <input
          ref={backgroundFileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleBackgroundFileChange}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="relative mx-auto flex max-w-[440px] justify-center" aria-busy={isGenerating}>
          <img
            src={currentCard.dataUrl}
            alt={text.routeHistory.posterAlt(currentCard.label)}
            className="h-auto w-full rounded-[18px] border border-amber-950/15 bg-white shadow-[0_20px_48px_rgba(84,52,10,0.25)] dark:border-white/15 dark:shadow-[0_20px_48px_rgba(0,0,0,0.42)]"
          />
          {isGenerating ? (
            <div className="absolute inset-0 flex items-center justify-center rounded-[18px] bg-white/65 dark:bg-slate-950/65" role="status">
              <span className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-brand-700 shadow-sm dark:bg-slate-900 dark:text-brand-200">
                <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                {text.routeHistory.applyingStyle}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      <footer className="flex shrink-0 gap-2 border-t border-amber-900/10 bg-[#fff7df]/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 dark:border-white/10 dark:bg-[#0b2523]/95">
        <button
          type="button"
          onClick={onShare}
          disabled={isGenerating}
          className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full border border-brand-200 bg-white text-sm font-black text-brand-700 shadow-sm transition active:scale-95"
        >
          <MdShare className="text-lg" />
          {text.routeHistory.share}
        </button>
        <button
          type="button"
          onClick={onDownload}
          disabled={isGenerating}
          className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-brand-600 text-sm font-black text-white shadow-sm transition active:scale-95"
        >
          <MdDownload className="text-lg" />
          {text.routeHistory.save}
        </button>
      </footer>
    </div>,
    document.body
  );
}

export function RoutePosterGeneratingModal() {
  const text = useUiText();

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-live="polite"
      className="fixed inset-0 z-[3300] flex items-center justify-center bg-slate-950/35 px-4 backdrop-blur-[2px]"
    >
      <PotatoLoadingCard
        title={text.routeHistory.generatingTitle}
        description={text.routeHistory.generatingDescription}
        footerText={text.routeHistory.generatingFooter}
        animation="map-rendering"
      />
    </div>,
    document.body
  );
}
