/**
 * 용도:
 * 로그인 후 네이티브 세션을 준비하는 동안 현재 WebView 위에 로딩 안내를 표시한다.
 *
 * 동작 방식:
 * WebView에 실행할 스크립트를 만들어 공통 나침반 진행 아이콘을 추가하거나 제거한다.
 * 설치된 웹 번들이 이전 버전이어도 동작하도록 네이티브에서 DOM을 주입한다.
 */
import { WEB_VIEW_TEXT } from "@/constants/nativeWebView";

type AppLanguage = "ko" | "en";

const AUTH_PREPARING_OVERLAY_ID = "routeone-auth-preparing-overlay";
const AUTH_PREPARING_STYLE_ID = "routeone-auth-preparing-style";
// 이전 웹 번들에서도 같은 모양을 표시할 수 있도록 로그인 대기 아이콘은 외부 파일 없이 주입한다.
const AUTH_PREPARING_ICON = `<svg viewBox="0 0 112 112" fill="none" width="80" height="80" aria-hidden="true" focusable="false">
  <circle cx="56" cy="56" r="47" fill="#ccfbf1" fill-opacity="0.35"/>
  <circle class="duru-auth-orbit" cx="56" cy="56" r="46" stroke="#14b8a6" stroke-opacity="0.45" stroke-width="2" stroke-dasharray="2 9" stroke-linecap="round"/>
  <circle cx="56" cy="56" r="34" fill="#0f766e"/>
  <circle cx="56" cy="56" r="28" stroke="#5eead4" stroke-opacity="0.45" stroke-width="1.5"/>
  <g class="duru-auth-needle">
    <path d="M74 38L62 62L38 74L50 50Z" fill="#5eead4" stroke="#99f6e4" stroke-width="2" stroke-linejoin="round"/>
    <path d="M74 38L62 62L50 50Z" fill="#ffffff"/>
    <circle cx="56" cy="56" r="3" fill="#0f766e"/>
  </g>
  <circle cx="94" cy="27" r="6" fill="#fb923c"/>
  <circle cx="20" cy="88" r="3" fill="#2dd4bf"/>
</svg>`;

export function createAuthSessionPreparingScript(
  isPreparing: boolean,
  language: AppLanguage
) {
  const text = WEB_VIEW_TEXT[language];
  const content = JSON.stringify({
    icon: AUTH_PREPARING_ICON,
    description: text.authPreparingDescription,
    overlayId: AUTH_PREPARING_OVERLAY_ID,
    styleId: AUTH_PREPARING_STYLE_ID,
    title: text.authPreparingTitle
  });

  return `
    (function () {
      var isPreparing = ${JSON.stringify(isPreparing)};
      var content = ${content};
      window.__ROUTEONE_NATIVE_AUTH_PREPARING__ = isPreparing;

      function removeOverlay() {
        var overlay = document.getElementById(content.overlayId);
        var style = document.getElementById(content.styleId);
        if (overlay) overlay.remove();
        if (style) style.remove();
      }

      function showOverlay() {
        if (!window.__ROUTEONE_NATIVE_AUTH_PREPARING__) return;
        if (!document.body) {
          document.addEventListener("DOMContentLoaded", showOverlay, { once: true });
          return;
        }
        if (document.getElementById(content.overlayId)) return;

        var isDark = window.matchMedia &&
          window.matchMedia("(prefers-color-scheme: dark)").matches;
        var style = document.createElement("style");
        style.id = content.styleId;
        style.textContent =
          ".duru-auth-needle,.duru-auth-orbit{transform-origin:56px 56px}" +
          ".duru-auth-needle{animation:duruAuthCompassSway 2.6s ease-in-out infinite;transform:rotate(-12deg)}" +
          ".duru-auth-orbit{animation:duruAuthCompassOrbit 12s linear infinite}" +
          "@keyframes duruAuthCompassSway{0%,100%{transform:rotate(-12deg)}45%{transform:rotate(24deg)}65%{transform:rotate(16deg)}}" +
          "@keyframes duruAuthCompassOrbit{to{transform:rotate(360deg)}}" +
          "@media(prefers-reduced-motion:reduce){.duru-auth-needle,.duru-auth-orbit{animation:none}}";

        var overlay = document.createElement("div");
        overlay.id = content.overlayId;
        overlay.setAttribute("role", "status");
        overlay.setAttribute("aria-busy", "true");
        Object.assign(overlay.style, {
          alignItems: "center",
          background: "rgba(3, 15, 15, 0.46)",
          boxSizing: "border-box",
          display: "flex",
          inset: "0",
          justifyContent: "center",
          padding: "24px",
          pointerEvents: "auto",
          position: "fixed",
          zIndex: "2147483646"
        });

        var card = document.createElement("div");
        Object.assign(card.style, {
          alignItems: "center",
          background: isDark ? "#071f1d" : "#ffffff",
          border: "1px solid " + (isDark ? "rgba(45,212,191,.28)" : "#ccfbf1"),
          borderRadius: "24px",
          boxShadow: "0 20px 55px rgba(0,0,0,.26)",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          maxWidth: "340px",
          padding: "26px 24px",
          textAlign: "center",
          width: "100%"
        });

        var icon = document.createElement("div");
        icon.innerHTML = content.icon;
        icon.setAttribute("aria-hidden", "true");
        Object.assign(icon.style, {
          height: "80px",
          lineHeight: "1",
          marginBottom: "16px",
          width: "80px"
        });

        var title = document.createElement("p");
        title.textContent = content.title;
        Object.assign(title.style, {
          color: isDark ? "#f0fdfa" : "#134e4a",
          fontSize: "17px",
          fontWeight: "800",
          lineHeight: "1.4",
          margin: "0"
        });

        var description = document.createElement("p");
        description.textContent = content.description;
        Object.assign(description.style, {
          color: isDark ? "#cbd5e1" : "#64748b",
          fontSize: "13px",
          fontWeight: "600",
          lineHeight: "1.5",
          margin: "7px 0 0"
        });

        card.appendChild(icon);
        card.appendChild(title);
        card.appendChild(description);
        overlay.appendChild(card);
        document.head.appendChild(style);
        document.body.appendChild(overlay);
      }

      if (isPreparing) showOverlay();
      else removeOverlay();
    })();
    true;
  `;
}
