import { lazy, Suspense, useEffect } from "react";
import AppRouter from "./router/AppRouter";
import GlobalModal from "./components/feedback/GlobalModal";
import PlaceLocalizationStatus from "./components/feedback/PlaceLocalizationStatus";
import TopToast from "./components/feedback/TopToast";
import PotatoLoadingOverlay from "./components/feedback/PotatoLoadingOverlay";
import { usePlaceCartLanguageSync } from "./features/route-checkout/hooks/usePlaceCartLanguageSync";
import { nativeBridge } from "./native-bridge";
import { useCurrentPositionStore } from "./stores/currentPositionStore";
import { initializeUiTheme } from "./stores/uiThemeStore";

const PlaceBottomSheet = lazy(
  () => import("./features/place-sheet/components/PlaceBottomSheet")
);

function App() {
  usePlaceCartLanguageSync();
  const requestCurrentPosition = useCurrentPositionStore(
    (state) => state.requestCurrentPosition
  );

  useEffect(() => {
    initializeUiTheme();
  }, []);

  useEffect(() => {
    if (!nativeBridge.runtime.isAvailable()) {
      return;
    }

    void requestCurrentPosition().catch(() => undefined);

    return nativeBridge.events.subscribeAppActive(() => {
      void requestCurrentPosition({ forceRefresh: true }).catch(
        () => undefined
      );
    });
  }, [requestCurrentPosition]);

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
