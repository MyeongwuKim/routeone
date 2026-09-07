/**
 * 용도: 여행 기록 카드의 생성 상태와 미리보기를 여러 진입 화면에서 함께 사용한다.
 * 구조: 카드 생성 훅의 상태를 미리보기와 저장·공유 동작에 연결한다.
 */
import type { useRoutePosterPreview } from "../hooks/useRoutePosterPreview";
import RoutePosterPreviewModal, { RoutePosterGeneratingModal } from "./RoutePosterPreviewModal";

export default function RoutePosterPreview({ controller }: {
  controller: ReturnType<typeof useRoutePosterPreview>;
}) {
  const { preview, generatingRouteId, closePreview, selectCard, selectAppearance, download, share } = controller;
  if (!preview) return generatingRouteId ? <RoutePosterGeneratingModal /> : null;
  return <RoutePosterPreviewModal
    preview={preview}
    onClose={closePreview}
    isGenerating={Boolean(generatingRouteId)}
    onSelectTheme={(themeId) => void selectAppearance({ themeId })}
    onSelectCard={selectCard}
    onSelectBackground={(backgroundId) => void selectAppearance({ backgroundId })}
    onSelectCustomBackground={(dataUrl) => void selectAppearance({ backgroundId: "custom", customBackgroundDataUrl: dataUrl })}
    onDownload={download}
    onShare={share}
  />;
}
