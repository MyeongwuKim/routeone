/** 공유 경로 페이지를 ID 기준으로 합치고 최신·인기 정렬과 feed·liked 모드별 빈 상태 문구를 계산한다. */
import type { DropdownSelectOption } from "@/components/inputs";
import type { UiText } from "@/lib/uiText";
import type { SharedRoute } from "./sharedRouteCardModel";

export type SharedRoutePageMode = "feed" | "liked";

export type SharedRouteSortKey =
  | "shared-desc"
  | "shared-asc"
  | "likes-desc";

export const SHARED_ROUTE_PAGE_SIZE = 20;

export function getSharedRouteSortOptions(
  text: UiText
): ReadonlyArray<DropdownSelectOption<SharedRouteSortKey>> {
  return [
    {
      value: "shared-desc",
      label: text.sharedRoute.sortSharedDescLabel,
      description: text.sharedRoute.sortSharedDescDescription,
    },
    {
      value: "shared-asc",
      label: text.sharedRoute.sortSharedAscLabel,
      description: text.sharedRoute.sortSharedAscDescription,
    },
    {
      value: "likes-desc",
      label: text.sharedRoute.sortLikesDescLabel,
      description: text.sharedRoute.sortLikesDescDescription,
    },
  ];
}

export function getSharedRoutePageCopy(
  text: UiText,
  mode: SharedRoutePageMode
) {
  return mode === "liked"
    ? {
        title: text.sharedRoute.likedTitle,
        description: text.sharedRoute.likedDescription,
        error: text.sharedRoute.likedError,
        empty: text.sharedRoute.likedEmpty,
      }
    : {
        title: text.sharedRoute.feedTitle,
        description: text.sharedRoute.feedDescription,
        error: text.sharedRoute.feedError,
        empty: text.sharedRoute.feedEmpty,
      };
}

export function getRouteSortTime(route: SharedRoute) {
  return new Date(route.sharedAt ?? route.updatedAt ?? route.createdAt).getTime();
}
