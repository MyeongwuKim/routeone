import { Component, type ErrorInfo, type ReactNode } from "react";
import { nativeBridge } from "@/native-bridge";

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  errorMessage: string | null;
  hasError: boolean;
};

const ERROR_TEXT = {
  ko: {
    eyebrow: "RouteOne",
    title: "앱 화면을 불러오지 못했어요",
    description:
      "웹 화면을 그리는 중 오류가 발생했습니다. 다시 불러오면 저장된 화면부터 복구를 시도합니다.",
    action: "다시 불러오기",
  },
  en: {
    eyebrow: "RouteOne",
    title: "Could not load the app screen",
    description:
      "Something failed while rendering the web screen. Reloading will try to recover from the saved app state.",
    action: "Reload",
  },
} as const;

function readErrorLanguage() {
  try {
    return window.localStorage.getItem("routeone-app-language") === "en"
      ? "en"
      : "ko";
  } catch {
    return "ko";
  }
}

export default class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    errorMessage: null,
    hasError: false,
  };

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    return {
      errorMessage:
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : "Unknown render error",
      hasError: true,
    };
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    console.error("[routeone-web] render failed", error, errorInfo);

    nativeBridge.lifecycle.reportRuntimeError(
      "react-error-boundary",
      error
    );
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const text = ERROR_TEXT[readErrorLanguage()];

    return (
      <main className="flex min-h-dvh items-center justify-center bg-brand-50 px-5 py-8 text-slate-900 dark:bg-[#071718] dark:text-slate-100">
        <section className="w-full max-w-sm rounded-2xl border border-brand-100 bg-white p-5 shadow-sm dark:border-brand-400/25 dark:bg-[#071f1d]">
          <p className="text-xs font-black text-brand-700 dark:text-brand-200">
            {text.eyebrow}
          </p>
          <h1 className="mt-2 text-lg font-black text-slate-950 dark:text-white">
            {text.title}
          </h1>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-500 dark:text-slate-300">
            {text.description}
          </p>
          {this.state.errorMessage ? (
            <pre className="mt-3 max-h-28 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-100 p-3 text-xs font-semibold leading-5 text-slate-600 dark:bg-slate-900/70 dark:text-slate-300">
              {this.state.errorMessage}
            </pre>
          ) : null}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl bg-brand-600 px-4 text-sm font-black text-white shadow-sm transition active:scale-[0.99] dark:bg-brand-400 dark:text-[#061918]"
          >
            {text.action}
          </button>
        </section>
      </main>
    );
  }
}
