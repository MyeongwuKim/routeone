import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import BottomTabLayout from "../layouts/BottomTabLayout";
import HomePage from "../pages/HomePage";
import MyInfoPage from "../pages/MyInfoPage";
import MyRoutePage from "../pages/MyRoutePage";
import SharedRoutePage from "../pages/SharedRoutePage";

function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<BottomTabLayout />}>
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/my-route" element={<MyRoutePage />} />
          <Route path="/shared-route" element={<SharedRoutePage />} />
          <Route path="/me" element={<MyInfoPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default AppRouter;
