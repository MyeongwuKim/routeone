/**
 * 용도:
 * 로그인 후 네이티브 세션을 준비하는 동안 현재 WebView 위에 로딩 안내를 표시한다.
 *
 * 동작 방식:
 * WebView에 실행할 스크립트를 만들어 감자 로딩 요소를 추가하거나 제거한다.
 * 설치된 웹 번들이 이전 버전이어도 동작하도록 네이티브에서 DOM을 주입한다.
 */
import { WEB_VIEW_TEXT } from "@/constants/nativeWebView";

type AppLanguage = "ko" | "en";

const AUTH_PREPARING_OVERLAY_ID = "routeone-auth-preparing-overlay";
const AUTH_PREPARING_STYLE_ID = "routeone-auth-preparing-style";

export function createAuthSessionPreparingScript(
  isPreparing: boolean,
  language: AppLanguage
) {
  const text = WEB_VIEW_TEXT[language];
  const content = JSON.stringify({
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
          "@keyframes routeoneAuthPotatoFloat{" +
          "0%,100%{transform:translateY(0) rotate(-3deg)}" +
          "50%{transform:translateY(-7px) rotate(3deg)}}" +
          "@keyframes routeoneAuthSpinner{" +
          "to{transform:rotate(360deg)}}";

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

        var potato = document.createElement("div");
        potato.textContent = "🥔";
        potato.setAttribute("aria-hidden", "true");
        Object.assign(potato.style, {
          animation: "routeoneAuthPotatoFloat 1.2s ease-in-out infinite",
          fontSize: "72px",
          lineHeight: "1",
          marginBottom: "16px"
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

        var spinner = document.createElement("div");
        spinner.setAttribute("aria-hidden", "true");
        Object.assign(spinner.style, {
          animation: "routeoneAuthSpinner .8s linear infinite",
          border: "3px solid " + (isDark ? "rgba(94,234,212,.22)" : "#ccfbf1"),
          borderRadius: "999px",
          borderTopColor: "#0d9488",
          height: "22px",
          marginTop: "18px",
          width: "22px"
        });

        card.appendChild(potato);
        card.appendChild(title);
        card.appendChild(description);
        card.appendChild(spinner);
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
