import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
  createRoot(document.getElementById("root")!).render(
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
