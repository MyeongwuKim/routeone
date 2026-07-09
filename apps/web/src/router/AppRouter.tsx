import { lazy, Suspense, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import BottomTabLayout from "@/layouts/BottomTabLayout";
import { getAuthToken } from "@/lib/authToken";

const HomePage = lazy(() => import("@/pages/HomePage"));
const AppInfoPage = lazy(() => import("@/pages/AppInfoPage"));
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const MyAccountPage = lazy(() => import("@/pages/MyAccountPage"));
const MyInfoPage = lazy(() => import("@/pages/MyInfoPage"));
const MyRouteHistoryPage = lazy(
  () => import("@/features/my-route/pages/MyRouteHistoryPage")
);
const LikedSharedRoutePage = lazy(
  () => import("@/features/shared-route/pages/LikedSharedRoutePage")
);
const MyRoutePage = lazy(() => import("@/pages/MyRoutePage"));
const SharedRoutePage = lazy(() => import("@/pages/SharedRoutePage"));

function RouteLoadingFallback() {
  return (
    <div className="flex h-full min-h-64 items-center justify-center px-5 text-sm font-black text-brand-700 dark:text-brand-100">
      불러오는 중...
    </div>
  );
}

function withRouteSuspense(children: ReactNode) {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>{children}</Suspense>
  );
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

  return withRouteSuspense(<LoginPage />);
}

function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginRoute />} />
        <Route element={<RequireAuth />}>
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/home" element={withRouteSuspense(<HomePage />)} />
          <Route
            path="/my-route"
            element={withRouteSuspense(<MyRoutePage />)}
          />
          <Route
            path="/shared-route"
            element={withRouteSuspense(<SharedRoutePage />)}
          />
          <Route path="/me" element={withRouteSuspense(<MyInfoPage />)} />
          <Route
            path="/me/routes"
            element={withRouteSuspense(<MyRouteHistoryPage />)}
          />
          <Route
            path="/me/liked-routes"
            element={withRouteSuspense(<LikedSharedRoutePage />)}
          />
          <Route
            path="/me/account"
            element={withRouteSuspense(<MyAccountPage />)}
          />
          <Route
            path="/me/app-info"
            element={withRouteSuspense(<AppInfoPage />)}
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default AppRouter;
