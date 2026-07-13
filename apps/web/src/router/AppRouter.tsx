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
import HomePage from "@/pages/HomePage";
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

const AppInfoPage = lazyWithPreload(() => import("@/pages/AppInfoPage"));
const LanguageSettingsPage = lazyWithPreload(
  () => import("@/pages/LanguageSettingsPage")
);
const LoginPage = lazyWithPreload(() => import("@/pages/LoginPage"));
const MyAccountPage = lazyWithPreload(() => import("@/pages/MyAccountPage"));
const MyRouteHistoryPage = lazyWithPreload(
  () => import("@/features/my-route/pages/MyRouteHistoryPage")
);
const LikedSharedRoutePage = lazyWithPreload(
  () => import("@/features/shared-route/pages/LikedSharedRoutePage")
);

type RouteBodyFallbackProps = {
  loadingTitle?: string;
  loadingDescription?: string;
};

function RouteBodyFallback({
  loadingTitle = "화면 준비 중",
  loadingDescription = "감자가 화면 조각을 맞추고 있어요.",
}: RouteBodyFallbackProps) {
  return (
    <div className="flex min-h-[calc(100dvh-18rem)] flex-col justify-center">
      <PotatoLoadingCard
        title={loadingTitle}
        description={loadingDescription}
        animation="running"
        compact
        className="w-full shadow-sm"
      />
    </div>
  );
}

type RoutePageShellProps = {
  icon: ReactNode;
  title: string;
  description?: string;
  loadingTitle?: string;
  loadingDescription?: string;
  children: ReactNode;
};

function RoutePageShell({
  icon,
  title,
  description,
  loadingTitle,
  loadingDescription,
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
        {withRouteSuspense(
          children,
          <RouteBodyFallback
            loadingTitle={loadingTitle}
            loadingDescription={loadingDescription}
          />
        )}
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
  loadingTitle = "화면 준비 중",
  loadingDescription = "감자가 화면 조각을 맞추고 있어요.",
}: RoutePageFallbackProps) {
  const navigate = useNavigate();

  return (
    <section className="flex min-h-full flex-col gap-4 pb-4 text-slate-900 dark:text-slate-100">
      {showBackPlaceholder ? (
        <header className="flex items-center gap-3">
          <button
            type="button"
            aria-label="이전 화면으로 돌아가기"
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
          title={loadingTitle}
          description={loadingDescription}
          animation="running"
          compact
          className="w-full shadow-sm"
        />
      </div>
    </section>
  );
}

function HomeRouteFallback() {
  return (
    <section className="flex h-full items-center justify-center bg-brand-50 px-5 dark:bg-slate-950">
      <div className="w-full max-w-md">
        <PotatoLoadingCard
          title="지도 화면 준비 중"
          description="주변 장소와 루트 화면을 맞추고 있어요."
          animation="map-rendering"
          compact
          className="shadow-sm"
        />
      </div>
    </section>
  );
}

function LoginRouteFallback() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-brand-50 px-5 py-8 text-slate-900">
      <section className="w-full max-w-md">
        <PotatoLoadingCard
          title="로그인 화면 준비 중"
          description="계정 화면을 맞추고 있어요."
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
  preloadRoutes([
    MyRouteHistoryPage,
    LikedSharedRoutePage,
    MyAccountPage,
    AppInfoPage,
    LanguageSettingsPage,
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
                title="나의 여행 루트"
                description="현재 루트와 다가오는 일정을 한곳에서 확인해요"
                loadingTitle="감자가 내 루트 확인 중"
                loadingDescription="여행 일정을 정리하고 있어요."
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
                title="공유 루트"
                description="완료한 여행 루트를 모아보는 피드"
                loadingTitle="공유 루트 찾는 중"
                loadingDescription=""
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
                title="내 정보"
                description="계정과 다녀온 루트를 관리하는 메뉴"
                loadingTitle="계정 확인 중"
                loadingDescription=""
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
                eyebrow="내 정보"
                title="다녀온 루트"
                showBackPlaceholder
                loadingTitle="기록 찾는 중"
                loadingDescription=""
              />
            )}
          />
          <Route
            path="/me/liked-routes"
            element={withRouteSuspense(
              <LikedSharedRoutePage />,
              <RoutePageFallback
                eyebrow="내 정보"
                title="좋아요한 공유 루트"
                showBackPlaceholder
                loadingTitle="하트 루트 찾는 중"
                loadingDescription=""
              />
            )}
          />
          <Route
            path="/me/account"
            element={withRouteSuspense(
              <MyAccountPage />,
              <RoutePageFallback
                eyebrow="내 정보"
                title="계정 전환"
                showBackPlaceholder
              />
            )}
          />
          <Route
            path="/me/language"
            element={withRouteSuspense(
              <LanguageSettingsPage />,
              <RoutePageFallback
                eyebrow="앱 설정"
                title="언어 설정"
                showBackPlaceholder
              />
            )}
          />
          <Route
            path="/me/app-info"
            element={withRouteSuspense(
              <AppInfoPage />,
              <RoutePageFallback
                eyebrow="앱 설정"
                title="버전 정보"
                showBackPlaceholder
              />
            )}
          />
        </Route>
      </Routes>
    </Router>
  );
}

export default AppRouter;
