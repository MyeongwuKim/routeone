import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { MdAutorenew, MdClose, MdDownload, MdImageNotSupported, MdPhotoLibrary, MdShare } from "react-icons/md";
import type { useTravelCardEditor } from "../hooks/useTravelCardEditor";
import { getTravelCardPhotoFrames } from "../services/travelCardRenderer";
import type { MyRoute } from "../types";
import TravelCardPhotoEditor from "./TravelCardPhotoEditor";

type Props = { controller: ReturnType<typeof useTravelCardEditor>; onOpenDayCards?: (route: MyRoute) => void };

/** 완성 카드와 같은 비율과 사진 배치를 사용해 준비 중에도 미리보기 위치를 유지한다. */
function TravelCardPreviewLoading({ label, photoCount = 4 }: { label: string; photoCount?: number }) {
  return (
    <>
      <div aria-hidden="true" className="absolute inset-0">
        {getTravelCardPhotoFrames(photoCount).map(({ x, y, width, height }, index) => (
          <div
            key={x + ":" + y}
            className={`rounded-[5px] bg-[#e4ebe0] dark:bg-[#304b41] ${index === 0 ? "skeleton-shimmer" : ""}`}
            style={{
              left: `${x / 1080 * 100}%`, top: `${y / 1350 * 100}%`,
              width: `${width / 1080 * 100}%`, height: `${height / 1350 * 100}%`,
              position: "absolute",
            }}
          />
        ))}
      </div>
      <p role="status" className="absolute inset-x-[5%] top-[77%] text-sm font-semibold text-[#315449] dark:text-brand-100">
        {label}
      </p>
    </>
  );
}

/** 다녀온 루트의 대표 카드를 편집·확인하는 전용 화면이다. 세션이 닫히거나 계정이 바뀌면 즉시 제거한다. */
export default function TravelCardEditor(props: Props) {
  if (!props.controller.session) return null;
  return <TravelCardEditorDialog key={props.controller.session.id} {...props} />;
}

function TravelCardEditorDialog({ controller, onOpenDayCards }: Props) {
  const { session, draft, image, text, close, edit, setTitle, open, retry, exportImage, renderError, isPicking, isRendering, exporting } = controller;
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const errorTitleId = useId();
  const errorCaptionId = useId();

  // 기본 dialog의 포커스 제한을 사용하고, 닫을 때 원래 스크롤·진입 버튼의 포커스를 복원한다.
  useEffect(() => {
    const trigger = document.activeElement;
    const element = dialog.current;
    const scrollY = window.scrollY;
    const rootOverflow = document.documentElement.style.overflow;
    const bodyStyle = { overflow: document.body.style.overflow, position: document.body.style.position, top: document.body.style.top, width: document.body.style.width };
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `${-scrollY}px`;
    document.body.style.width = "100%";
    element?.showModal();
    window.addEventListener("popstate", close);
    return () => {
      element?.close();
      document.documentElement.style.overflow = rootOverflow;
      Object.assign(document.body.style, bodyStyle);
      window.scrollTo(0, scrollY);
      window.removeEventListener("popstate", close);
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [close]);

  if (!session) return null;
  const titleError = image?.errors.title === "empty" ? text.titleEmpty : image?.errors.title === "long" ? text.titleLong : null;
  const captionError = image?.errors.caption ? text.captionLong : null;
  const canExport = Boolean(image?.dataUrl && !renderError && !isPicking && !exporting);
  const showPreviewLoading = !session.loadError && (!draft || (isRendering && draft.photos.length > 0));
  const buttonClass = "inline-flex min-h-12 min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 text-sm font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-45";

  return createPortal(<dialog ref={dialog} aria-labelledby={titleId} aria-modal="true" onCancel={event => { event.preventDefault(); close(); }}
    className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none overflow-hidden bg-[#f7f9f5] p-0 text-slate-900 dark:bg-[#0a211c] dark:text-slate-100 backdrop:bg-slate-950/40">
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-brand-100 bg-white px-5 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] dark:border-white/10 dark:bg-[#102a25]">
        <h2 id={titleId} className="text-lg font-bold">{text.title}</h2>
        <div className="flex min-w-0 items-center gap-3">
          {draft ? <button type="button" className="min-h-11 whitespace-nowrap rounded-xl px-2 text-sm font-bold text-brand-800 focus-visible:outline-2 focus-visible:outline-brand-600 dark:text-brand-100" onClick={() => {
            const heading = dialog.current?.querySelector<HTMLElement>("#travel-card-photos-label");
            heading?.focus({ preventScroll: true });
            heading?.scrollIntoView({ block: "start" });
          }}>{text.editPhotos}</button> : null}
          <button type="button" onClick={close} aria-label={text.close} className="-mr-2 flex size-11 shrink-0 items-center justify-center rounded-full text-2xl text-brand-800 hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-brand-600 dark:text-brand-100 dark:hover:bg-white/10"><MdClose aria-hidden="true" /></button>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable] [-webkit-overflow-scrolling:touch]">
        <div className="mx-auto grid max-w-5xl gap-7 px-5 py-6 md:grid-cols-2 md:gap-12 md:px-8 md:py-8">
          <div className="min-w-0 md:sticky md:top-8 md:self-start">
            <div className={`relative mx-auto aspect-[4/5] w-full max-w-[360px] overflow-hidden rounded-xl bg-[#fffcf5] shadow-[0_12px_32px_rgba(18,62,53,0.13)] ${!image?.dataUrl ? "dark:bg-[#17332b]" : ""}`}>
              {image?.dataUrl ? (
                <img src={image.dataUrl} alt={text.preview} className="size-full object-contain" />
              ) : showPreviewLoading ? (
                <TravelCardPreviewLoading label={draft ? text.working : text.preparing} photoCount={draft?.photos.length} />
              ) : session.loadError ? (
                <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
                  <MdImageNotSupported aria-hidden="true" className="text-3xl text-brand-800 dark:text-brand-200" />
                  <p role="alert" className="text-sm font-bold">{text.loadError}</p>
                  <button type="button" className={`${buttonClass} flex-none bg-brand-700 text-white hover:bg-brand-800`} onClick={() => void open(session.route)}>{text.retry}</button>
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-[#46625a] dark:text-brand-100">
                  <MdPhotoLibrary aria-hidden="true" className="text-4xl" />
                  <p className="text-sm font-bold">{titleError ?? captionError ?? (renderError ? text.renderError : text.noPhotos)}</p>
                  {draft?.photos.length === 0 ? <p className="text-xs leading-relaxed">{text.noPhotosHint}</p> : null}
                </div>
              )}
            </div>
            {renderError || image?.errors.photos === "failed" || image?.missingPhotoIds.length ? <div className="mx-auto mt-4 max-w-[360px] text-sm text-rose-700 dark:text-rose-200" role="alert">
              <p>{renderError ? text.renderError : text.missing}</p>
              <button type="button" onClick={retry} className="mt-1 min-h-11 font-bold underline underline-offset-4">{text.retry}</button>
            </div> : null}
            {draft?.photos.length === 0 && onOpenDayCards ? <button type="button" className="mx-auto mt-3 block min-h-11 text-sm font-bold text-brand-800 underline underline-offset-4 dark:text-brand-100" onClick={() => { close(); onOpenDayCards(session.route); }}>{text.dayCards}</button> : null}
          </div>

          {draft ? <div className="min-w-0 space-y-7 pb-2">
            <div className="space-y-4">
              <label className="block text-sm font-bold" htmlFor={`${titleId}-input`}>{text.titleLabel}</label>
              <input id={`${titleId}-input`} type="text" value={draft.title} disabled={Boolean(exporting)} aria-invalid={Boolean(titleError)} aria-describedby={titleError ? errorTitleId : undefined}
                onChange={event => setTitle(event.target.value)}
                className="-mt-2 min-h-12 w-full min-w-0 rounded-xl border border-brand-200 bg-white px-3.5 text-base caret-brand-700 outline-none selection:bg-brand-100 focus:border-brand-600 focus:ring-2 focus:ring-brand-100 dark:border-brand-400/30 dark:bg-[#102a25] dark:focus:ring-brand-400/20" />
              {titleError ? <p id={errorTitleId} role="alert" className="text-xs font-semibold text-rose-700 dark:text-rose-200">{titleError}</p> : null}
              <label className="block text-sm font-bold" htmlFor={`${titleId}-caption`}>{text.captionLabel} <span className="ml-1 text-xs font-normal text-slate-500 dark:text-slate-300">{text.optional}</span></label>
              <input id={`${titleId}-caption`} type="text" value={draft.caption} placeholder={text.captionPlaceholder} disabled={Boolean(exporting)} aria-invalid={Boolean(captionError)} aria-describedby={captionError ? errorCaptionId : undefined}
                onChange={event => edit(current => ({ ...current, caption: event.target.value }))}
                className="-mt-2 min-h-12 w-full min-w-0 rounded-xl border border-brand-200 bg-white px-3.5 text-base caret-brand-700 outline-none placeholder:text-slate-500 focus:border-brand-600 focus:ring-2 focus:ring-brand-100 dark:border-brand-400/30 dark:bg-[#102a25] dark:placeholder:text-slate-400 dark:focus:ring-brand-400/20" />
              {captionError ? <p id={errorCaptionId} role="alert" className="text-xs font-semibold text-rose-700 dark:text-rose-200">{captionError}</p> : null}
            </div>
            <TravelCardPhotoEditor controller={controller} />
          </div> : !session.loadError ? (
            <div aria-hidden="true" className="hidden min-w-0 space-y-5 md:block">
              <div className="space-y-2">
                <div className="h-3 w-20 rounded-full bg-brand-100 dark:bg-white/10" />
                <div className="h-12 rounded-xl bg-brand-100/60 dark:bg-white/5" />
              </div>
              <div className="space-y-2">
                <div className="h-3 w-24 rounded-full bg-brand-100 dark:bg-white/10" />
                <div className="h-12 rounded-xl bg-brand-100/60 dark:bg-white/5" />
              </div>
            </div>
          ) : null}
        </div>
      </main>

      <footer className="shrink-0 border-t border-brand-100 bg-white px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 dark:border-white/10 dark:bg-[#102a25]">
        <p className="sr-only" role="status">{isPicking ? text.loadingPhoto : exporting ? text.working : ""}</p>
        <div className="mx-auto flex max-w-lg gap-3">
          <button type="button" disabled={!canExport} onClick={() => void exportImage("save")} className={`${buttonClass} border border-brand-200 text-brand-800 hover:bg-brand-50 dark:border-brand-400/30 dark:text-brand-100 dark:hover:bg-white/5`}>
            {exporting === "save" ? <MdAutorenew aria-hidden="true" className="animate-spin text-xl motion-reduce:animate-none" /> : <MdDownload aria-hidden="true" className="text-xl" />}{text.save}
          </button>
          <button type="button" disabled={!canExport} onClick={() => void exportImage("share")} className={`${buttonClass} bg-brand-700 text-white hover:bg-brand-800 dark:bg-brand-600 dark:hover:bg-brand-700`}>
            {exporting === "share" ? <MdAutorenew aria-hidden="true" className="animate-spin text-xl motion-reduce:animate-none" /> : <MdShare aria-hidden="true" className="text-xl" />}{text.share}
          </button>
        </div>
      </footer>
    </div>
  </dialog>, document.body);
}
