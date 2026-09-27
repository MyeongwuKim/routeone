/**
 * 용도:
 * 웹 앱 실행에 필요한 전역 설정을 적용하고 React 애플리케이션을 시작한다.
 *
 * 동작 방식:
 * 모니터링과 공통 스타일을 준비한 뒤 루트 요소에 App을 렌더링한다.
 */
import "./instrument";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getReactRootMonitoringOptions } from "./monitoring/sentry";
import App from "./App.tsx";
import AppErrorBoundary from "./components/AppErrorBoundary";
import NativeWebBundleReadySignal from "./components/NativeWebBundleReadySignal";
import { isGraphQLRequestError } from "./lib/graphqlClient";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) =>
        !isGraphQLRequestError(error) &&
        (typeof navigator === "undefined" || navigator.onLine) &&
        failureCount < 1,
      retryDelay: (attemptIndex) =>
        Math.min(750 * 2 ** attemptIndex, 2_500),
    },
    mutations: {
      retry: false,
    },
  },
});

function warmAppFonts() {
  if (!("fonts" in document)) {
    return;
  }

  void Promise.allSettled([
    document.fonts.load('400 16px "Roboto"', "RouteOne"),
    document.fonts.load('500 16px "Roboto"', "RouteOne"),
    document.fonts.load('700 16px "Roboto"', "RouteOne"),
    document.fonts.load('900 16px "Roboto"', "RouteOne"),
    document.fonts.load('400 16px "Jua"', "RouteOne"),
    document.fonts.load('400 16px "Jua"', "감자"),
  ]);
}

function renderApp() {
  createRoot(
    document.getElementById("root")!,
    getReactRootMonitoringOptions()
  ).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <AppErrorBoundary>
          <App />
        </AppErrorBoundary>
        <NativeWebBundleReadySignal />
      </QueryClientProvider>
    </StrictMode>
  );
}

warmAppFonts();
renderApp();
