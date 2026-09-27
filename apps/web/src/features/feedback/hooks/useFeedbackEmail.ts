/**
 * 용도: 불편사항 화면의 메일 앱 열기와 이메일 주소 복사를 연결한다.
 * 동작 방식: 전역 앱 정보로 메일을 준비하고, 복사할 수 없으면 주소를 직접 선택하게 한다.
 */
import { useRef, useState, type MouseEvent } from "react";
import { useUiText } from "@/lib/uiText";
import { useNativeAppInfo } from "@/native-bridge";
import { getNativeBridgeApi } from "@/native-bridge/runtime";
import { createFeedbackEmailUrl, FEEDBACK_EMAIL } from "../utils/feedbackEmail";

export function useFeedbackEmail() {
  const { feedback: text } = useUiText();
  const { appInfoState } = useNativeAppInfo();
  const emailInputRef = useRef<HTMLInputElement>(null);
  const [copyStatus, setCopyStatus] = useState<"copied" | "manual" | null>(null);
  const [openFailed, setOpenFailed] = useState(false);
  const emailUrl = createFeedbackEmailUrl({
    text,
    appInfo: appInfoState.info,
    webVersion: import.meta.env.VITE_APP_VERSION,
  });

  /** 네이티브 외부 URL 열기가 요청을 받으면 브라우저 링크 이동을 막고, 브리지 예외는 실패 안내 상태로 바꾼다. */
  function handleOpenEmail(event: MouseEvent<HTMLAnchorElement>) {
    setOpenFailed(false);
    try {
      if (getNativeBridgeApi()?.openExternalUrl?.(emailUrl)) {
        event.preventDefault();
      }
    } catch {
      event.preventDefault();
      setOpenFailed(true);
    }
  }

  /** 이메일 주소를 클립보드에 복사하고, 실패하면 숨은 입력을 선택해 사용자가 직접 복사할 수 있게 한다. */
  async function handleCopyEmail() {
    try {
      await navigator.clipboard.writeText(FEEDBACK_EMAIL);
      setCopyStatus("copied");
    } catch {
      emailInputRef.current?.focus();
      emailInputRef.current?.select();
      setCopyStatus("manual");
    }
  }

  return { emailUrl, emailInputRef, copyStatus, openFailed, handleOpenEmail, handleCopyEmail };
}
