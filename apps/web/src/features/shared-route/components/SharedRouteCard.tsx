import { memo, useState } from "react";
import { FaHeart, FaRegHeart } from "react-icons/fa";
import {
  MdAdd,
  MdOutlineCalendarToday,
  MdOutlinePlace,
  MdSell,
} from "react-icons/md";
import type { RouteSummaryFieldsFragment } from "@/generated/graphql";
import { useUiText } from "@/lib/uiText";
import {
  getDisplayPlaceOptions,
  getDisplayShareTags,
  getSharedRouteSubtitle,
  getSharedRouteTitle,
  type SharedRoute,
  type SharedRouteFilterCandidate,
} from "../sharedRouteCardModel";

const VISIBLE_SHARE_TAG_COUNT = 3;
const VISIBLE_PLACE_CHIP_COUNT = 3;

type SharedRouteCardProps = {
  route: SharedRoute;
  isLiked: boolean;
  isLikePending?: boolean;
  onToggleLike: (route: RouteSummaryFieldsFragment) => void | Promise<void>;
  onOpen?: (route: SharedRoute) => void;
  onRequestFilter?: (filter: SharedRouteFilterCandidate) => void;
};

const SharedRouteCard = memo(function SharedRouteCard({
  route,
  isLiked,
  isLikePending = false,
  onToggleLike,
  onOpen,
  onRequestFilter,
}: SharedRouteCardProps) {
  const text = useUiText();
  const [isTagExpanded, setIsTagExpanded] = useState(false);
  const [isPlaceExpanded, setIsPlaceExpanded] = useState(false);
  const isMine = route.isMine;
  const shareTags = getDisplayShareTags(route, text);
  const placeOptions = getDisplayPlaceOptions(route, text);
  const visibleTags = isTagExpanded
    ? shareTags
    : shareTags.slice(0, VISIBLE_SHARE_TAG_COUNT);
  const hiddenTagCount = Math.max(0, shareTags.length - visibleTags.length);
  const visiblePlaceOptions = isPlaceExpanded
    ? placeOptions
    : placeOptions.slice(0, VISIBLE_PLACE_CHIP_COUNT);
  const hiddenPlaceCount = Math.max(
    0,
    placeOptions.length - visiblePlaceOptions.length
  );
  const canCollapseTags =
    isTagExpanded && shareTags.length > VISIBLE_SHARE_TAG_COUNT;
  const canCollapsePlaces =
    isPlaceExpanded && placeOptions.length > VISIBLE_PLACE_CHIP_COUNT;
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
      className={`relative min-h-[156px] overflow-hidden rounded-2xl border bg-clip-padding p-4 shadow-sm ${
        isMine
          ? "border-brand-300 bg-brand-50 dark:border-brand-300/45 dark:bg-[#082b28]"
          : "border-brand-100 bg-white dark:border-brand-400/35 dark:bg-[#071f1d]"
      } ${onOpen ? "cursor-pointer transition active:scale-[0.99]" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex min-w-0 items-center gap-1.5 text-base font-black text-slate-900 dark:text-white">
            {isMine ? (
              <span className="shrink-0 rounded-full border border-brand-200 bg-white px-2 py-0.5 text-[10px] font-black leading-5 text-brand-700 dark:border-brand-400/35 dark:bg-slate-950 dark:text-brand-100">
                {text.sharedRouteCard.myShare}
              </span>
            ) : null}
            <span className="min-w-0 truncate">
              {getSharedRouteTitle(route, text)}
            </span>
          </p>
          <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-200/80">
            <MdOutlineCalendarToday className="text-sm dark:text-brand-200" />
            {getSharedRouteSubtitle(route, text)}
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
            aria-label={text.sharedRouteCard.likeAria(
              getSharedRouteTitle(route, text)
            )}
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
        <div className="mt-3 min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {visibleTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onRequestFilter?.({
                    type: "tag",
                    value: tag,
                  });
                }}
                className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black ${
                  isMine
                    ? "bg-white text-brand-700 ring-1 ring-brand-100 dark:bg-slate-950 dark:text-brand-100 dark:ring-brand-400/25"
                    : "bg-slate-50 text-slate-600 ring-1 ring-slate-100 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700"
                } transition hover:border-brand-300 hover:text-brand-700 dark:hover:text-brand-100`}
              >
                <MdSell className="text-xs" />
                {tag}
              </button>
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
                {text.sharedRouteCard.moreTags(hiddenTagCount)}
              </button>
            ) : null}
            {canCollapseTags ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setIsTagExpanded(false);
                }}
                className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-black ${
                  isMine
                    ? "bg-white text-brand-700 ring-1 ring-brand-100 dark:bg-slate-950 dark:text-brand-100 dark:ring-brand-400/25"
                    : "bg-slate-50 text-slate-600 ring-1 ring-slate-100 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700"
                }`}
              >
                {text.sharedRouteCard.folded}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {placeOptions.length > 0 ? (
        <div className="mt-2 min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {visiblePlaceOptions.map((placeOption) => (
              <button
                key={`${placeOption.region}:${placeOption.name}`}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onRequestFilter?.({
                    type: "place",
                    value: placeOption.name,
                    region: placeOption.region,
                  });
                }}
                className={`inline-flex max-w-full shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black ${
                  isMine
                    ? "bg-brand-100 text-brand-800 ring-1 ring-brand-200 dark:bg-brand-400/15 dark:text-brand-100 dark:ring-brand-400/25"
                    : "bg-white text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700"
                } transition hover:border-brand-300 hover:text-brand-700 dark:hover:text-brand-100`}
              >
                <MdOutlinePlace className="shrink-0 text-xs" />
                <span className="min-w-0 truncate">{placeOption.name}</span>
              </button>
            ))}
            {hiddenPlaceCount > 0 ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setIsPlaceExpanded(true);
                }}
                className={`inline-flex shrink-0 items-center gap-0.5 rounded-full px-2.5 py-1 text-[11px] font-black ${
                  isMine
                    ? "bg-brand-100 text-brand-800 ring-1 ring-brand-200 dark:bg-brand-400/15 dark:text-brand-100 dark:ring-brand-400/25"
                    : "bg-white text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700"
                  }`}
              >
                <MdAdd className="text-xs" />
                {text.sharedRouteCard.morePlaces(hiddenPlaceCount)}
              </button>
            ) : null}
            {canCollapsePlaces ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setIsPlaceExpanded(false);
                }}
                className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-black ${
                  isMine
                    ? "bg-brand-100 text-brand-800 ring-1 ring-brand-200 dark:bg-brand-400/15 dark:text-brand-100 dark:ring-brand-400/25"
                    : "bg-white text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700"
                }`}
              >
                {text.sharedRouteCard.folded}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className="h-full rounded-full bg-brand-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </article>
  );
});

export default SharedRouteCard;
