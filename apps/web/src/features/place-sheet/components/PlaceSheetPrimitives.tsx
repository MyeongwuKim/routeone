import { useState } from "react";
import {
  IoCalendarClearOutline,
  IoCallOutline,
  IoTimeOutline,
} from "react-icons/io5";

export function PlacePhotoThumbnail({
  thumbnailUrl,
  imageUrl,
  alt,
}: {
  thumbnailUrl?: string | null;
  imageUrl: string;
  alt: string;
}) {
  const [useOriginalImage, setUseOriginalImage] = useState(!thumbnailUrl);
  const source = useOriginalImage || !thumbnailUrl ? imageUrl : thumbnailUrl;

  return (
    <img
      src={source}
      alt={alt}
      className="h-full w-full object-cover transition duration-200 group-active:scale-95"
      loading="lazy"
      onError={() => {
        if (!useOriginalImage && thumbnailUrl !== imageUrl) {
          setUseOriginalImage(true);
        }
      }}
    />
  );
}

export function PlaceInfoRow({
  label,
  value,
  icon = "time",
}: {
  label: string;
  value: string;
  icon?: "time" | "calendar" | "call";
}) {
  if (!value) {
    return null;
  }

  return (
    <div className="flex min-h-16 items-center gap-3 rounded-2xl border border-brand-100 bg-brand-50/70 px-3 py-3 text-xs dark:border-brand-400/25 dark:bg-slate-950/35">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-base text-brand-600 shadow-sm dark:bg-brand-400/15 dark:text-brand-200">
        {icon === "call" ? (
          <IoCallOutline />
        ) : icon === "calendar" ? (
          <IoCalendarClearOutline />
        ) : (
          <IoTimeOutline />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-black text-brand-700 dark:text-brand-200">{label}</p>
        <p className="mt-1 line-clamp-2 leading-5 text-slate-600 dark:text-slate-300">
          {value}
        </p>
      </div>
    </div>
  );
}

export function SkeletonBar({
  className,
  rounded = "rounded-full",
}: {
  className: string;
  rounded?: string;
}) {
  return (
    <span
      className={`skeleton-shimmer block bg-slate-200 dark:bg-slate-700 ${rounded} ${className}`}
    />
  );
}

export function ImageStripSkeleton() {
  return (
    <>
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className="h-44 w-40 shrink-0 snap-start rounded-2xl border border-brand-100 bg-white p-3 dark:border-brand-400/25 dark:bg-slate-900"
        >
          <SkeletonBar className="h-full w-full" rounded="rounded-xl" />
        </div>
      ))}
    </>
  );
}

export function OverviewSkeleton() {
  return (
    <div className="rounded-2xl border border-brand-100 bg-brand-50/45 px-3 py-4 dark:border-brand-400/25 dark:bg-slate-950/45">
      <div className="space-y-3">
        <SkeletonBar className="h-4 w-full" />
        <SkeletonBar className="h-4 w-[92%]" />
        <SkeletonBar className="h-4 w-[86%]" />
        <SkeletonBar className="h-4 w-[94%]" />
        <SkeletonBar className="h-4 w-[62%]" />
      </div>
    </div>
  );
}

export function RouteInfoSkeleton() {
  return (
    <div className="flex items-center gap-3">
      <SkeletonBar className="h-8 w-8 shrink-0" />
      <div className="min-w-0 flex-1 space-y-2">
        <SkeletonBar className="h-3 w-3/4" />
        <SkeletonBar className="h-3 w-1/2" />
      </div>
    </div>
  );
}

export function NearbyPlacesSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className="flex items-center gap-3 rounded-2xl border border-brand-100 bg-white px-3 py-3 dark:border-brand-400/25 dark:bg-slate-950/40"
        >
          <SkeletonBar className="h-16 w-16 shrink-0" rounded="rounded-xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <SkeletonBar className="h-4 w-2/3" />
            <SkeletonBar className="h-3 w-1/3" />
            <SkeletonBar className="h-3 w-5/6" />
          </div>
          <SkeletonBar className="h-4 w-10 shrink-0" />
        </div>
      ))}
    </div>
  );
}

export function CompactHoursBadge({ value }: { value: string }) {
  if (!value) {
    return null;
  }

  return (
    <span className="inline-flex max-w-[10rem] items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-black text-brand-700 ring-1 ring-brand-100 dark:bg-brand-400/15 dark:text-brand-100 dark:ring-brand-400/25">
      <IoTimeOutline className="shrink-0 text-sm" />
      <span className="truncate">{value}</span>
    </span>
  );
}
