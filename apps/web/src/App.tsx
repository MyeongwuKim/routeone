import { lazy, Suspense, useEffect } from "react";
import AppRouter from "./router/AppRouter";
import GlobalModal from "./components/feedback/GlobalModal";
import TopToast from "./components/feedback/TopToast";
import PotatoLoadingOverlay from "./components/feedback/PotatoLoadingOverlay";
import { initializeUiTheme } from "./stores/uiThemeStore";

const PlaceBottomSheet = lazy(
  () => import("./features/place-sheet/components/PlaceBottomSheet")
);

function App() {
  useEffect(() => {
    initializeUiTheme();
  }, []);

  return (
    <>
      <GlobalModal />
      <TopToast />
      <PotatoLoadingOverlay />
      <AppRouter />
      <Suspense fallback={null}>
        <PlaceBottomSheet />
      </Suspense>
    </>
  );
}

export default App;
