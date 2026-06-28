import { useState } from "react";
import { FaHeart, FaRegHeart } from "react-icons/fa";
import { MdOutlineCalendarToday, MdSell } from "react-icons/md";
import type {
  LikedSharedRoutesQuery,
  RouteSummaryFieldsFragment,
  SharedRoutesQuery,
} from "@/generated/graphql";

const VISIBLE_SHARE_TAG_COUNT = 3;
const GANGWON_REGION_LABEL_BY_CODE: Record<string, string> = {
  "1": "강릉",
  "2": "고성",
  "3": "동해",
  "4": "삼척",
  "5": "속초",
  "6": "양구",
  "7": "양양",
  "8": "영월",
  "9": "원주",
  "10": "인제",
  "11": "정선",
  "12": "철원",
  "13": "춘천",
  "14": "태백",
  "15": "평창",
  "16": "홍천",
  "17": "화천",
  "18": "횡성",
  "51150": "강릉",
  "51820": "고성",
  "51170": "동해",
  "51230": "삼척",
  "51210": "속초",
  "51800": "양구",
  "51830": "양양",
  "51750": "영월",
  "51130": "원주",
  "51810": "인제",
  "51770": "정선",
  "51780": "철원",
  "51110": "춘천",
  "51190": "태백",
  "51760": "평창",
  "51720": "홍천",
  "51790": "화천",
  "51730": "횡성",
};
const REGION_SHARE_TAGS = new Set([
  "강원",
  ...Object.values(GANGWON_REGION_LABEL_BY_CODE),
]);

type SharedRoute =
  | SharedRoutesQuery["sharedRoutes"][number]
  | LikedSharedRoutesQuery["likedRoutes"][number];

type SharedRouteCardProps = {
  route: SharedRoute;
  isLiked: boolean;
  isLikePending?: boolean;
  onToggleLike: (route: RouteSummaryFieldsFragment) => void | Promise<void>;
  onOpen?: (route: SharedRoute) => void;
};

function formatRouteDate(value: string | null) {
  const dateKey = value?.slice(0, 10);

  if (!dateKey) {
    return null;
  }

  const [, month, day] = dateKey.split("-");
  return `${Number(month)}.${Number(day)}`;
}

function getRouteDateTitle(route: RouteSummaryFieldsFragment) {
  const startDate = formatRouteDate(route.travelStartDate);
  const endDate = formatRouteDate(route.travelEndDate);

  if (!startDate) {
    return null;
  }

  if (!endDate || startDate === endDate) {
    return startDate;
  }

  return `${startDate} ~ ${endDate}`;
}

function getRegionCode(
  regionLabelKey?: string | null,
  regionCode?: string | null
) {
  const [areaCodeOrSigunguCode, sigunguCode] = regionLabelKey?.split(":") ?? [];

  return (
    sigunguCode ??
    regionCode ??
    (areaCodeOrSigunguCode &&
    GANGWON_REGION_LABEL_BY_CODE[areaCodeOrSigunguCode]
      ? areaCodeOrSigunguCode
      : null)
  );
}

function getRegionName(
  regionLabelKey?: string | null,
  regionCode?: string | null
) {
  const code = getRegionCode(regionLabelKey, regionCode);

  return code ? GANGWON_REGION_LABEL_BY_CODE[code] : null;
}

function getRouteRegionTitle(route: SharedRoute) {
  const regionNames: string[] = [];
  const appendRegionName = (regionName: string | null) => {
    if (regionName && !regionNames.includes(regionName)) {
      regionNames.push(regionName);
    }
  };

  (route.stops ?? []).forEach((stop) => {
    appendRegionName(
      getRegionName(stop.place.regionLabelKey, stop.place.regionCode)
    );
  });

  if (regionNames.length === 0) {
    appendRegionName(
      getRegionName(route.primaryRegionLabelKey, route.primaryRegionCode)
    );
  }

  if (regionNames.length === 0) {
    return "공유";
  }

  const visibleRegionNames = regionNames.slice(0, 2).join("+");

  return regionNames.length > 2
    ? `${visibleRegionNames} 외 ${regionNames.length - 2}`
    : visibleRegionNames;
}

function getSharedRouteTitle(route: SharedRoute) {
  const dateTitle = getRouteDateTitle(route);
  const regionTitle = getRouteRegionTitle(route);

  return dateTitle ? `${dateTitle} ${regionTitle} 루트` : `${regionTitle} 루트`;
}

function getSharedRouteSubtitle(route: RouteSummaryFieldsFragment) {
  const durationText =
    route.tripDays <= 1
      ? "당일치기"
      : `${route.tripDays - 1}박 ${route.tripDays}일`;

  return `${durationText} · ${route.completedStopCount}/${route.totalStopCount} 완료`;
}

function getFallbackShareTags(route: RouteSummaryFieldsFragment) {
  const tags = [
    route.tripDays <= 1
      ? "당일치기"
      : `${route.tripDays - 1}박 ${route.tripDays}일`,
  ];

  if (route.totalStopCount > 0) {
    tags.push(
      route.totalStopCount / Math.max(1, route.tripDays) >= 4
        ? "촘촘한 루트"
        : "여유로운 루트"
    );
  }

  return tags;
}

function getDisplayShareTags(route: RouteSummaryFieldsFragment) {
  const sourceTags = route.shareTags.length
    ? route.shareTags
    : getFallbackShareTags(route);
  const displayTags = sourceTags.filter((tag) => !REGION_SHARE_TAGS.has(tag));

  return displayTags.length
    ? displayTags
    : getFallbackShareTags(route).filter((tag) => !REGION_SHARE_TAGS.has(tag));
}

function SharedRouteCard({
  route,
  isLiked,
  isLikePending = false,
  onToggleLike,
  onOpen,
}: SharedRouteCardProps) {
  const [isTagExpanded, setIsTagExpanded] = useState(false);
  const isMine = route.isMine;
  const shareTags = getDisplayShareTags(route);
  const visibleTags = isTagExpanded
    ? shareTags
    : shareTags.slice(0, VISIBLE_SHARE_TAG_COUNT);
  const hiddenTagCount = Math.max(0, shareTags.length - visibleTags.length);
  const progressPercent =
    route.totalStopCount > 0
      ? Math.round((route.completedStopCount / route.totalStopCount) * 100)
      : 0;

  return (
    <article
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={() => onOpen?.(route)}
      onKeyDown={(event) => {
        if (!onOpen || (event.key !== "Enter" && event.key !== " ")) {
          return;
        }

        event.preventDefault();
        onOpen(route);
      }}
      className={`min-h-[204px] rounded-2xl border p-4 shadow-sm ${
        isMine
          ? "border-brand-300 bg-brand-50 dark:border-brand-400/40 dark:bg-slate-900/70"
          : "border-brand-100 bg-white dark:border-brand-400/25 dark:bg-slate-950/40"
      } ${onOpen ? "cursor-pointer transition active:scale-[0.99]" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex min-w-0 items-center gap-1.5 text-base font-black text-slate-900">
            {isMine ? (
              <span className="shrink-0 rounded-full border border-brand-200 bg-white px-2 py-0.5 text-[10px] font-black leading-5 text-brand-700 dark:border-brand-400/35 dark:bg-slate-950 dark:text-brand-100">
                내 공유
              </span>
            ) : null}
            <span className="min-w-0 truncate">
            {getSharedRouteTitle(route)}
            </span>
          </p>
          <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-slate-500">
            <MdOutlineCalendarToday className="text-sm" />
            {getSharedRouteSubtitle(route)}
          </p>
        </div>
        {isMine ? (
          <div className="flex shrink-0 items-center gap-1 rounded-full border border-brand-200 bg-white px-3 py-2 text-xs font-bold text-brand-700 dark:border-brand-400/35 dark:bg-slate-950 dark:text-brand-100">
            <FaHeart />
            {route.likeCount}
          </div>
        ) : (
          <button
            type="button"
            aria-label={`${getSharedRouteTitle(route)} 좋아요`}
            disabled={isLikePending}
            onClick={(event) => {
              event.stopPropagation();
              void onToggleLike(route);
            }}
            className={`flex shrink-0 items-center gap-1 rounded-full border px-3 py-2 text-xs font-bold transition disabled:cursor-wait disabled:opacity-75 ${
              isLiked
                ? "border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-300 dark:bg-brand-500/15 dark:text-brand-100"
                : "border-slate-200 bg-white text-slate-500 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-300"
            }`}
          >
            {isLiked ? <FaHeart /> : <FaRegHeart />}
            {route.likeCount}
          </button>
        )}
      </div>

      {shareTags.length > 0 ? (
        <div className="mt-4 min-w-0">
          <div className="scrollbar-hide flex min-w-0 items-center gap-1.5 overflow-x-auto whitespace-nowrap pb-1">
            {visibleTags.map((tag) => (
              <span
                key={tag}
                className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black ${
                  isMine
                    ? "bg-white text-brand-700 ring-1 ring-brand-100 dark:bg-slate-950 dark:text-brand-100 dark:ring-brand-400/25"
                    : "bg-slate-50 text-slate-600 ring-1 ring-slate-100 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700"
                }`}
              >
                <MdSell className="text-xs" />
                {tag}
              </span>
            ))}
            {hiddenTagCount > 0 ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setIsTagExpanded(true);
                }}
                className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-black ${
                  isMine
                    ? "bg-white text-brand-700 ring-1 ring-brand-100 dark:bg-slate-950 dark:text-brand-100 dark:ring-brand-400/25"
                    : "bg-slate-50 text-slate-600 ring-1 ring-slate-100 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700"
                }`}
              >
                +{hiddenTagCount}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className="h-full rounded-full bg-brand-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </article>
  );
}

export default SharedRouteCard;
