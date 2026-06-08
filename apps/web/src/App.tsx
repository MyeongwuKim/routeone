import AppRouter from "./router/AppRouter";
import TopToast from "./components/feedback/TopToast";
import PotatoLoadingOverlay from "./components/feedback/PotatoLoadingOverlay";

function App() {
  return (
    <>
      <TopToast />
      <PotatoLoadingOverlay />
      <AppRouter />
    </>
  );
}

export default App;
