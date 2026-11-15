import { useRef, useState } from "react";
import { MdArrowBack, MdArrowForward, MdDeleteOutline, MdPhotoLibrary } from "react-icons/md";
import type { useTravelCardEditor } from "../hooks/useTravelCardEditor";
import { getTravelCardPhotoFrames } from "../services/travelCardRenderer";
import { resolveRoutePosterPhotoSource } from "../routeCompletionPoster";
import TravelCardPhotoCrop from "./TravelCardPhotoCrop";

type PhotoController = Pick<ReturnType<typeof useTravelCardEditor>, "session" | "draft" | "image" | "text" | "edit" | "selectPhoto" | "pickAlbum" | "readAlbum" | "isPicking" | "exporting" | "retry">;
const actionClass = "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-bold text-brand-800 transition hover:bg-brand-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-40 dark:text-brand-100 dark:hover:bg-white/10";

/** 선택 사진의 순서·대표·앨범 선택을 담당하고 구도 조작은 사진별 편집기에 맡긴다. 실제 편집본은 상위 세션에만 둔다. */
export default function TravelCardPhotoEditor({ controller }: { controller: PhotoController }) {
  const { session, draft, image, text, edit, selectPhoto, pickAlbum, readAlbum, isPicking, exporting, retry } = controller;
  const [activeId, setActiveId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const replacementId = useRef<string | undefined>(undefined);
  if (!draft) return null;
  const activeIndex = Math.max(0, draft.photos.findIndex(photo => photo.id === activeId));
  const active = draft.photos[activeIndex];
  const busy = isPicking || Boolean(exporting);
  const selectedIds = new Set(draft.photos.map(photo => photo.id));
  const failedIds = new Set([...(session?.initialMissingPhotoIds ?? []), ...(image?.missingPhotoIds ?? [])]);
  // 최근 생성에 성공한 사진은 초기 조회 실패 목록에 있어도 정상적으로 선택·표시한다.
  image?.photoIds.forEach(id => failedIds.delete(id));
  const renderedHeroId = image?.photoIds[0] ?? draft.photos[0]?.id;
  const frameIds = image?.photoIds.length ? image.photoIds : draft.photos.map(photo => photo.id);
  const frame = getTravelCardPhotoFrames(frameIds.length)[Math.max(0, frameIds.indexOf(active?.id))];

  function chooseAlbum(replaceId?: string) {
    replacementId.current = replaceId;
    if (!pickAlbum(replaceId)) fileInput.current?.click();
  }

  function movePhoto(offset: number) {
    const target = activeIndex + offset;
    if (target < 0 || target >= draft!.photos.length || !active) return;
    setActiveId(active.id);
    edit(current => {
      const photos = [...current.photos];
      const index = photos.findIndex(photo => photo.id === active.id);
      if (index < 0) return current;
      [photos[index], photos[index + offset]] = [photos[index + offset], photos[index]];
      return { ...current, photos };
    });
  }

  return <section className="space-y-4" aria-labelledby="travel-card-photos-label">
    <div>
      <h3 id="travel-card-photos-label" tabIndex={-1} className="text-base font-bold">{text.photos} <span className="ml-1 text-sm font-medium text-brand-700 dark:text-brand-200">{draft.photos.length}/4</span></h3>
      <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{text.photosHint}</p>
    </div>

    <div className="grid grid-cols-4 gap-2">
      {draft.photos.map((photo, index) => <button key={photo.id} type="button" onClick={() => setActiveId(photo.id)} disabled={busy}
        aria-label={`${failedIds.has(photo.id) ? text.unavailable : photo.id === renderedHeroId ? text.hero : `${text.photo} ${index + 1}`}: ${photo.label}`} aria-pressed={active?.id === photo.id}
        className={`relative aspect-square min-w-0 overflow-hidden rounded-xl bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${active?.id === photo.id ? "ring-2 ring-brand-600 ring-offset-2 dark:ring-brand-300 dark:ring-offset-[#102a25]" : "opacity-80"}`}>
        {failedIds.has(photo.id) ? <MdPhotoLibrary aria-hidden="true" className="mx-auto text-2xl text-brand-700" /> : <img src={resolveRoutePosterPhotoSource(photo.url)} alt="" className="size-full object-cover" style={{ objectPosition: `${photo.focal.x * 100}% ${photo.focal.y * 100}%` }} />}
        <span className="absolute bottom-1 left-1 rounded-md bg-[#123e35] px-1.5 py-0.5 text-[10px] font-bold text-white">{failedIds.has(photo.id) ? text.unavailable : photo.id === renderedHeroId ? text.hero : index + 1}</span>
      </button>)}
      {draft.photos.length < 4 ? <button type="button" onClick={() => chooseAlbum()} disabled={busy}
        className="flex aspect-square min-w-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-brand-300 bg-brand-50 px-1 text-xs font-bold text-brand-800 focus-visible:outline-2 focus-visible:outline-brand-600 disabled:opacity-40 dark:border-brand-400/40 dark:bg-white/5 dark:text-brand-100" aria-label={text.album}>
        <MdPhotoLibrary aria-hidden="true" className="text-2xl" /><span>{text.album}</span>
      </button> : null}
    </div>

    {active ? <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1">
        <button type="button" className={actionClass} disabled={busy || activeIndex === 0} onClick={() => movePhoto(-1)} aria-label={text.previous}><MdArrowBack aria-hidden="true" /><span>{text.previous}</span></button>
        <button type="button" className={actionClass} disabled={busy || activeIndex === draft.photos.length - 1} onClick={() => movePhoto(1)} aria-label={text.next}><MdArrowForward aria-hidden="true" /><span>{text.next}</span></button>
        <button type="button" className={`${actionClass} ml-auto`} disabled={busy} onClick={() => edit(current => ({ ...current, photos: current.photos.filter(photo => photo.id !== active.id) }))} aria-label={text.remove}><MdDeleteOutline aria-hidden="true" /></button>
      </div>
      {frame && !failedIds.has(active.id) ? <TravelCardPhotoCrop key={active.id} photo={active} frame={frame} disabled={busy} text={text}
        onChange={crop => edit(current => ({ ...current, photos: current.photos.map(photo => photo.id === active.id ? { ...photo, ...crop } : photo) }))} /> : null}
      <button type="button" disabled={busy} className={`${actionClass} w-full bg-brand-50 dark:bg-white/5`} onClick={() => chooseAlbum(active.id)}><MdPhotoLibrary aria-hidden="true" />{text.replace}</button>
    </div> : null}

    {draft.candidates.length ? <div className="border-t border-brand-100 pt-5 dark:border-white/10">
      <h4 className="mb-3 text-sm font-bold">{text.existing}</h4>
      {session?.initialMissingPhotoIds.some(id => failedIds.has(id)) ? <p className="mb-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{text.initialMissing}</p> : null}
      <div className="grid grid-cols-4 gap-2">
        {draft.candidates.map(photo => <button key={photo.id} type="button" disabled={busy || (selectedIds.has(photo.id) && !failedIds.has(photo.id))}
          onClick={() => selectedIds.has(photo.id) ? retry() : selectPhoto({ ...photo, focal: { x: 0.5, y: 0.5 } }, draft.photos.length >= 4 ? active?.id : undefined)}
          aria-label={`${photo.label}${failedIds.has(photo.id) ? ` · ${text.unavailable} · ${text.retry}` : selectedIds.has(photo.id) ? ` · ${text.selected}` : ""}`} aria-pressed={selectedIds.has(photo.id)}
          className="relative aspect-square overflow-hidden rounded-xl bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-45">
          {failedIds.has(photo.id) ? <MdPhotoLibrary aria-hidden="true" className="mx-auto text-2xl text-brand-700" /> : <img src={resolveRoutePosterPhotoSource(photo.url)} alt="" loading="lazy" className="size-full object-cover" />}
          {selectedIds.has(photo.id) || failedIds.has(photo.id) ? <span className="absolute inset-x-0 bottom-0 bg-[#123e35] py-1 text-[10px] font-bold text-white">{failedIds.has(photo.id) ? text.unavailable : text.selected}</span> : null}
        </button>)}
      </div>
    </div> : null}
    <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={event => {
      const file = event.currentTarget.files?.[0]; event.currentTarget.value = "";
      if (file) readAlbum(file, replacementId.current);
    }} />
  </section>;
}
