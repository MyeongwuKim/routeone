/**
 * 용도: 불편사항 문의 메일의 받는 주소와 본문을 구성한다.
 * 동작 방식: 안내 문구와 확인된 앱·OS 버전만 넣고 메일 링크에 맞게 인코딩한다.
 */
import type { UiText } from "@/lib/uiText";
import type { NativeAppInfo } from "@/native-bridge/types";

export const FEEDBACK_EMAIL = "mw1992@naver.com";

export function createFeedbackEmailUrl({
  text,
  appInfo,
  webVersion,
}: {
  text: UiText["feedback"];
  appInfo: NativeAppInfo | null;
  webVersion?: string;
}) {
  const details = [
    ["Platform", appInfo?.platform],
    ["App", appInfo?.appVersion],
    ["Build", appInfo?.buildNumber],
    ["OS", appInfo?.osVersion],
    ["Web", appInfo?.webBundleVersion || webVersion],
  ]
    .filter(([, value]) => value?.trim())
    .map(([label, value]) => `${label}: ${value}`);
  const body = [
    text.emailBody,
    ...(details.length ? ["", "---", text.environmentLabel, ...details] : []),
  ].join("\r\n");

  return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(text.emailSubject)}&body=${encodeURIComponent(body)}`;
}
