/**
 * 용도:
 * 하단 탭 화면마다 다르게 계산되던 빈 상태 카드의 세로 기준선을 맞춘다.
 *
 * 구조:
 * 동일한 상하 여백 사이에 빈 상태 카드를 배치하고, 선택적인 액션은
 * 카드 아래 여백에 두어 카드의 중앙 위치에 영향을 주지 않도록 구성한다.
 */
import type { ReactNode } from "react";

type RoutePageEmptyStateProps = {
  children: ReactNode;
  action?: ReactNode;
  className?: string;
};

function RoutePageEmptyState({
  children,
  action,
  className = "",
}: RoutePageEmptyStateProps) {
  return (
    <div
      className={`grid min-h-0 w-full grid-rows-[minmax(0,1fr)_auto_minmax(0,1fr)] ${className}`}
    >
      <div aria-hidden="true" />
      <div>{children}</div>
      <div className={action ? "pt-3" : undefined}>{action}</div>
    </div>
  );
}

export default RoutePageEmptyState;
