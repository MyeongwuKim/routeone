/**
 * 사용 위치: 내 루트 → DAY 상세 → 장소 카드 하단
 *
 * 용도:
 * 사진 보기·추가와 지도·길찾기를 같은 높이의 버튼 영역에 모아 둔다.
 * 사진 유무에 따라 같은 자리의 버튼만 바꾸고 GPS 테스트는 별도 줄에 표시한다.
 */
import {
  MdGpsFixed,
  MdImage,
  MdLockOutline,
  MdMap,
  MdPublic,
} from "react-icons/md";
import { useUiText } from "@/lib/uiText";

export type RouteStopPhotoAction = {
  label: string;
  ariaLabel: string;
  photoUrl: string | null;
  publicationStatus: "public" | "private" | null;
  onClick: () => void;
};

type RouteStopActionsProps = {
  placeTitle: string;
  photoAction: RouteStopPhotoAction | null;
  isPhotoSaving: boolean;
  isActiveDestination: boolean;
  isGpsTestLocationActive: boolean;
  onOpenDirections: () => void;
  onOpenGpsTest?: () => void;
};

function RouteStopActions({
  placeTitle,
  photoAction,
  isPhotoSaving,
  isActiveDestination,
  isGpsTestLocationActive,
  onOpenDirections,
  onOpenGpsTest,
}: RouteStopActionsProps) {
  const text = useUiText();
  const actionClass =
    "inline-flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-black transition active:scale-[0.99] disabled:opacity-50";

  return (
    <div className="mt-3 space-y-2">
      <div className={`grid gap-2 ${photoAction ? "grid-cols-2" : "grid-cols-1"}`}>
        {photoAction ? (
          <button
            type="button"
            aria-label={photoAction.ariaLabel}
            disabled={isPhotoSaving}
            onClick={(event) => {
              event.stopPropagation();
              photoAction.onClick();
            }}
            className={`${actionClass} border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100`}
          >
            {isPhotoSaving ? (
              <span className="size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : photoAction.photoUrl ? (
              <span className="relative size-5 shrink-0 rounded-md bg-white ring-1 ring-white/80">
                <img
                  src={photoAction.photoUrl}
                  alt=""
                  className="h-full w-full rounded-md object-cover"
                  loading="lazy"
                />
                {photoAction.publicationStatus ? (
                  <span
                    aria-label={
                      photoAction.publicationStatus === "public"
                        ? text.dayRoute.photoPublished
                        : text.dayRoute.photoPrivate
                    }
                    className={`absolute -bottom-0.5 -right-0.5 flex size-3 items-center justify-center rounded-full text-[8px] text-white ring-1 ring-white dark:ring-[#0b211f] ${
                      photoAction.publicationStatus === "public"
                        ? "bg-emerald-700"
                        : "bg-slate-600"
                    }`}
                  >
                    {photoAction.publicationStatus === "public" ? (
                      <MdPublic />
                    ) : (
                      <MdLockOutline />
                    )}
                  </span>
                ) : null}
              </span>
            ) : (
              <MdImage className="shrink-0 text-base" />
            )}
            <span className="min-w-0 break-keep">{photoAction.label}</span>
          </button>
        ) : null}
        <button
          type="button"
          aria-label={text.dayRoute.openPlaceDirectionsAria(placeTitle)}
          onClick={(event) => {
            event.stopPropagation();
            onOpenDirections();
          }}
          className={`${actionClass} ${
            isActiveDestination
              ? "border-brand-600 bg-brand-600 text-white shadow-sm"
              : "border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-400/30 dark:bg-brand-400/10 dark:text-brand-100"
          }`}
        >
          <MdMap className="shrink-0 text-base" />
          <span className="min-w-0 break-keep">{text.dayRoute.placeDirections}</span>
        </button>
      </div>
      {onOpenGpsTest ? (
        <div className="flex justify-end">
          <button
            type="button"
            aria-label={text.dayRoute.gpsTestOpenAria(placeTitle)}
            onClick={(event) => {
              event.stopPropagation();
              onOpenGpsTest();
            }}
            className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1.5 text-[11px] font-black ring-1 transition active:scale-95 ${
              isGpsTestLocationActive
                ? "bg-violet-600 text-white ring-violet-600"
                : "bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-400/10 dark:text-violet-100 dark:ring-violet-400/30"
            }`}
          >
            <MdGpsFixed className="text-sm" />
            {isGpsTestLocationActive
              ? text.dayRoute.gpsTestActiveButton
              : text.dayRoute.gpsTestButton}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default RouteStopActions;
