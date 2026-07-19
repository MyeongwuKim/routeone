import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App.tsx";
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

async function preloadAppFonts() {
  if (!("fonts" in document)) {
    return;
  }

  const fonts = [
    document.fonts.load('400 16px "Roboto"', "RouteOne"),
    document.fonts.load('500 16px "Roboto"', "RouteOne"),
    document.fonts.load('700 16px "Roboto"', "RouteOne"),
    document.fonts.load('900 16px "Roboto"', "RouteOne"),
    document.fonts.load('400 16px "Jua"', "RouteOne"),
    document.fonts.load('400 16px "Jua"', "감자"),
  ];

  await Promise.race([
    Promise.all(fonts),
    new Promise((resolve) => window.setTimeout(resolve, 1500)),
  ]);
}

function renderApp() {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
        <NativeWebBundleReadySignal />
      </QueryClientProvider>
    </StrictMode>
  );
}

void preloadAppFonts().finally(renderApp);
