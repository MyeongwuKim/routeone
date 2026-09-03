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
