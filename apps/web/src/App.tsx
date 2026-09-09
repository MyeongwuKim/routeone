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
