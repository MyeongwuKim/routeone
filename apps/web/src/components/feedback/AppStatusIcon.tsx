import "./appStatusIcon.css";

/** 공통 진행·빈 상태에 나침반을 표시한다. 빈 상태나 모션 줄이기 설정에서는 움직이지 않는다. */
export default function AppStatusIcon({ animated = true, compact = false }: {
  animated?: boolean;
  compact?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 112 112"
      fill="none"
      aria-hidden="true"
      focusable="false"
      data-animated={animated}
      className={`masil-status-icon shrink-0 ${compact ? "size-16" : "size-20"}`}
    >
      <circle cx="56" cy="56" r="47" fill="#ccfbf1" fillOpacity="0.35" />
      <circle className="masil-status-orbit" cx="56" cy="56" r="46" stroke="#14b8a6" strokeOpacity="0.45" strokeWidth="2" strokeDasharray="2 9" strokeLinecap="round" />
      <circle cx="56" cy="56" r="34" fill="#0f766e" />
      <circle cx="56" cy="56" r="28" stroke="#5eead4" strokeOpacity="0.45" strokeWidth="1.5" />
      <g className="masil-status-needle">
        <path d="M74 38L62 62L38 74L50 50Z" fill="#5eead4" stroke="#99f6e4" strokeWidth="2" strokeLinejoin="round" />
        <path d="M74 38L62 62L50 50Z" fill="#ffffff" />
        <circle cx="56" cy="56" r="3" fill="#0f766e" />
      </g>
      <circle cx="94" cy="27" r="6" fill="#fb923c" />
      <circle cx="20" cy="88" r="3" fill="#2dd4bf" />
    </svg>
  );
}
