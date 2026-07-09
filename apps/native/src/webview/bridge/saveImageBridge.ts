import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { Platform, Share } from "react-native";
import { postNativeSaveImageResponse } from "./responses";
import type {
  NativeSaveImageRequest,
  NativeSaveImageResponse,
  WebViewRef
} from "./types";

const PNG_DATA_URL_PREFIX = "data:image/png;base64,";

function sanitizeFileName(fileName: string) {
  const sanitized = fileName
    .trim()
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 80);

  return sanitized || `routeone-card-${Date.now()}.png`;
}

function assertPngDataUrl(dataUrl: string) {
  if (!dataUrl.startsWith(PNG_DATA_URL_PREFIX)) {
    throw new Error("저장할 포토카드 이미지가 올바르지 않아요.");
  }
}

async function saveNativeImage(
  message: NativeSaveImageRequest
): Promise<NativeSaveImageResponse> {
  if (Platform.OS !== "ios") {
    throw new Error("포토카드 이미지 저장을 지원하지 않는 앱 환경이에요.");
  }

  assertPngDataUrl(message.dataUrl);

  const image = await manipulateAsync(message.dataUrl, [], {
    compress: 1,
    format: SaveFormat.PNG
  });
  const title = message.title?.trim() || "RouteOne 포토카드";
  const fileName = sanitizeFileName(message.fileName);
  const shareResult = await Share.share(
    {
      title,
      url: image.uri
    },
    {
      dialogTitle: "포토카드 저장/공유",
      subject: fileName
    }
  );

  return {
    ok: true,
    shared: shareResult.action === Share.sharedAction,
    uri: image.uri
  };
}

export async function handleNativeSaveImageRequest(
  message: NativeSaveImageRequest,
  webViewRef: WebViewRef
) {
  try {
    postNativeSaveImageResponse(
      webViewRef,
      message.id,
      await saveNativeImage(message)
    );
  } catch (error) {
    postNativeSaveImageResponse(webViewRef, message.id, {
      ok: false,
      error: error instanceof Error ? error.message : "Native image save failed"
    });
  }
}
