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
