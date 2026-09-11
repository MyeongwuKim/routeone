/**
 * 사용 위치: 장소 상세 → 사용자 사진 목록
 *
 * 용도:
 * 방문 사진을 보여주고 내 사진 여부와 신고 상태에 따라 신고 또는 신고 취소 동작을 제공한다.
 *
 * 구조:
 * 사진 미리보기, 방문 사진 배지, 신고 버튼과 신고자 전용 블러 안내로 구성되어 있다.
 */
import { MdFlag } from "react-icons/md";
import type { PlacePhotosQuery } from "@/generated/graphql";
import type { UiText } from "@/lib/uiText";
import { PlacePhotoThumbnail } from "@/features/place-sheet/components/PlaceSheetPrimitives";

type PlacePhoto = PlacePhotosQuery["placePhotos"][number];

type ReportablePlacePhotoCardProps = {
  alt: string;
  isCanceling: boolean;
  onCancelReport: () => void;
  onOpen: () => void;
  onReport: () => void;
  photo: PlacePhoto;
  text: UiText;
};

function ReportablePlacePhotoCard({
  alt,
  isCanceling,
  onCancelReport,
  onOpen,
  onReport,
  photo,
  text,
}: ReportablePlacePhotoCardProps) {
  return (
    <div className="group relative h-44 w-40 shrink-0 snap-start overflow-hidden rounded-2xl border border-brand-100 bg-brand-50 text-left shadow-sm">
      <button
        type="button"
        onClick={photo.reportedByMe ? undefined : onOpen}
        disabled={photo.reportedByMe}
        className="h-full w-full cursor-zoom-in disabled:cursor-default"
      >
        <span className={`block h-full w-full ${photo.reportedByMe ? "scale-110 blur-xl" : ""}`}>
          <PlacePhotoThumbnail
            thumbnailUrl={photo.thumbnailUrl}
            imageUrl={photo.imageUrl}
            alt={alt}
          />
        </span>
      </button>

      {photo.reportedByMe ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/35 px-3 text-center text-white">
          <MdFlag className="text-xl" />
          <span className="mt-1 text-xs font-black">{text.photoReport.reportedPhoto}</span>
          <button
            type="button"
            onClick={onCancelReport}
            disabled={isCanceling}
            className="mt-3 rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-black text-slate-800 disabled:opacity-60"
          >
            {text.photoReport.cancelReport}
          </button>
        </div>
      ) : (
        <>
          <span className="pointer-events-none absolute bottom-2 left-2 rounded-full bg-slate-950/60 px-2 py-1 text-[10px] font-black text-white backdrop-blur">
            {text.placeSheet.visitPhoto}
          </span>
          {!photo.isMine ? (
            <button
              type="button"
              aria-label={text.photoReport.report}
              onClick={onReport}
              className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-slate-950/65 text-base text-white shadow backdrop-blur hover:bg-rose-600"
            >
              <MdFlag />
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}

export default ReportablePlacePhotoCard;
