import { useEffect, useState } from "react";
import { MdTranslate } from "react-icons/md";
import { UI_LAYER_CLASS } from "@/lib/uiLayers";
import { useUiText } from "@/lib/uiText";
import { useAppLanguageStore } from "@/stores/appLanguageStore";
import { usePlaceLocalizationLoadingStore } from "@/stores/placeLocalizationLoadingStore";
import { useUiLoadingStore } from "@/stores/uiLoadingStore";

const STATUS_DISPLAY_DELAY_MS = 250;

function PlaceLocalizationStatus() {
  const text = useUiText();
  const appLanguage = useAppLanguageStore((state) => state.language);
  const isLocalizing = usePlaceLocalizationLoadingStore(
    (state) => state.activeRequestCount > 0
  );
  const isBlockingLoadingOpen = useUiLoadingStore((state) => state.isOpen);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const shouldShow =
      appLanguage === "en" && isLocalizing && !isBlockingLoadingOpen;

    const timerId = window.setTimeout(() => {
      setIsVisible(shouldShow);
    }, shouldShow ? STATUS_DISPLAY_DELAY_MS : 0);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [appLanguage, isBlockingLoadingOpen, isLocalizing]);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-none fixed inset-x-0 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.25rem)] ${UI_LAYER_CLASS.toast} flex justify-center px-4`}
    >
      <div className="flex items-center gap-2 rounded-full border border-brand-200 bg-white/95 px-3.5 py-2 text-xs font-bold text-brand-800 shadow-lg backdrop-blur dark:border-brand-400/30 dark:bg-[#0b211f]/95 dark:text-brand-100">
        <span className="relative flex size-5 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-brand-300/35" />
          <MdTranslate className="relative text-base" />
        </span>
        <span>{text.common.placeLocalizationLoading}</span>
      </div>
    </div>
  );
}

export default PlaceLocalizationStatus;
