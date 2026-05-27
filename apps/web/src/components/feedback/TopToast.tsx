import { IoBagHandleOutline } from "react-icons/io5";
import { useUiToastStore } from "../../stores/uiToastStore";

function TopToast() {
  const { message, isVisible } = useUiToastStore();

  if (!message) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-[2600] flex justify-center px-4">
      <div
        className={`flex items-center rounded-full border border-brand-300 bg-white/95 px-4 py-2 text-sm font-semibold text-brand-800 shadow-lg backdrop-blur transition-[transform,opacity,filter] duration-420 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform ${
          isVisible ? "scale-100 opacity-100 blur-0" : "scale-95 opacity-0 blur-[1px]"
        }`}
      >
        <IoBagHandleOutline className="mr-2 text-base" />
        <span>{message}</span>
      </div>
    </div>
  );
}

export default TopToast;
