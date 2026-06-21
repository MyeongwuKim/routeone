import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import BottomTabLayout from "@/layouts/BottomTabLayout";
import HomePage from "@/pages/HomePage";
import LoginPage from "@/pages/LoginPage";
import MyAccountPage from "@/pages/MyAccountPage";
import MyInfoPage from "@/pages/MyInfoPage";
import MyRouteHistoryPage from "@/pages/MyRouteHistoryPage";
import MyRoutePage from "@/pages/MyRoutePage";
import SharedRoutePage from "@/pages/SharedRoutePage";
import { getAuthToken } from "@/lib/authToken";

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

  return <LoginPage />;
}

function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginRoute />} />
        <Route element={<RequireAuth />}>
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/my-route" element={<MyRoutePage />} />
          <Route path="/shared-route" element={<SharedRoutePage />} />
          <Route path="/me" element={<MyInfoPage />} />
          <Route path="/me/routes" element={<MyRouteHistoryPage />} />
          <Route path="/me/account" element={<MyAccountPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default AppRouter;
