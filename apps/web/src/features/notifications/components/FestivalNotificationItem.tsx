import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MdCelebration,
  MdChevronRight,
  MdExpandLess,
  MdExpandMore,
} from "react-icons/md";
import { festivalApi } from "@/api/festivalApi";
import {
  GANGWON_REGIONS,
  GANGWON_SIGNGU_ADMIN_CODES,
  GANGWON_TATS_AREA_CODE,
} from "@/data/gangwonRegions";
import type {
  FestivalNotificationKind,
  GangwonFestivalsQuery,
} from "@/generated/graphql";
import type { FestivalNotificationInboxItem } from "@/features/notifications/notificationItemTypes";
import { formatFestivalPeriod } from "@/lib/festivalDate";
import {
  createMapSheetPlaceFromAttraction,
  resolveMarkerType,
} from "@/lib/gangwonAttractionMap";
import { localizeTourPlaces } from "@/lib/placeLocalization";
import { useUiText } from "@/lib/uiText";
import type { GangwonAttraction } from "@/lib/visitKoreaTourApi";
import type { NativeFestivalNotificationKind } from "@/native-bridge";
import { useAppLanguageStore } from "@/stores/appLanguageStore";
import { useMapSheetStore } from "@/stores/mapSheetStore";
import { useUiToastStore } from "@/stores/uiToastStore";

const FESTIVAL_PREVIEW_COUNT = 3;

function getUiFestivalNotificationKind(
  kind: FestivalNotificationKind
): NativeFestivalNotificationKind {
  return kind.toLowerCase() as NativeFestivalNotificationKind;
}

function createFestivalAttraction(
  festival: GangwonFestivalsQuery["gangwonFestivals"][number]
): GangwonAttraction {
  const eventStartDate = festival.startDate.replaceAll("-", "");
  const eventEndDate = festival.endDate.replaceAll("-", "");

  return {
    id: festival.id,
    title: festival.title,
    address: festival.address,
    lat: festival.lat,
    lng: festival.lng,
    contentTypeId: "15",
    lclsSystm1: "",
    lclsSystm2: "",
    lclsSystm3: "",
    firstImage: festival.imageUrl,
    secondImage: "",
    eventStartDate,
    eventEndDate,
    isTodayFestival: false,
    tourApiSigunguCode: festival.regionCode,
  };
}

function addDateKeyDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    return dateKey;
  }

  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getFallbackFestivalLookupEndDate(
  item: FestivalNotificationInboxItem
) {
  if (item.festivalKind === "MONTHLY") {
    return addDateKeyDays(item.dateKey, 30);
  }

  if (
    item.festivalKind === "WEEKLY" ||
    item.festivalKind === "TEST"
  ) {
    return addDateKeyDays(item.dateKey, 6);
  }

  return item.dateKey;
}

function FestivalNotificationItem({
  item,
  isFocused,
}: {
  item: FestivalNotificationInboxItem;
  isFocused: boolean;
}) {
  const text = useUiText();
  const queryClient = useQueryClient();
  const appLanguage = useAppLanguageStore((state) => state.language);
  const openSheet = useMapSheetStore((state) => state.openSheet);
  const showToast = useUiToastStore((state) => state.showToast);
  const festivalDetailRequestRef = useRef(0);
  const [isExpanded, setIsExpanded] = useState(isFocused);
  const [openingFestivalId, setOpeningFestivalId] = useState<string | null>(
    null
  );
  const region = GANGWON_REGIONS.find(
    (candidate) => candidate.sigunguCode === item.regionCode
  );
  const regionLabel = region
    ? (text.labels.regions[region.label] ?? region.label)
    : item.regionCode === "MULTIPLE" && appLanguage === "en"
      ? "Gangwon"
      : item.regionLabel;
  const kindLabel =
    text.notifications.kinds[getUiFestivalNotificationKind(item.festivalKind)];
  const festivalLocalizationCandidates = item.festivalTitles.flatMap(
    (title, index) => {
      const festivalId = item.festivalIds[index]?.trim();

      return festivalId
        ? [
            {
              id: festivalId,
              contentTypeId: "15",
              title,
              address: "",
              index,
            },
          ]
        : [];
    }
  );
  const localizedFestivalsQuery = useQuery({
    queryKey: [
      "notification-festival-localizations",
      appLanguage,
      festivalLocalizationCandidates.map((festival) => [
        festival.id,
        festival.title,
      ]),
    ],
    enabled:
      appLanguage === "en" && festivalLocalizationCandidates.length > 0,
    queryFn: () =>
      localizeTourPlaces(festivalLocalizationCandidates, appLanguage, {
        retryUncached: true,
        waitForFresh: true,
      }),
    staleTime: 1000 * 60 * 60 * 24,
  });
  const localizedFestivalTitleByIndex = new Map(
    (localizedFestivalsQuery.data ?? []).map((festival) => [
      festival.index,
      festival.title,
    ])
  );
  const visibleFestivalIndexes = Array.from(
    {
      length: isExpanded
        ? item.festivalTitles.length
        : Math.min(item.festivalTitles.length, FESTIVAL_PREVIEW_COUNT),
    },
    (_, index) => index
  );
  const hiddenFestivalCount =
    item.festivalTitles.length - visibleFestivalIndexes.length;

  useEffect(
    () => () => {
      festivalDetailRequestRef.current += 1;
    },
    []
  );

  const handleOpenFestival = async (festivalIndex: number) => {
    const festivalId = item.festivalIds[festivalIndex]?.trim() ?? "";
    const festivalTitle =
      item.festivalTitles[festivalIndex]?.trim() ?? "";
    const festivalStartDate =
      item.festivalStartDates[festivalIndex]?.trim() ?? "";
    const hasFestivalStartDate =
      /^\d{4}-\d{2}-\d{2}$/.test(festivalStartDate);
    const lookupStartDate = hasFestivalStartDate
      ? festivalStartDate
      : item.dateKey;
    const lookupEndDate = hasFestivalStartDate
      ? festivalStartDate
      : getFallbackFestivalLookupEndDate(item);

    if (!festivalId || !festivalTitle) {
      showToast(text.notifications.festivalDetailLoadError, 2600);
      return;
    }

    const requestId = festivalDetailRequestRef.current + 1;
    festivalDetailRequestRef.current = requestId;
    setOpeningFestivalId(festivalId);

    try {
      const result = await queryClient.fetchQuery({
        queryKey: [
          "gangwon-festivals",
          "notification-detail",
          lookupStartDate,
          lookupEndDate,
        ],
        queryFn: () =>
          festivalApi.list(lookupStartDate, lookupEndDate),
        staleTime: 1000 * 60 * 60 * 6,
      });

      if (festivalDetailRequestRef.current !== requestId) {
        return;
      }

      const festival =
        result.gangwonFestivals.find(
          (candidate) =>
            candidate.id === festivalId &&
            candidate.regionCode === item.regionCode
        ) ??
        result.gangwonFestivals.find(
          (candidate) => candidate.id === festivalId
        ) ??
        result.gangwonFestivals.find(
          (candidate) =>
            candidate.regionCode === item.regionCode &&
            candidate.title.trim() === festivalTitle
        );

      if (!festival) {
        throw new Error("Festival detail was not found.");
      }

      const attraction = createFestivalAttraction(festival);
      const markerType = resolveMarkerType(attraction, {});

      openSheet(
        createMapSheetPlaceFromAttraction({
          attraction,
          markerType,
          areaCode: GANGWON_TATS_AREA_CODE,
          signguCode:
            GANGWON_SIGNGU_ADMIN_CODES[festival.regionCode] ?? "",
          touristTrendName: festival.title,
          topRank: null,
        }),
        {
          mode: "full-popup",
        }
      );
    } catch {
      if (festivalDetailRequestRef.current === requestId) {
        showToast(text.notifications.festivalDetailLoadError, 2600);
      }
    } finally {
      if (festivalDetailRequestRef.current === requestId) {
        setOpeningFestivalId(null);
      }
    }
  };

  return (
    <article
      id={`notification-${item.notificationKey}`}
      className={`overflow-hidden rounded-lg border bg-white shadow-sm transition dark:bg-[#071f1d] ${
        isFocused
          ? "border-brand-500 ring-2 ring-brand-200 dark:border-brand-300 dark:ring-brand-400/25"
          : "border-brand-100 dark:border-brand-400/25"
      }`}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-xl text-rose-500 dark:bg-rose-400/15 dark:text-rose-200">
          <MdCelebration aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-black text-brand-700 dark:bg-brand-400/15 dark:text-brand-100">
              {kindLabel}
            </span>
            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-300">
              {text.notifications.formatDate(item.dateKey)}
            </span>
          </div>
          <h2 className="mt-1.5 text-sm font-black text-slate-900 dark:text-white">
            {text.notifications.summaryTitle(
              regionLabel,
              item.festivalTitles.length
            )}
          </h2>
        </div>
      </div>

      <div className="border-t border-brand-50 dark:border-brand-400/15">
        {visibleFestivalIndexes.map((festivalIndex) => {
          const sourceFestivalTitle = item.festivalTitles[festivalIndex];
          const festivalTitle =
            (appLanguage === "en"
              ? localizedFestivalTitleByIndex.get(festivalIndex)
              : null) ??
            sourceFestivalTitle;
          const festivalPeriod = formatFestivalPeriod(
            item.festivalStartDates[festivalIndex],
            item.festivalEndDates[festivalIndex],
            appLanguage
          );
          const festivalId = item.festivalIds[festivalIndex] ?? null;
          const isOpening = Boolean(
            festivalId && festivalId === openingFestivalId
          );

          return (
            <button
              key={`${item.id}:${festivalTitle}`}
              type="button"
              aria-label={text.notifications.openFestivalAria(festivalTitle)}
              aria-busy={isOpening}
              disabled={isOpening}
              onClick={() => void handleOpenFestival(festivalIndex)}
              className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 hover:bg-brand-50/70 active:bg-brand-100/70 disabled:cursor-wait disabled:bg-brand-50/70 dark:border-brand-400/10 dark:hover:bg-brand-400/10 dark:disabled:bg-brand-400/10"
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-black text-slate-500 dark:bg-slate-900 dark:text-slate-200">
                {festivalIndex + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-slate-700 dark:text-slate-100">
                  {festivalTitle}
                </span>
                {festivalPeriod ? (
                  <span className="mt-1 block text-xs font-semibold text-brand-700 dark:text-brand-200">
                    {festivalPeriod}
                  </span>
                ) : null}
              </span>
              {isOpening ? (
                <span className="size-4 shrink-0 animate-spin rounded-full border-2 border-brand-100 border-t-brand-600 dark:border-brand-400/20 dark:border-t-brand-200" />
              ) : (
                <MdChevronRight className="shrink-0 text-xl text-slate-300 dark:text-slate-500" />
              )}
            </button>
          );
        })}
      </div>

      {item.festivalTitles.length > FESTIVAL_PREVIEW_COUNT ? (
        <div className="flex justify-end border-t border-brand-50 bg-slate-50/70 px-3 py-2 dark:border-brand-400/15 dark:bg-slate-950/30">
          <button
            type="button"
            aria-expanded={isExpanded}
            onClick={() => setIsExpanded((current) => !current)}
            className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-bold text-slate-500 transition hover:text-slate-700 dark:text-slate-300 dark:hover:text-white"
          >
            {isExpanded
              ? text.notifications.collapse
              : text.notifications.showMore(hiddenFestivalCount)}
            {isExpanded ? <MdExpandLess /> : <MdExpandMore />}
          </button>
        </div>
      ) : null}
    </article>
  );
}

export default FestivalNotificationItem;
