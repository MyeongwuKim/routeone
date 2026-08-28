import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { PotatoLoadingCard } from "@/components/feedback/PotatoLoadingOverlay";
import { UI_LAYER_CLASS } from "@/lib/uiLayers";
import { useUiText } from "@/lib/uiText";

type RouteCheckoutSavingOverlayProps = {
  returnFocusRef: RefObject<HTMLElement | null>;
};

function RouteCheckoutSavingOverlay({
  returnFocusRef,
}: RouteCheckoutSavingOverlayProps) {
  const text = useUiText();
  const overlayRef = useRef<HTMLDivElement>(null);
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setIsSlow(true), 10_000);
    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    const overlay = overlayRef.current;

    if (!overlay) {
      return;
    }

    const returnFocusTarget = returnFocusRef.current;

    const keepFocusOnOverlay = (event: FocusEvent) => {
      if (event.target instanceof Node && !overlay.contains(event.target)) {
        overlay.focus({ preventScroll: true });
      }
    };
    const blockKeyboardAction = (event: KeyboardEvent) => {
      if (["Tab", "Escape", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };

    overlay.focus({ preventScroll: true });
    document.addEventListener("focusin", keepFocusOnOverlay, true);
    window.addEventListener("keydown", blockKeyboardAction, true);

    return () => {
      document.removeEventListener("focusin", keepFocusOnOverlay, true);
      window.removeEventListener("keydown", blockKeyboardAction, true);

      if (returnFocusTarget?.isConnected && !returnFocusTarget.closest("[inert]")) {
        returnFocusTarget.focus({ preventScroll: true });
      }
    };
  }, [returnFocusRef]);

  return createPortal(
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label={text.cart.saving}
      tabIndex={-1}
      onClick={(event) => event.stopPropagation()}
      className={`fixed inset-0 ${UI_LAYER_CLASS.blockingOverlay} flex touch-none items-center justify-center bg-slate-950/45 px-4 outline-none`}
    >
      <div role="status" aria-live="polite" className="w-full max-w-sm">
        <PotatoLoadingCard
          title={text.cart.saving}
          description={isSlow ? text.cart.saveRouteSlowDescription : undefined}
          animation="running"
        />
      </div>
    </div>,
    document.body
  );
}

export default RouteCheckoutSavingOverlay;
