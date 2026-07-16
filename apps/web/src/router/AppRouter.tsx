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
import { FaHeart } from "react-icons/fa";
import {
  MdArrowBack,
  MdHistory,
  MdOutlineAccountCircle,
  MdOutlineHub,
  MdOutlineRoute,
} from "react-icons/md";
import { PotatoLoadingCard } from "@/components/feedback/PotatoLoadingOverlay";
import RouteListSkeleton from "@/components/feedback/RouteListSkeleton";
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

type PreloadableLazyComponent<
  T extends ComponentType<Record<string, never>>,
> =
  LazyExoticComponent<T> & {
    preload: () => Promise<{ default: T }>;
  };

function lazyWithPreload<T extends ComponentType<Record<string, never>>>(
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

function RouteHistoryLazyFallback() {
  const text = useUiText();
  const navigate = useNavigate();

  return (
    <section
      aria-busy="true"
      className="space-y-4 pb-4 text-slate-900 dark:text-slate-100"
    >
      <header className="flex items-center gap-3">
        <button
          type="button"
          aria-label={text.common.backToMyInfo}
          onClick={() => navigate("/me")}
          className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-xl text-brand-700 shadow-sm transition hover:bg-brand-100 dark:border-brand-400/30 dark:bg-[#0f3431] dark:text-brand-200 dark:shadow-[0_10px_24px_rgba(0,0,0,0.22)] dark:hover:bg-[#13423e]"
        >
          <MdArrowBack />
        </button>
        <div className="min-w-0">
          <p className="text-xs font-black text-brand-700 dark:text-brand-200">
            {text.routeHistory.eyebrow}
          </p>
          <h1 className="truncate text-lg font-bold text-slate-900 dark:text-white">
            {text.routeHistory.title}
          </h1>
        </div>
      </header>

      <div className="rounded-2xl border border-brand-100 bg-white p-4 shadow-sm dark:border-brand-400/25 dark:bg-[#071f1d] dark:shadow-[0_16px_34px_rgba(0,0,0,0.28)]">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-xl text-brand-700 dark:bg-brand-400/15 dark:text-brand-100">
            <MdHistory />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              {text.routeHistory.description}
            </p>
            <p className="mt-0.5 text-xs font-semibold text-slate-500 dark:text-slate-200/75">
              {text.routeHistory.loadingTitle}
            </p>
          </div>
        </div>
      </div>

      <RouteListSkeleton variant="history" />
    </section>
  );
}

function LikedSharedRoutesLazyFallback() {
  const text = useUiText();
  const navigate = useNavigate();

  return (
    <section
      aria-busy="true"
      className="flex h-full min-h-0 flex-col gap-3 text-slate-900 dark:text-slate-100"
    >
      <header className="flex items-center gap-3">
        <button
          type="button"
          aria-label={text.sharedRoute.likedBackAria}
          onClick={() => navigate("/me")}
          className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-xl text-brand-700 shadow-sm transition hover:bg-brand-100 dark:border-brand-400/30 dark:bg-[#0f3431] dark:text-brand-200 dark:shadow-[0_10px_24px_rgba(0,0,0,0.22)] dark:hover:bg-[#13423e]"
        >
          <MdArrowBack />
        </button>
        <div className="min-w-0">
          <p className="text-xs font-black text-brand-700 dark:text-brand-200">
            {text.routeShell.myInfoTitle}
          </p>
          <h1 className="truncate text-lg font-bold text-slate-900 dark:text-white">
            {text.sharedRoute.likedTitle}
          </h1>
        </div>
      </header>

      <div className="rounded-2xl border border-brand-200 bg-white p-4 shadow-sm dark:border-brand-400/25 dark:bg-slate-950/40">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-xl text-brand-700 dark:bg-brand-400/15 dark:text-brand-100">
            <FaHeart />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              {text.sharedRoute.likedTitle}
            </p>
            <p className="mt-0.5 text-xs font-semibold text-slate-500 dark:text-slate-300">
              {text.sharedRoute.likedDescription}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="h-10 w-40 shrink-0 animate-pulse rounded-full bg-white shadow-sm ring-1 ring-brand-100 dark:bg-[#071f1d] dark:ring-brand-400/25" />
          <div className="h-10 min-w-0 flex-1 animate-pulse rounded-full bg-brand-50 ring-1 ring-brand-100 dark:bg-brand-400/15 dark:ring-brand-400/25" />
        </div>
      </div>

      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto">
        <RouteListSkeleton variant="shared" />
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
              <RouteHistoryLazyFallback />
            )}
          />
          <Route
            path="/me/liked-routes"
            element={withRouteSuspense(
              <LikedSharedRoutePage />,
              <LikedSharedRoutesLazyFallback />
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
