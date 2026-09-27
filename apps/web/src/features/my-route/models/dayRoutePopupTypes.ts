/**
 * 하루 경로 팝업이 표시할 경로와 닫기·수정 동작을 부모 화면에서 전달받는 Props를 정의한다.
 */
import type { ReactNode } from "react";
import type { PlannedRouteDay } from "@/features/route-checkout/models/routePlanTypes";
import type { MapSheetPlace } from "@/types/place";
import type { MyRoute, MyRouteDay } from "../types";

export type DayRoutePopupProps = {

  route: MyRoute;

  day: MyRouteDay;

  focusedStopId?: string | null;

  onClose: () => void;

  isReadOnly?: boolean;

  allowVisitCompletion?: boolean;

  visitCompletionMode?: "live" | "retrospective";

  headerLabel?: string;

  headerBadge?: string;

  headerIdentity?: ReactNode;
  /** 기본 경로명 대신 DAY 팝업 헤더에 표시할 제목 */
  headerTitle?: string;

  headerMeta?: ReactNode;

  enableStartPreview?: boolean;

  enableVerificationPhotoPreview?: boolean;

  onRequestPlaceRouteFilter?: (place: MapSheetPlace) => void;

  onRequestCheckout?: (routePlan: PlannedRouteDay[]) => void;

  onRequestStartRoute?: (route: MyRoute) => void;

  isRouteStartPending?: boolean;

  readOnlyFooterAction?: {
    label: string;
    ariaLabel?: string;
    icon?: ReactNode;
    isActive?: boolean;
    disabled?: boolean;
    onClick: () => void;
  };

  readOnlyPosterAction?: {
    label: string;
    ariaLabel?: string;
    disabled?: boolean;
    onClick: () => void;
  };
};
