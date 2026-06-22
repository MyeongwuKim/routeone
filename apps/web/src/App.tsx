import { useEffect } from "react";
import AppRouter from "./router/AppRouter";
import GlobalModal from "./components/feedback/GlobalModal";
import TopToast from "./components/feedback/TopToast";
import PotatoLoadingOverlay from "./components/feedback/PotatoLoadingOverlay";
import PlaceBottomSheet from "./features/place-sheet/components/PlaceBottomSheet";
import { initializeUiTheme } from "./stores/uiThemeStore";

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
      <PlaceBottomSheet />
    </>
  );
}

export default App;
