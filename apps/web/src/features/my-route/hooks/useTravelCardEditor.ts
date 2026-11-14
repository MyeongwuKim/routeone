import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { routeApi } from "@/api/routeApi";
import { nativeBridge } from "@/native-bridge";
import { useAppLanguageStore } from "@/stores/appLanguageStore";
import { useAuthUserStore } from "@/stores/authUserStore";
import { useUiToastStore } from "@/stores/uiToastStore";
import { createTravelCardDraft, type TravelCardDraft, type TravelCardPhoto } from "../models/travelCard";
import { downloadRouteCompletionPoster, shareRouteCompletionPoster } from "../routeCompletionPoster";
import { prepareTravelCardAlbumPhoto, prepareTravelCardDraft, renderTravelCard, type TravelCardImage } from "../services/travelCardRenderer";
import { getTravelCardText } from "../travelCardText";
import type { MyRoute } from "../types";

type EditorSession = {
  id: number; ownerId: string; route: MyRoute; draft: TravelCardDraft | null; loadError: boolean;
  /** 초기 자동 선택에서 실패한 후보. 현재 선택 사진의 로딩 결과와 구분해 후보에 다시 시도 표시를 한다. */
  initialMissingPhotoIds: string[];
  titleEdited: boolean;
};

/**
 * 여행 카드의 임시 편집본과 사진 선택·생성·내보내기를 소유한다. 서버에는 읽기 요청만 보낸다.
 * 세션 번호는 닫힌 편집기의 응답을, 생성 번호는 이전 편집본의 PNG를 무시하는 데 쓰며 작업 자체를 중단하지는 않는다.
 */
export function useTravelCardEditor() {
  const language = useAppLanguageStore(state => state.language);
  const ownerId = useAuthUserStore(state => state.user?.id ?? null);
  const showToast = useUiToastStore(state => state.showToast);
  const text = getTravelCardText(language);
  const [editor, setEditor] = useState<EditorSession | null>(null);
  const [rendered, setRendered] = useState<{ draft: TravelCardDraft; image: TravelCardImage; request: number } | null>(null);
  const [renderError, setRenderError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isPicking, setIsPicking] = useState(false);
  const [exporting, setExporting] = useState<"save" | "share" | null>(null);
  const sessionId = useRef(0);
  const generationId = useRef(0);
  const picking = useRef(false);
  const exportingRef = useRef(false);

  const session = editor?.ownerId === ownerId ? editor : null;
  // 언어가 바뀌면 날짜·지역만 다시 계산하고 사용자가 작성한 제목과 사진은 유지한다.
  const draft = useMemo(() => {
    if (!session?.draft) return null;
    const localized = createTravelCardDraft(session.route, language);
    return { ...session.draft, title: session.titleEdited ? session.draft.title : localized.title, dateLabel: localized.dateLabel, locationLabel: localized.locationLabel };
  }, [session, language]);
  const image = rendered?.draft === draft ? rendered.image : null;

  function isCurrent(id: number, owner: string) {
    return sessionId.current === id && useAuthUserStore.getState().user?.id === owner;
  }

  /** 닫힌 세션의 이미지·선택 결과를 무효로 하고 로컬 사진 참조도 해제한다. */
  const close = useCallback(() => {
    sessionId.current += 1;
    generationId.current += 1;
    picking.current = false;
    exportingRef.current = false;
    setEditor(null); setRendered(null); setRenderError(false); setIsPicking(false); setExporting(null);
  }, []);

  // 계정 변경 때 표시를 즉시 숨기고 구독에서 비동기 결과와 로컬 사진 참조도 정리한다.
  useEffect(() => useAuthUserStore.subscribe((state, previous) => {
    if (state.user?.id !== previous.user?.id) close();
  }), [close]);

  useEffect(() => () => {
    sessionId.current += 1;
    generationId.current += 1;
  }, []);

  /** 소유자의 최신 루트를 조회해 편집을 연다. 실패하면 다시 시도할 수 있는 화면을 유지한다. */
  async function open(route: MyRoute) {
    const owner = useAuthUserStore.getState().user?.id;
    if (!owner || route.isMine === false) return;
    const id = ++sessionId.current;
    generationId.current += 1;
    picking.current = false; exportingRef.current = false;
    setRendered(null); setRenderError(false); setIsPicking(false); setExporting(null);
    setEditor({ id, ownerId: owner, route, draft: null, loadError: false, initialMissingPhotoIds: [], titleEdited: false });
    try {
      const result = await routeApi.routeById(route.id);
      if (!isCurrent(id, owner)) return;
      if (!result.route || result.route.isMine === false) throw new Error("Route is not available.");
      const initial = createTravelCardDraft(result.route, useAppLanguageStore.getState().language);
      const prepared = await prepareTravelCardDraft(initial, () => isCurrent(id, owner));
      if (!isCurrent(id, owner)) return;
      setEditor({ id, ownerId: owner, route: result.route, draft: prepared.draft, loadError: false, initialMissingPhotoIds: prepared.missingPhotoIds, titleEdited: false });
    } catch {
      if (isCurrent(id, owner)) setEditor(current => current?.id === id ? { ...current, loadError: true } : current);
    }
  }

  // 연속 편집을 모아 생성한다. 닫기·다른 루트·새 입력 뒤에 도착한 PNG는 반영하지 않는다.
  useEffect(() => {
    if (!draft || !session) return;
    const request = ++generationId.current;
    const id = session.id;
    const owner = session.ownerId;
    const timer = window.setTimeout(() => {
      void renderTravelCard(draft).then(next => {
        if (generationId.current === request && isCurrent(id, owner)) {
          setRendered({ draft, image: next, request });
          setRenderError(false);
        }
      }).catch(() => {
        if (generationId.current === request && isCurrent(id, owner)) setRenderError(true);
      });
    }, 180);
    return () => { window.clearTimeout(timer); generationId.current += 1; };
  }, [draft, session, retryCount]);

  /** 편집본만 갱신하며 기존 생성 결과는 즉시 무효로 해 오래된 이미지를 내보내지 못하게 한다. */
  function edit(change: (current: TravelCardDraft) => TravelCardDraft, markTitleEdited = false) {
    if (!session || !isCurrent(session.id, session.ownerId) || exportingRef.current) return;
    generationId.current += 1;
    setRenderError(false);
    setEditor(current => {
      if (current?.id !== session.id || !current.draft) return current;
      const next = change(current.draft);
      return { ...current, draft: next, titleEdited: current.titleEdited || markTitleEdited };
    });
  }

  /** 제목 입력 이벤트를 직접 기록해 이전 기본값과 같은 문장도 사용자가 쓴 제목으로 유지한다. */
  function setTitle(title: string) { edit(current => ({ ...current, title }), true); }

  /** 입력값을 보존한 채 실패한 이미지·사진 로딩을 다시 시도한다. */
  function retry() { generationId.current += 1; setRendered(null); setRenderError(false); setRetryCount(count => count + 1); }

  /** 인증 사진을 추가하거나 지정한 사진과 교체한다. 이미 선택한 사진은 복제하지 않는다. */
  function selectPhoto(photo: TravelCardPhoto, replaceId?: string) {
    if (!replaceId && session?.draft && session.draft.photos.length >= 4) { showToast(text.limit); return; }
    edit(current => {
      if (current.photos.some(item => item.id === photo.id)) return current;
      if (replaceId) return { ...current, photos: current.photos.map(item => item.id === replaceId ? photo : item) };
      if (current.photos.length >= 4) return current;
      return { ...current, photos: [...current.photos, photo] };
    });
  }

  async function consumeAlbum(source: Promise<string | null>, replaceId?: string) {
    if (!session || picking.current || exportingRef.current) return;
    const { id, ownerId: owner } = session;
    picking.current = true; setIsPicking(true);
    try {
      const raw = await source;
      if (!raw || !isCurrent(id, owner)) return;
      const url = await prepareTravelCardAlbumPhoto(raw);
      if (!isCurrent(id, owner)) return;
      const photo: TravelCardPhoto = { id: `album-${crypto.randomUUID()}`, source: "album", label: text.albumPhoto, url, focal: { x: 0.5, y: 0.5 } };
      selectPhoto(photo, replaceId);
    } catch (error) {
      if (isCurrent(id, owner) && !/취소|cancel/i.test(error instanceof Error ? error.message : "")) showToast(text.pickError);
    } finally {
      if (isCurrent(id, owner)) { picking.current = false; setIsPicking(false); }
    }
  }

  /** 업로드 대상 없이 기존 네이티브 앨범 선택을 시작한다. 미지원 웹이면 false를 반환한다. */
  function pickAlbum(replaceId?: string) {
    if (picking.current || exportingRef.current || !session?.draft) return true;
    const request = nativeBridge.media.takeVisitPhoto("library");
    if (!request) return false;
    void consumeAlbum(request.then(photo => {
      if (!photo.dataUrl) throw new Error("Photo data is unavailable.");
      return photo.dataUrl;
    }), replaceId);
    return true;
  }

  /** 웹 파일을 로컬에서 읽어 카드에만 추가한다. 취소·실패 때 현재 편집본을 유지한다. */
  function readAlbum(file: File, replaceId?: string) {
    if (!session?.draft || picking.current || exportingRef.current) return;
    const source = new Promise<string>((resolve, reject) => {
      if (!file.type.startsWith("image/")) { reject(new Error("An image is required.")); return; }
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Photo data is unavailable."));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    void consumeAlbum(source, replaceId);
  }

  /** 현재 편집본의 완성 PNG만 기존 저장·공유 경로에 전달한다. 취소하면 완료 안내 없이 편집본을 유지한다. */
  async function exportImage(mode: "save" | "share") {
    if (!session || !isCurrent(session.id, session.ownerId) || !draft || !image?.dataUrl || rendered?.request !== generationId.current || picking.current || exportingRef.current || renderError) return;
    const { id, ownerId: owner } = session;
    exportingRef.current = true; setExporting(mode);
    try {
      if (mode === "share" && await shareRouteCompletionPoster(image.dataUrl, image.fileName, draft.title, () => isCurrent(id, owner))) return;
      // 웹 공유의 파일 준비가 끝나는 동안 닫거나 계정을 바꿨으면 예전 사진으로 저장을 새로 시작하지 않는다.
      if (!isCurrent(id, owner)) return;
      const result = await downloadRouteCompletionPoster(image.dataUrl, image.fileName, draft.title);
      if (isCurrent(id, owner) && result.completed) showToast(result.mode === "native" ? text.saveDone : mode === "share" ? text.shareFallback : text.saveStarted);
    } catch (error) {
      if (isCurrent(id, owner) && !(error instanceof DOMException && error.name === "AbortError")) showToast(mode === "save" ? text.saveError : text.shareError);
    } finally {
      if (isCurrent(id, owner)) { exportingRef.current = false; setExporting(null); }
    }
  }

  return {
    session, draft, image, text, renderError, isPicking, exporting,
    isRendering: Boolean(draft && !image && !renderError),
    open, close, retry, edit, setTitle, selectPhoto, pickAlbum, readAlbum, exportImage,
  };
}
