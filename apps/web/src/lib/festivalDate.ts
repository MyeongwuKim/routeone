import type { AppLanguage } from "@/stores/appLanguageStore";

function parseFestivalDate(value: string | null | undefined) {
  const normalized = value?.replaceAll("-", "").replaceAll(".", "") ?? "";

  if (!/^\d{8}$/.test(normalized)) {
    return null;
  }

  const year = Number(normalized.slice(0, 4));
  const month = Number(normalized.slice(4, 6));
  const day = Number(normalized.slice(6, 8));
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function formatFestivalDate(date: Date, language: AppLanguage) {
  if (language === "en") {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      weekday: "short",
      timeZone: "UTC",
    });
  }

  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  return `${date.getUTCMonth() + 1}.${date.getUTCDate()}(${weekdays[date.getUTCDay()]})`;
}

export function formatFestivalPeriod(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  language: AppLanguage
) {
  const parsedStartDate = parseFestivalDate(startDate);
  const parsedEndDate = parseFestivalDate(endDate || startDate);

  if (!parsedStartDate || !parsedEndDate) {
    return null;
  }

  const startLabel = formatFestivalDate(parsedStartDate, language);
  const endLabel = formatFestivalDate(parsedEndDate, language);

  return startLabel === endLabel
    ? startLabel
    : `${startLabel} ~ ${endLabel}`;
}
