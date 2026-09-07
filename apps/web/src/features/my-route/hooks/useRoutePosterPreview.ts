/**
 * 용도: DAY 포토카드의 생성, 테마·배경 전환, 저장·공유 상태를 관리한다.
 * 동작 방식: 선택한 스타일로 PNG를 다시 만들고, 닫힌 미리보기의 늦은 응답은 무시한다.
 */
import { useEffect, useRef, useState } from "react";
import { routeApi } from "@/api/routeApi";
import { useUiText } from "@/lib/uiText";
import { useUiToastStore } from "@/stores/uiToastStore";
import {
  createRouteCompletionPosterCards, downloadRouteCompletionPoster, shareRouteCompletionPoster,
  type RouteCompletionPosterBackgroundId, type RouteCompletionPosterCard,
} from "../routeCompletionPoster";
import { getRouteTitle } from "../routeDisplay";
import type { RoutePosterThemeId } from "../models/routePosterTheme";
import type { MyRoute } from "../types";

export type RoutePosterPreview = {
  route: MyRoute;
  cards: RouteCompletionPosterCard[];
  currentIndex: number;
  themeId: RoutePosterThemeId;
  backgroundId: RouteCompletionPosterBackgroundId;
  customBackgroundDataUrl: string | null;
};
type PosterAppearance = Pick<RoutePosterPreview, "themeId" | "backgroundId" | "customBackgroundDataUrl">;

export function useRoutePosterPreview() {
  const text = useUiText();
  const showToast = useUiToastStore((state) => state.showToast);
  const [preview, setPreview] = useState<RoutePosterPreview | null>(null);
  const [generatingRouteId, setGeneratingRouteId] = useState<string | null>(null);
  const previewRef = useRef<RoutePosterPreview | null>(null);
  const requestRef = useRef(0);
  const pendingRef = useRef(false);

  useEffect(() => () => {
    requestRef.current += 1;
    pendingRef.current = false;
    previewRef.current = null;
  }, []);

  function commitPreview(next: RoutePosterPreview | null) {
    previewRef.current = next;
    setPreview(next);
  }
  function closePreview() {
    requestRef.current += 1;
    pendingRef.current = false;
    setGeneratingRouteId(null);
    commitPreview(null);
  }
  function finishRequest(requestId: number) {
    if (requestId !== requestRef.current) return;
    pendingRef.current = false;
    setGeneratingRouteId(null);
  }
  async function createPoster(route: MyRoute, initialDayIndex?: number) {
    if (pendingRef.current) return;
    const requestId = ++requestRef.current;
    pendingRef.current = true;
    setGeneratingRouteId(route.id);
    try {
      const result = await routeApi.routeById(route.id);
      if (requestId !== requestRef.current) return;
      const posterRoute = result.route ?? route;
      const cards = await createRouteCompletionPosterCards(posterRoute);
      if (requestId !== requestRef.current) return;
      if (!cards.length) throw new Error("No poster cards were generated.");
      commitPreview({route: posterRoute, cards, currentIndex: Math.max(0, cards.findIndex((card) => card.dayIndex === initialDayIndex)), themeId: "journal", backgroundId: "paper", customBackgroundDataUrl: null});
      const missing = cards.reduce((sum, card) => sum + card.missingPhotoCount, 0);
      if (missing) showToast(text.routeHistory.missingPhotoToast(missing));
    } catch (error) {
      if (requestId !== requestRef.current) return;
      console.error(error);
      showToast(text.routeHistory.createErrorToast);
    } finally {
      finishRequest(requestId);
    }
  }
  function selectCard(index: number) {
    const current = previewRef.current;
    if (!current) return;
    commitPreview({...current, currentIndex: Math.max(0, Math.min(current.cards.length - 1, index))});
  }
  async function selectAppearance(patch: Partial<PosterAppearance>) {
    const current = previewRef.current;
    if (!current || pendingRef.current) return;
    const appearance = {
      themeId: patch.themeId ?? current.themeId,
      backgroundId: patch.backgroundId ?? current.backgroundId,
      customBackgroundDataUrl: patch.customBackgroundDataUrl ?? current.customBackgroundDataUrl,
    };
    if (appearance.backgroundId === "custom" && !appearance.customBackgroundDataUrl) return;
    if (appearance.themeId === current.themeId && appearance.backgroundId === current.backgroundId && appearance.customBackgroundDataUrl === current.customBackgroundDataUrl) return;
    const requestId = ++requestRef.current;
    pendingRef.current = true;
    setGeneratingRouteId(current.route.id);
    try {
      const cards = await createRouteCompletionPosterCards(current.route, appearance.backgroundId,
        appearance.backgroundId === "custom" ? appearance.customBackgroundDataUrl : null, appearance.themeId);
      if (requestId !== requestRef.current) return;
      if (!cards.length) throw new Error("No poster cards were generated.");
      commitPreview({...current, ...appearance, cards, currentIndex: Math.min(previewRef.current?.currentIndex ?? 0, cards.length - 1)});
    } catch (error) {
      if (requestId !== requestRef.current) return;
      console.error(error);
      showToast(text.routeHistory.styleChangeErrorToast);
    } finally {
      finishRequest(requestId);
    }
  }
  async function download() {
    const current = previewRef.current;
    const card = current?.cards[current.currentIndex];
    if (!current || !card || pendingRef.current) return;
    try {
      const result = await downloadRouteCompletionPoster(card.dataUrl, card.fileName, `${getRouteTitle(current.route, text)} ${card.label}`);
      if (result.mode === "native" && !result.completed) return;
      showToast(result.mode === "native" ? text.routeHistory.saveDoneToast : text.routeHistory.downloadStartedToast(card.label));
    } catch (error) {
      console.error(error);
      showToast(text.routeHistory.saveErrorToast);
    }
  }
  async function share() {
    const current = previewRef.current;
    const card = current?.cards[current.currentIndex];
    if (!current || !card || pendingRef.current) return;
    try {
      const title = `${getRouteTitle(current.route, text)} ${card.label}`;
      const shared = await shareRouteCompletionPoster(card.dataUrl, card.fileName, title);
      if (!shared) {
        const result = await downloadRouteCompletionPoster(card.dataUrl, card.fileName, title);
        if (result.mode === "native" && !result.completed) return;
        showToast(result.mode === "native" ? text.routeHistory.saveDoneToast : text.routeHistory.shareDownloadToast);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error(error);
      showToast(text.routeHistory.shareErrorToast);
    }
  }
  return {preview, generatingRouteId, createPoster, closePreview, selectCard, selectAppearance, download, share};
}
