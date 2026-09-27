/**
 * 용도:
 * 웹 앱의 전역 상태 동기화와 공통 UI를 연결하고 라우터를 렌더링한다.
 *
 * 구조:
 * 네이티브 연동 조정자, 공통 피드백 UI, 앱 라우터로 구성되어 있다.
 */
import { lazy, Suspense, useEffect } from "react";
import AppRouter from "./router/AppRouter";
import GlobalModal from "./components/feedback/GlobalModal";
import PlaceLocalizationStatus from "./components/feedback/PlaceLocalizationStatus";
import TopToast from "./components/feedback/TopToast";
import PotatoLoadingOverlay from "./components/feedback/PotatoLoadingOverlay";
import { usePlaceCartLanguageSync } from "./features/route-checkout/hooks/usePlaceCartLanguageSync";
import { startNativePermissionSync } from "./native-bridge/permissionSync";
import { initializeUiTheme } from "./stores/uiThemeStore";

const PlaceBottomSheet = lazy(
  () => import("./features/place-sheet/components/PlaceBottomSheet")
);

function App() {
  usePlaceCartLanguageSync();

  useEffect(() => {
    initializeUiTheme();
  }, []);

  useEffect(startNativePermissionSync, []);

  return (
    <>
      <GlobalModal />
      <TopToast />
      <PlaceLocalizationStatus />
      <PotatoLoadingOverlay />
      <AppRouter />
      <Suspense fallback={null}>
        <PlaceBottomSheet />
      </Suspense>
    </>
  );
}

export default App;
