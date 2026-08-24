import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import {
  IoCalendarClearOutline,
  IoCallOutline,
  IoChevronDown,
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
  const [expandedValue, setExpandedValue] = useState<string | null>(null);
  const [canExpand, setCanExpand] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<{
    left: number;
    maxHeight: number;
    top: number;
    width: number;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const valueRef = useRef<HTMLSpanElement | null>(null);
  const tooltipId = useId();
  const isExpanded = expandedValue === value;

  useLayoutEffect(() => {
    const valueElement = valueRef.current;

    if (!valueElement) {
      return;
    }

    const updateCanExpand = () => {
      setCanExpand(valueElement.scrollWidth > valueElement.clientWidth + 1);
    };

    updateCanExpand();

    const resizeObserver = new ResizeObserver(updateCanExpand);
    resizeObserver.observe(valueElement);

    return () => resizeObserver.disconnect();
  }, [value]);

  useLayoutEffect(() => {
    if (!isExpanded) {
      return;
    }

    const updateTooltipPosition = () => {
      const buttonElement = buttonRef.current;

      if (!buttonElement) {
        return;
      }

      const viewportMargin = 16;
      const preferredWidth = 288;
      const buttonRect = buttonElement.getBoundingClientRect();
      const width = Math.min(
        preferredWidth,
        window.innerWidth - viewportMargin * 2
      );
      const centeredLeft =
        buttonRect.left + buttonRect.width / 2 - width / 2;
      const left = Math.max(
        viewportMargin,
        Math.min(
          centeredLeft,
          window.innerWidth - viewportMargin - width
        )
      );
      const top = buttonRect.bottom + 8;

      setTooltipPosition({
        left,
        maxHeight: Math.max(96, window.innerHeight - top - viewportMargin),
        top,
        width,
      });
    };

    updateTooltipPosition();
    window.addEventListener("resize", updateTooltipPosition);
    window.addEventListener("scroll", updateTooltipPosition, true);

    return () => {
      window.removeEventListener("resize", updateTooltipPosition);
      window.removeEventListener("scroll", updateTooltipPosition, true);
    };
  }, [isExpanded, value]);

  useEffect(() => {
    if (!isExpanded) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !containerRef.current?.contains(event.target)
      ) {
        setExpandedValue(null);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setExpandedValue(null);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isExpanded]);

  if (!value) {
    return null;
  }

  return (
    <div ref={containerRef} className="relative inline-flex min-w-0">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={canExpand ? isExpanded : undefined}
        aria-describedby={isExpanded ? tooltipId : undefined}
        disabled={!canExpand}
        title={!isExpanded && canExpand ? value : undefined}
        onClick={() =>
          setExpandedValue((currentValue) =>
            currentValue === value ? null : value
          )
        }
        className={`inline-flex max-w-[10rem] items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-black text-brand-700 ring-1 ring-brand-100 transition active:scale-[0.98] dark:bg-brand-400/15 dark:text-brand-100 dark:ring-brand-400/25 ${
          canExpand ? "cursor-pointer" : "cursor-default"
        }`}
      >
        <IoTimeOutline className="shrink-0 text-sm" />
        <span ref={valueRef} className="min-w-0 truncate">
          {value}
        </span>
        {canExpand ? (
          <IoChevronDown
            aria-hidden="true"
            className={`shrink-0 text-xs transition-transform ${
              isExpanded ? "rotate-180" : ""
            }`}
          />
        ) : null}
      </button>
      {isExpanded && tooltipPosition ? (
        <div
          id={tooltipId}
          role="tooltip"
          style={tooltipPosition}
          className="fixed z-[3450] flex items-start gap-2 overflow-y-auto rounded-2xl border border-brand-200 bg-white px-3 py-2.5 text-left text-xs font-semibold leading-5 text-slate-700 shadow-xl dark:border-brand-400/35 dark:bg-[#0b211f] dark:text-slate-100"
        >
          <IoTimeOutline className="mt-0.5 shrink-0 text-base text-brand-600 dark:text-brand-200" />
          <span className="min-w-0 whitespace-pre-line break-words">
            {value}
          </span>
        </div>
      ) : null}
    </div>
  );
}
