/**
 * 용도:
 * 홈 지도와 장소 길찾기에서 위치 권한이 꺼진 이유와 설정 버튼을 보여준다.
 *
 * 구조:
 * 위치 아이콘, 안내 문구, 앱 설정으로 이동하는 버튼으로 구성되어 있다.
 */
import { MdLocationOff } from "react-icons/md";
import type { UiText } from "@/lib/uiText";
import { openNativeAppSettings } from "@/native-bridge/permissions";
import { useUiToastStore } from "@/stores/uiToastStore";

type LocationPermissionNoticeProps = {
  text: UiText;
};

function LocationPermissionNotice({ text }: LocationPermissionNoticeProps) {
  const handleOpenSettings = () => {
    if (!openNativeAppSettings()) {
      useUiToastStore.getState().showToast(text.locationPermission.settingsError);
    }
  };

  return (
    <div className="rounded-2xl border border-brand-200 bg-white/95 p-4 shadow-sm backdrop-blur dark:border-brand-400/30 dark:bg-slate-900/95">
      <div className="flex items-start gap-3" role="status" aria-live="polite">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xl text-brand-600 dark:bg-brand-400/15 dark:text-brand-200">
          <MdLocationOff aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            {text.locationPermission.title}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
            {text.locationPermission.description}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={handleOpenSettings}
        className="mt-3 min-h-11 w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white transition active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      >
        {text.locationPermission.openSettings}
      </button>
    </div>
  );
}

export default LocationPermissionNotice;
