import {
  lazy,
  Suspense,
  useEffect,
  type ComponentType,
  type LazyExoticComponent,
  type ReactNode,
} from "react";
import {
  BrowserRouter,
  HashRouter,
  Navigate,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";
import {
  MdArrowBack,
  MdOutlineAccountCircle,
  MdOutlineHub,
  MdOutlineRoute,
} from "react-icons/md";
import { PotatoLoadingCard } from "@/components/feedback/PotatoLoadingOverlay";
import RoutePageHeader from "@/components/layout/RoutePageHeader";
import BottomTabLayout from "@/layouts/BottomTabLayout";
import { getAuthToken } from "@/lib/authToken";
import { useUiText } from "@/lib/uiText";
import AppInfoPage from "@/pages/AppInfoPage";
import HomePage from "@/pages/HomePage";
import LanguageSettingsPage from "@/pages/LanguageSettingsPage";
import MyAccountPage from "@/pages/MyAccountPage";
import MyInfoPage from "@/pages/MyInfoPage";
import MyRoutePage from "@/pages/MyRoutePage";
import SharedRoutePage from "@/pages/SharedRoutePage";

type PreloadableLazyComponent<T extends ComponentType<any>> =
  LazyExoticComponent<T> & {
    preload: () => Promise<{ default: T }>;
  };

function lazyWithPreload<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  let promise: Promise<{ default: T }> | null = null;
  const load = () => {
    promise ??= factory();
    return promise;
  };
  const Component = lazy(load) as PreloadableLazyComponent<T>;
  Component.preload = load;

  return Component;
}

const LoginPage = lazyWithPreload(() => import("@/pages/LoginPage"));
const MyRouteHistoryPage = lazyWithPreload(
  () => import("@/features/my-route/pages/MyRouteHistoryPage")
);
const LikedSharedRoutePage = lazyWithPreload(
  () => import("@/features/shared-route/pages/LikedSharedRoutePage")
);

type RoutePageShellProps = {
  icon: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
};

function RoutePageShell({
  icon,
  title,
  description,
  children,
}: RoutePageShellProps) {
  return (
    <section className="flex h-full min-h-0 flex-col gap-4 pb-4 text-slate-900 dark:text-slate-100">
      <RoutePageHeader
        icon={icon}
        title={title}
        description={description}
      />
      <div className="min-h-0 flex-1">
        {children}
      </div>
    </section>
  );
}

type RoutePageFallbackProps = {
  title: string;
  description?: string;
  eyebrow?: string;
  showBackPlaceholder?: boolean;
  backTo?: string;
  loadingTitle?: string;
  loadingDescription?: string;
};

function RoutePageFallback({
  title,
  description,
  eyebrow,
  showBackPlaceholder = false,
  backTo = "/me",
  loadingTitle,
  loadingDescription,
}: RoutePageFallbackProps) {
  const text = useUiText();
  const navigate = useNavigate();

  return (
    <section className="flex min-h-full flex-col gap-4 pb-4 text-slate-900 dark:text-slate-100">
      {showBackPlaceholder ? (
        <header className="flex items-center gap-3">
          <button
            type="button"
            aria-label={text.common.back}
            onClick={() => navigate(backTo)}
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-xl text-brand-700 shadow-sm transition hover:bg-brand-100 dark:border-brand-400/30 dark:bg-[#0f3431] dark:text-brand-200 dark:shadow-[0_10px_24px_rgba(0,0,0,0.22)] dark:hover:bg-[#13423e]"
          >
            <MdArrowBack />
          </button>
          <div className="min-w-0">
            {eyebrow ? (
              <p className="text-xs font-black text-brand-700 dark:text-brand-200">
                {eyebrow}
              </p>
            ) : null}
            <h1 className="truncate text-lg font-bold text-slate-900 dark:text-white">
              {title}
            </h1>
          </div>
        </header>
      ) : (
        <div className="rounded-2xl border border-brand-200 bg-white p-4 shadow-sm dark:border-brand-400/25 dark:bg-slate-950/40">
          <div className="min-w-0">
            {eyebrow ? (
              <p className="text-xs font-black text-brand-700 dark:text-brand-200">
                {eyebrow}
              </p>
            ) : null}
            <h1 className="text-sm font-bold text-slate-900 dark:text-white">
              {title}
            </h1>
            {description ? (
              <p className="mt-0.5 text-xs font-semibold leading-5 text-slate-500 dark:text-slate-300">
                {description}
              </p>
            ) : null}
          </div>
        </div>
      )}

      <div className="flex min-h-[12rem] flex-1 items-center justify-center">
        <PotatoLoadingCard
          title={loadingTitle ?? text.routeShell.defaultLoadingTitle}
          description={
            loadingDescription ?? text.routeShell.defaultLoadingDescription
          }
          animation="running"
          compact
          className="w-full shadow-sm"
        />
      </div>
    </section>
  );
}

function LoginRouteFallback() {
  const text = useUiText();

  return (
    <main className="flex min-h-dvh items-center justify-center bg-brand-50 px-5 py-8 text-slate-900">
      <section className="w-full max-w-md">
        <PotatoLoadingCard
          title={text.routeShell.loginLoadingTitle}
          description={text.routeShell.loginLoadingDescription}
          animation="running"
          compact
          className="shadow-sm"
        />
      </section>
    </main>
  );
}

type PreloadableRoute = {
  preload: () => Promise<unknown>;
};

function preloadRoutes(pages: readonly PreloadableRoute[]) {
  pages.forEach((page) => {
    void page.preload();
  });
}

function preloadSecondaryRoutes() {
  preloadRoutes([MyRouteHistoryPage, LikedSharedRoutePage]);
}

function useRoutePreload() {
  useEffect(() => {
    if (!getAuthToken()) {
      void LoginPage.preload();
      return;
    }

    if (typeof window.requestIdleCallback === "function") {
      const idleCallbackId = window.requestIdleCallback(preloadSecondaryRoutes, {
        timeout: 1800,
      });

      return () => {
        window.cancelIdleCallback(idleCallbackId);
      };
    }

    const timeoutId = globalThis.setTimeout(preloadSecondaryRoutes, 900);

    return () => {
      globalThis.clearTimeout(timeoutId);
    };
  }, []);
}

function withRouteSuspense(children: ReactNode, fallback: ReactNode = null) {
  return <Suspense fallback={fallback}>{children}</Suspense>;
}

function RequireAuth() {
  if (!getAuthToken()) {
    return <Navigate to="/login" replace />;
  }

  return <BottomTabLayout />;
}

function LoginRoute() {
  if (getAuthToken()) {
    return <Navigate to="/home" replace />;
  }

  return withRouteSuspense(<LoginPage />, <LoginRouteFallback />);
}

function AppRouter() {
  useRoutePreload();
  const text = useUiText();
  const Router =
    window.RouteOneRuntimeConfig?.routerMode === "hash"
      ? HashRouter
      : BrowserRouter;

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginRoute />} />
        <Route element={<RequireAuth />}>
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/home" element={<HomePage />} />
          <Route
            path="/my-route"
            element={
              <RoutePageShell
                icon={<MdOutlineRoute />}
                title={text.routeShell.myRouteTitle}
                description={text.routeShell.myRouteDescription}
              >
                <MyRoutePage />
              </RoutePageShell>
            }
          />
          <Route
            path="/shared-route"
            element={
              <RoutePageShell
                icon={<MdOutlineHub />}
                title={text.routeShell.sharedRouteTitle}
                description={text.routeShell.sharedRouteDescription}
              >
                <SharedRoutePage />
              </RoutePageShell>
            }
          />
          <Route
            path="/me"
            element={
              <RoutePageShell
                icon={<MdOutlineAccountCircle />}
                title={text.routeShell.myInfoTitle}
                description={text.routeShell.myInfoDescription}
              >
                <MyInfoPage />
              </RoutePageShell>
            }
          />
          <Route
            path="/me/routes"
            element={withRouteSuspense(
              <MyRouteHistoryPage />,
              <RoutePageFallback
                eyebrow={text.routeShell.myInfoTitle}
                title={text.routeShell.routeHistoryTitle}
                showBackPlaceholder
                loadingTitle={text.routeShell.routeHistoryLoadingTitle}
                loadingDescription=""
              />
            )}
          />
          <Route
            path="/me/liked-routes"
            element={withRouteSuspense(
              <LikedSharedRoutePage />,
              <RoutePageFallback
                eyebrow={text.routeShell.myInfoTitle}
                title={text.routeShell.likedRouteTitle}
                showBackPlaceholder
                loadingTitle={text.routeShell.likedRouteLoadingTitle}
                loadingDescription=""
              />
            )}
          />
          <Route
            path="/me/account"
            element={<MyAccountPage />}
          />
          <Route
            path="/me/language"
            element={<LanguageSettingsPage />}
          />
          <Route
            path="/me/app-info"
            element={<AppInfoPage />}
          />
        </Route>
      </Routes>
    </Router>
  );
}

export default AppRouter;
