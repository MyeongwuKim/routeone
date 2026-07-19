import type { ReactNode } from "react";
import type { PlannedRouteDay } from "@/features/route-checkout/models/routePlanTypes";
import type { MyRoute, MyRouteDay } from "../types";

export type DayRoutePopupProps = {
  route: MyRoute;
  day: MyRouteDay;
  onClose: () => void;
  isReadOnly?: boolean;
  allowVisitCompletion?: boolean;
  visitCompletionMode?: "live" | "retrospective";
  headerLabel?: string;
  headerBadge?: string;
  enableStartPreview?: boolean;
  enableVerificationPhotoPreview?: boolean;
  onRequestCheckout?: (routePlan: PlannedRouteDay[]) => void;
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
