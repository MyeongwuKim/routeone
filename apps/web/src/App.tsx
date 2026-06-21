import AppRouter from "./router/AppRouter";
import GlobalModal from "./components/feedback/GlobalModal";
import TopToast from "./components/feedback/TopToast";
import PotatoLoadingOverlay from "./components/feedback/PotatoLoadingOverlay";

function App() {
  return (
    <>
      <GlobalModal />
      <TopToast />
      <PotatoLoadingOverlay />
      <AppRouter />
    </>
  );
}

export default App;
