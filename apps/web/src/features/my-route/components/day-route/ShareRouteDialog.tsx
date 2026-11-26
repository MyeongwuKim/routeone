/** 완료한 루트의 DAY별 공개 출발지를 확인하고, 변경값은 공유 요청에만 전달한다. */
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import StartLocationPickerPopup from "@/features/route-checkout/components/cart-steps/StartLocationPickerPopup";
import type { RouteStartLocation } from "@/features/route-checkout/models/routePlanTypes";
import type { ShareRouteStartLocationInput } from "@/generated/graphql";
import { useUiText } from "@/lib/uiText";
import { useEffectiveServiceArea } from "@/stores/serviceAreaStore";
import { createPlannedRouteDay } from "../../adapters/dayRouteAdapters";
import type { MyRoute, MyRouteDay } from "../../types";
import { getDayRouteStartLocation } from "../../utils/dayRouteStartLocation";

type ShareRouteDialogProps = {
  route: MyRoute;
  days: MyRouteDay[];
  onClose: () => void;
  onShare: (locations: ShareRouteStartLocationInput[]) => Promise<boolean>;
};

export default function ShareRouteDialog({ route, days, onClose, onShare }: ShareRouteDialogProps) {
  const text = useUiText();
  const serviceArea = useEffectiveServiceArea();
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const confirmationRef = useRef<HTMLElement>(null);
  const submittingRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitFailed, setSubmitFailed] = useState(false);
  // 마운트 시점의 좌표로 확인을 시작한다. 지도에서 고른 값은 이 창에만 남는다.
  const [locations, setLocations] = useState<ShareRouteStartLocationInput[]>(() =>
    days.length
      ? days.map((day) => ({ dayId: day.id, startLocation: getDayRouteStartLocation(day, route.startLocation) }))
      : [{ dayId: null, startLocation: route.startLocation }]
  );
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);
  const pickerLocation = pickerIndex === null ? null : locations[pickerIndex];
  const pickerDay = days.find((day) => day.id === pickerLocation?.dayId);
  const pickerPlan = pickerDay ? [createPlannedRouteDay(pickerDay, pickerDay.stops)] : [];
  const pickerInitialLocation = pickerLocation?.startLocation ??
    pickerDay?.stops[0]?.place ?? route.stops[0]?.place ?? serviceArea.center;

  useEffect(() => {
    const dialog = dialogRef.current;
    const trigger = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);

  const close = () => {
    if (!submittingRef.current) onClose();
  };

  const closePicker = () => {
    setPickerIndex(null);
    requestAnimationFrame(() => confirmationRef.current?.querySelectorAll<HTMLButtonElement>("[data-edit-start]")[pickerIndex ?? 0]?.focus());
  };

  const applyLocation = ({ lat, lng }: RouteStartLocation) => {
    if (pickerIndex === null) return false;
    setLocations((current) => current.map((location, index) =>
      index === pickerIndex ? { ...location, startLocation: { lat, lng } } : location
    ));
    return true;
  };

  const confirm = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    setSubmitFailed(false);
    try {
      if (await onShare(locations)) onClose();
      else setSubmitFailed(true);
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-labelledby={pickerLocation ? undefined : titleId}
      aria-label={pickerLocation ? text.dayRoute.editSharedStartLocation : undefined}
      aria-describedby={pickerLocation ? undefined : descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        if (pickerLocation) closePicker();
        else close();
      }}
      className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none overflow-hidden bg-transparent p-0 backdrop:bg-slate-950/50"
    >
      {pickerLocation ? (
        <StartLocationPickerPopup
          title={text.dayRoute.editSharedStartLocation}
          initialLocation={pickerInitialLocation}
          routePlan={pickerPlan}
          onClose={closePicker}
          onApply={applyLocation}
        />
      ) : (
        <div className="flex h-full items-end justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:items-center sm:p-4">
          <section ref={confirmationRef} className="flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-3xl border border-brand-100 bg-white text-slate-900 shadow-2xl dark:border-brand-400/25 dark:bg-slate-900 dark:text-slate-100">
            <header className="space-y-2 px-5 pt-5">
              <h2 id={titleId} className="text-lg font-black">{text.dayRoute.shareConfirmTitle}</h2>
              <p id={descriptionId} className="text-sm font-bold text-brand-800 dark:text-brand-200">{text.dayRoute.sharedStartLocationNotice}</p>
            </header>
            <div className="min-h-0 space-y-3 overflow-y-auto px-5 py-4">
              <ul className="space-y-2">
                {locations.map(({ dayId, startLocation }, index) => {
                  const day = days.find((candidate) => candidate.id === dayId);
                  const label = day ? text.cart.dayStartLocationTitle(day.dayIndex) : text.dayRoute.sharedStartLocation;
                  return (
                    <li key={dayId ?? route.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-brand-100 px-3 py-2 dark:border-brand-400/25">
                      <div className="min-w-0">
                        <p className="text-sm font-bold">{label}</p>
                        <p className="break-all text-xs text-slate-600 dark:text-slate-300">
                          {startLocation ? `${startLocation.lat}, ${startLocation.lng}` : text.dayRoute.noSharedStartLocation}
                        </p>
                      </div>
                      <button
                        type="button"
                        data-edit-start
                        aria-label={`${text.dayRoute.editSharedStartLocation} · ${label}`}
                        onClick={() => setPickerIndex(index)}
                        disabled={isSubmitting}
                        className="min-h-11 shrink-0 rounded-xl bg-brand-50 px-3 text-sm font-bold text-brand-800 disabled:opacity-50 dark:bg-brand-900/60 dark:text-brand-200"
                      >
                        {text.dayRoute.editSharedStartLocation}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">{text.dayRoute.shareConfirmDetails}</p>
              {submitFailed ? <p role="alert" className="text-sm font-semibold text-red-700 dark:text-red-300">{text.dayRoute.shareConfirmFailed}</p> : null}
            </div>
            <footer className="grid shrink-0 grid-cols-2 gap-2 border-t border-brand-100 p-4 dark:border-brand-400/25">
              <button type="button" disabled={isSubmitting} onClick={close} className="min-h-11 rounded-xl border border-slate-200 px-2 text-sm font-bold disabled:opacity-50 dark:border-slate-600">{text.common.cancel}</button>
              <button type="button" disabled={isSubmitting} onClick={() => void confirm()} className="min-h-11 rounded-xl bg-brand-600 px-2 text-sm font-bold text-white disabled:opacity-50">{isSubmitting ? text.dayRoute.sharing : text.dayRoute.shareConfirmAction}</button>
            </footer>
          </section>
        </div>
      )}
    </dialog>,
    document.body
  );
}
