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
import MyInfoPage from "@/pages/MyInfoPage";

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
const HomePage = lazyWithPreload(() => import("@/pages/HomePage"));
const MyRoutePage = lazyWithPreload(() => import("@/pages/MyRoutePage"));
const SharedRoutePage = lazyWithPreload(async () => {
  const module = await import("@/pages/SharedRoutePage");

  return {
    default: function SharedRoutePageRoute() {
      return <module.default />;
    },
  };
});
const MyAccountPage = lazyWithPreload(() => import("@/pages/MyAccountPage"));
const LanguageSettingsPage = lazyWithPreload(
  () => import("@/pages/LanguageSettingsPage")
);
const AppInfoPage = lazyWithPreload(() => import("@/pages/AppInfoPage"));
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

      <SharedRouteFilterBarSkeleton />

      <SharedRouteListLazySkeleton />
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

function HomeRouteFallback() {
  const text = useUiText();

  return (
    <main className="flex h-full items-center justify-center bg-brand-50 px-5 text-slate-900 dark:bg-[#071718] dark:text-slate-100">
      <section className="w-full max-w-sm">
        <PotatoLoadingCard
          title={text.routeShell.homeLoadingTitle}
          description={text.routeShell.homeLoadingDescription}
          animation="map-rendering"
          compact
          className="shadow-sm"
        />
      </section>
    </main>
  );
}

function MyInfoSubpageFallbackHeader({
  eyebrow,
  title,
}: {
  eyebrow: string;
  title: string;
}) {
  const navigate = useNavigate();
  const text = useUiText();

  return (
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
          {eyebrow}
        </p>
        <h1 className="truncate text-lg font-bold text-slate-900 dark:text-white">
          {title}
        </h1>
      </div>
    </header>
  );
}

function SharedRouteFilterBarSkeleton() {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="h-10 w-40 shrink-0 animate-pulse rounded-full bg-white shadow-sm ring-1 ring-brand-100 dark:bg-[#071f1d] dark:ring-brand-400/25" />
        <div className="h-10 min-w-0 flex-1 animate-pulse rounded-full bg-brand-50 ring-1 ring-brand-100 dark:bg-brand-400/15 dark:ring-brand-400/25" />
      </div>
    </div>
  );
}

function SharedRouteListLazySkeleton() {
  return (
    <div className="scrollbar-hide min-h-0 flex-1 space-y-3 overflow-y-auto px-px pb-4 pt-1">
      <RouteListSkeleton variant="shared" className="pt-0" />
    </div>
  );
}

function SharedRouteLazyFallback() {
  return (
    <section className="flex h-full min-h-0 flex-col gap-3">
      <SharedRouteFilterBarSkeleton />
      <SharedRouteListLazySkeleton />
    </section>
  );
}

function AccountLazyFallback() {
  const text = useUiText();

  return (
    <section className="space-y-4 pb-4 text-slate-900 dark:text-slate-100">
      <MyInfoSubpageFallbackHeader
        eyebrow={text.routeShell.myInfoTitle}
        title={text.routeShell.accountTitle}
      />

      <div className="rounded-2xl border border-brand-100 bg-white p-4 shadow-sm dark:border-brand-400/25 dark:bg-[#071f1d]">
        <div className="h-4 w-32 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
        <div className="mt-4 space-y-3">
          {["account-id", "password", "nickname"].map((fieldKey) => (
            <div key={fieldKey}>
              <div className="h-3 w-14 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800" />
              <div className="mt-1 h-12 animate-pulse rounded-xl border border-slate-200 bg-white dark:border-brand-400/20 dark:bg-[#0b211f]" />
            </div>
          ))}
        </div>
        <div className="mt-4 h-12 animate-pulse rounded-2xl bg-brand-100 dark:bg-brand-400/20" />
      </div>
    </section>
  );
}

function LanguageLazyFallback() {
  const text = useUiText();

  return (
    <section className="space-y-4 pb-4 text-slate-900 dark:text-slate-100">
      <MyInfoSubpageFallbackHeader
        eyebrow={text.routeShell.appSettings}
        title={text.routeShell.languageTitle}
      />

      <section className="space-y-3">
        {["ko", "en"].map((languageKey) => (
          <div
            key={languageKey}
            className="flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm dark:border-brand-400/20 dark:bg-[#0b211f]"
          >
            <div className="size-11 shrink-0 animate-pulse rounded-lg bg-brand-50 dark:bg-brand-400/10" />
            <div className="min-w-0 flex-1">
              <div className="h-4 w-28 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
              <div className="mt-2 h-3 w-full animate-pulse rounded-full bg-slate-100 dark:bg-slate-800" />
            </div>
            <div className="size-7 shrink-0 animate-pulse rounded-full border border-slate-200 bg-white dark:border-brand-400/25 dark:bg-[#071f1d]" />
          </div>
        ))}
      </section>

      <div className="space-y-2 px-1">
        <div className="h-3 w-full animate-pulse rounded-full bg-slate-100 dark:bg-slate-800" />
        <div className="h-3 w-2/3 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800" />
      </div>
    </section>
  );
}

function AppInfoLazyFallback() {
  const text = useUiText();
  const rowKeys = [
    "platform",
    "app-version",
    "build-number",
    "runtime-version",
    "os-version",
    "web-bundle-version",
    "update-channel",
    "bundle-id",
  ];

  return (
    <section className="space-y-4 pb-4 text-slate-900 dark:text-slate-100">
      <MyInfoSubpageFallbackHeader
        eyebrow={text.routeShell.appSettings}
        title={text.routeShell.appInfoTitle}
      />

      <section className="overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-sm dark:border-brand-400/25 dark:bg-[#071f1d]">
        <div className="border-b border-brand-50 px-4 py-3 dark:border-brand-400/15">
          <div className="h-3 w-14 animate-pulse rounded-full bg-brand-100 dark:bg-brand-400/20" />
        </div>
        {rowKeys.map((rowKey, index) => (
          <div key={rowKey}>
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="h-3 w-20 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800" />
              <div className="h-4 w-28 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
            </div>
            {index < rowKeys.length - 1 ? (
              <div className="border-b border-brand-50 dark:border-brand-400/15" />
            ) : null}
          </div>
        ))}
      </section>

      <div className="rounded-2xl border border-brand-100 bg-white p-4 shadow-sm dark:border-brand-400/25 dark:bg-[#071f1d]">
        <div className="flex gap-3">
          <div className="size-10 shrink-0 animate-pulse rounded-2xl bg-brand-50 dark:bg-brand-400/15" />
          <div className="min-w-0 flex-1">
            <div className="h-4 w-36 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
            <div className="mt-2 h-3 w-full animate-pulse rounded-full bg-slate-100 dark:bg-slate-800" />
            <div className="mt-2 h-3 w-2/3 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800" />
          </div>
        </div>
      </div>
    </section>
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
  preloadRoutes([
    MyRoutePage,
    SharedRoutePage,
    MyRouteHistoryPage,
    LikedSharedRoutePage,
    MyAccountPage,
    LanguageSettingsPage,
    AppInfoPage,
  ]);
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
          <Route
            path="/home"
            element={withRouteSuspense(<HomePage />, <HomeRouteFallback />)}
          />
          <Route
            path="/my-route"
            element={
              <RoutePageShell
                icon={<MdOutlineRoute />}
                title={text.routeShell.myRouteTitle}
                description={text.routeShell.myRouteDescription}
              >
                {withRouteSuspense(
                  <MyRoutePage />,
                  <RouteListSkeleton variant="my-route" />
                )}
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
                {withRouteSuspense(
                  <SharedRoutePage />,
                  <SharedRouteLazyFallback />
                )}
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
            element={withRouteSuspense(
              <MyAccountPage />,
              <AccountLazyFallback />
            )}
          />
          <Route
            path="/me/language"
            element={withRouteSuspense(
              <LanguageSettingsPage />,
              <LanguageLazyFallback />
            )}
          />
          <Route
            path="/me/app-info"
            element={withRouteSuspense(
              <AppInfoPage />,
              <AppInfoLazyFallback />
            )}
          />
        </Route>
      </Routes>
    </Router>
  );
}

export default AppRouter;
