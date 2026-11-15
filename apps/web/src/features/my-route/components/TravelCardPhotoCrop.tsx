import { useRef, useState, type PointerEvent } from "react";
import { MdCrop, MdFitScreen } from "react-icons/md";
import type { TravelCardPhoto } from "../models/travelCard";
import { resolveRoutePosterPhotoSource } from "../routeCompletionPoster";
import type { TravelCardFrame } from "../services/travelCardRenderer";
import type { getTravelCardText } from "../travelCardText";
import { getTravelCardPhotoLayout, MAX_TRAVEL_CARD_PHOTO_ZOOM, TRAVEL_CARD_PHOTO_BACKGROUND } from "../utils/travelCardPhotoLayout";

type Crop = Pick<TravelCardPhoto, "focal" | "zoom">;
type Point = { x: number; y: number };
type Gesture = {
  points: Map<number, Point>;
  bounds: { left: number; top: number; width: number; height: number };
  layout: ReturnType<typeof getTravelCardPhotoLayout>;
  crop: Crop;
  lastCrop: Crop;
};
type Props = {
  photo: TravelCardPhoto;
  frame: TravelCardFrame;
  disabled: boolean;
  text: ReturnType<typeof getTravelCardText>;
  onChange: (crop: Crop) => void;
};
const rangeClass = "min-w-0 flex-1 accent-brand-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-600 dark:accent-brand-300";
const buttonClass = "inline-flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 text-xs font-bold text-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-40 dark:text-brand-100";

/**
 * 사진 한 장의 이동·핀치·슬라이더 조작을 맡고 위치와 배율은 상위 편집본에만 보관한다.
 * 여기서는 이미지 원본 크기와 제스처 시작 좌표만 가지며, 사진이 바뀌면 key로 조작을 정리한다.
 */
export default function TravelCardPhotoCrop({ photo, frame, disabled, text, onChange }: Props) {
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<Gesture | null>(null);
  const layout = naturalSize ? getTravelCardPhotoLayout(naturalSize, frame, photo) : null;
  const blocked = disabled || !layout;

  /** 입력을 허용 범위로 맞춰 상위 편집본에 반영한다. 손가락 좌표는 편집 상태로 복제하지 않는다. */
  function update(crop: Crop) {
    if (blocked || !naturalSize) return;
    const next = getTravelCardPhotoLayout(naturalSize, frame, crop);
    const normalized = { zoom: next.zoom, focal: { x: Math.max(0, Math.min(1, crop.focal.x)), y: Math.max(0, Math.min(1, crop.focal.y)) } };
    if (gesture.current) gesture.current.lastCrop = normalized;
    onChange(normalized);
  }

  function beginGesture(element: HTMLDivElement, crop: Crop) {
    if (!naturalSize) return;
    const bounds = element.getBoundingClientRect();
    gesture.current = { points: new Map(pointers.current), bounds, crop, lastCrop: crop, layout: getTravelCardPhotoLayout(naturalSize, bounds, crop) };
  }

  function startPointer(event: PointerEvent<HTMLDivElement>) {
    if (blocked || (event.pointerType === "mouse" && event.button !== 0) || pointers.current.size >= 2) return;
    event.preventDefault();
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    beginGesture(event.currentTarget, gesture.current?.lastCrop ?? photo);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  /** 두 손가락 중점의 이미지 위치를 기준으로 확대·축소하고 한 손가락으로는 같은 사각형을 이동한다. */
  function movePointer(event: PointerEvent<HTMLDivElement>) {
    const start = gesture.current;
    if (blocked || !start || !naturalSize || !pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const initial = [...start.points.values()];
    const current = [...pointers.current.values()];
    const midpoint = (points: Point[]) => points.length === 1 ? points[0] : { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
    const from = midpoint(initial);
    const to = midpoint(current);
    const distance = (points: Point[]) => Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
    const zoom = initial.length === 2 && current.length === 2 && distance(initial) > 2 ? start.layout.zoom * distance(current) / distance(initial) : start.layout.zoom;
    const next = getTravelCardPhotoLayout(naturalSize, start.bounds, { ...start.crop, zoom });
    const anchorX = (from.x - start.bounds.left - start.layout.x) / start.layout.width;
    const anchorY = (from.y - start.bounds.top - start.layout.y) / start.layout.height;
    const x = to.x - start.bounds.left - anchorX * next.width;
    const y = to.y - start.bounds.top - anchorY * next.height;
    update({ zoom: next.zoom, focal: {
      x: Math.abs(start.bounds.width - next.width) > 0.5 ? x / (start.bounds.width - next.width) : start.crop.focal.x,
      y: Math.abs(start.bounds.height - next.height) > 0.5 ? y / (start.bounds.height - next.height) : start.crop.focal.y,
    } });
  }

  // 두 손가락에서 하나가 남으면 현재 구도를 이동 기준으로 삼고, 취소·캡처 상실도 같은 경로로 정리한다.
  function endPointer(event: PointerEvent<HTMLDivElement>) {
    if (!pointers.current.delete(event.pointerId)) return;
    if (pointers.current.size) beginGesture(event.currentTarget, gesture.current?.lastCrop ?? photo);
    else gesture.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  return <div className="space-y-3">
    <div className="flex items-center justify-between gap-2">
      <h4 className="text-sm font-bold">{text.position}</h4>
      <button type="button" className={buttonClass} disabled={blocked} onClick={() => update({ zoom: layout?.zoom, focal: { x: 0.5, y: 0.5 } })}>{text.reset}</button>
    </div>
    <div className="relative mx-auto overflow-hidden rounded-xl" data-travel-card-crop="" style={{ aspectRatio: `${frame.width}/${frame.height}`, width: "100%", maxWidth: Math.min(400, 240 * frame.width / frame.height), background: TRAVEL_CARD_PHOTO_BACKGROUND, touchAction: "none", cursor: blocked ? "default" : "grab" }}
      onPointerDown={startPointer} onPointerMove={movePointer} onPointerUp={endPointer} onPointerCancel={endPointer} onLostPointerCapture={endPointer}>
      <img src={resolveRoutePosterPhotoSource(photo.url)} draggable={false} alt={photo.label}
        onLoad={event => { const image = event.currentTarget; if (image.naturalWidth && image.naturalHeight) setNaturalSize({ width: image.naturalWidth, height: image.naturalHeight }); }}
        className="pointer-events-none absolute max-w-none select-none" style={layout ? { left: `${layout.x / frame.width * 100}%`, top: `${layout.y / frame.height * 100}%`, width: `${layout.width / frame.width * 100}%`, height: `${layout.height / frame.height * 100}%` } : { width: "100%", height: "100%", objectFit: "cover" }} />
    </div>
    <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">{text.positionHint}</p>
    <div className="grid grid-cols-2 gap-2">
      <button type="button" className={`${buttonClass} bg-brand-50 hover:bg-brand-100 dark:bg-white/5 dark:hover:bg-white/10`} disabled={blocked} onClick={() => update({ zoom: layout?.minZoom, focal: { x: 0.5, y: 0.5 } })}><MdFitScreen aria-hidden="true" className="text-lg" />{text.fit}</button>
      <button type="button" className={`${buttonClass} bg-brand-50 hover:bg-brand-100 dark:bg-white/5 dark:hover:bg-white/10`} disabled={blocked} onClick={() => update({ zoom: 1, focal: { x: 0.5, y: 0.5 } })}><MdCrop aria-hidden="true" className="text-lg" />{text.fill}</button>
    </div>
    <div className="grid gap-2">
      <label className="flex min-h-11 items-center gap-3 text-xs font-semibold">
        <span className="w-16 shrink-0">{text.zoom}</span>
        <input type="range" min={Math.round((layout?.minZoom ?? 1) * 100)} max={MAX_TRAVEL_CARD_PHOTO_ZOOM * 100} step={1} value={Math.round((layout?.zoom ?? 1) * 100)} disabled={blocked}
          aria-valuetext={`${Math.round((layout?.zoom ?? 1) * 100)}%`} onChange={event => update({ ...photo, zoom: Number(event.target.value) / 100 })} className={rangeClass} />
        <span aria-hidden="true" className="w-10 text-right font-medium tabular-nums text-brand-800 dark:text-brand-100">{Math.round((layout?.zoom ?? 1) * 100)}%</span>
      </label>
      {(["x", "y"] as const).map(axis => <label key={axis} className="flex min-h-11 items-center gap-3 text-xs font-semibold">
        <span className="w-16 shrink-0">{axis === "x" ? text.horizontal : text.vertical}</span>
        <input type="range" min={0} max={100} step={1} value={Math.round(photo.focal[axis] * 100)} disabled={blocked}
          onChange={event => update({ zoom: layout?.zoom, focal: { ...photo.focal, [axis]: Number(event.target.value) / 100 } })} className={rangeClass} />
      </label>)}
    </div>
  </div>;
}
