export type MapMarkerBadge = {
  label: string;
  icon: string;
  background: string;
  border: string;
  text: string;
};

export type BadgeMarkerHighlightOptions = {
  highlighted?: boolean;
  highlightLabel?: string;
};

export type PlaceBubbleMarkerVariant = "start" | "place";

export type PlaceBubbleMarkerOptions = {
  title: string;
  subtitle: string;
  sequenceLabel: string;
  icon?: string;
  variant?: PlaceBubbleMarkerVariant;
};

export const PLACE_BUBBLE_MARKER_SIZE = {
  width: 158,
  height: 66,
  anchorX: 79,
  anchorY: 66,
} as const;

function escapeHtml(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getRankBadgeStyle(rankLabel?: string) {
  const rank = rankLabel ? Number(rankLabel) : Number.NaN;
  const isRankNumber = Number.isFinite(rank);

  if (!isRankNumber) {
    return {
      background: "#ef4444",
      text: "#ffffff",
      border: "#ffffff",
    };
  }

  if (rank === 1) {
    return {
      background: "#f59e0b",
      text: "#ffffff",
      border: "#ffffff",
    };
  }
  if (rank === 2) {
    return {
      background: "#94a3b8",
      text: "#ffffff",
      border: "#ffffff",
    };
  }
  if (rank === 3) {
    return {
      background: "#b45309",
      text: "#ffffff",
      border: "#ffffff",
    };
  }

  return {
    background: "#ef4444",
    text: "#ffffff",
    border: "#ffffff",
  };
}

export function createBadgeMarkerIconHtml(
  badge: MapMarkerBadge,
  rankLabel?: string,
  options: BadgeMarkerHighlightOptions = {}
) {
  const rankBadgeStyle = getRankBadgeStyle(rankLabel);
  const isHighlighted = Boolean(options.highlighted);
  const outerSize = isHighlighted ? 54 : 34;
  const markerSize = isHighlighted ? 38 : 34;
  const borderWidth = isHighlighted ? 3 : 2;
  const fontSize = isHighlighted ? 17 : 15;
  const highlightLabel = options.highlightLabel ?? "오늘";

  return `
    <div style="
      position:relative;
      width:${outerSize}px;
      height:${outerSize}px;
      display:flex;
      align-items:center;
      justify-content:center;
      font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      user-select:none;
    ">
      ${
        isHighlighted
          ? `<style>
              @keyframes routeoneFestivalPulse {
                0% { transform:scale(0.78); opacity:0.55; }
                70% { transform:scale(1.28); opacity:0; }
                100% { transform:scale(1.28); opacity:0; }
              }
            </style>
            <span style="
              position:absolute;
              inset:5px;
              border-radius:9999px;
              border:2px solid ${badge.border};
              background:${badge.background};
              opacity:0.55;
              animation:routeoneFestivalPulse 1.6s ease-out infinite;
            "></span>
            <span style="
              position:absolute;
              inset:6px;
              border-radius:9999px;
              border:2px solid ${badge.border};
              opacity:0.5;
            "></span>`
          : ""
      }
      <div style="
        position:relative;
        width:${markerSize}px;
        height:${markerSize}px;
        border-radius:9999px;
        border:${borderWidth}px solid ${badge.border};
        background:${badge.background};
        color:${badge.text};
        display:flex;
        align-items:center;
        justify-content:center;
        font-size:${fontSize}px;
        font-weight:700;
        line-height:1;
        box-shadow:${
          isHighlighted
            ? "0 7px 18px rgba(220,38,38,0.32), 0 3px 8px rgba(15,23,42,0.2)"
            : "0 4px 10px rgba(15,23,42,0.18)"
        };
        letter-spacing:0;
        z-index:1;
      ">
        <span>${escapeHtml(badge.icon)}</span>
        ${
          rankLabel
            ? `<span style="
                position:absolute;
                top:-8px;
                right:-8px;
                min-width:18px;
                height:18px;
                border-radius:9999px;
                border:2px solid ${rankBadgeStyle.border};
                background:${rankBadgeStyle.background};
                color:${rankBadgeStyle.text};
                display:flex;
                align-items:center;
                justify-content:center;
                font-size:10px;
                font-weight:800;
                line-height:1;
                padding:0 3px;
                box-shadow:0 3px 8px rgba(15,23,42,0.2);
              ">${escapeHtml(rankLabel)}</span>`
            : ""
        }
      </div>
      ${
        isHighlighted
          ? `<span style="
              position:absolute;
              left:50%;
              bottom:0;
              transform:translateX(-50%);
              height:15px;
              border-radius:9999px;
              border:1px solid #fecaca;
              background:#fff1f2;
              color:#be123c;
              display:flex;
              align-items:center;
              justify-content:center;
              font-size:9px;
              font-weight:800;
              line-height:1;
              padding:0 5px;
              white-space:nowrap;
              box-shadow:0 2px 6px rgba(190,18,60,0.16);
              z-index:2;
            ">${escapeHtml(highlightLabel)}</span>`
          : ""
      }
    </div>
  `;
}

export function createPlaceBubbleMarkerIconHtml({
  title,
  subtitle,
  sequenceLabel,
  variant = "place",
}: PlaceBubbleMarkerOptions) {
  const isStart = variant === "start";
  const borderColor = isStart ? "#cbd5e1" : "#14b8a6";
  const labelBackground = isStart ? "#f1f5f9" : "#ccfbf1";
  const labelText = isStart ? "#334155" : "#0f766e";
  const shadowColor = isStart
    ? "rgba(15,23,42,0.12)"
    : "rgba(15,118,110,0.18)";

  return `
    <div style="
      position:relative;
      width:${PLACE_BUBBLE_MARKER_SIZE.width}px;
      height:${PLACE_BUBBLE_MARKER_SIZE.height}px;
      pointer-events:auto;
      user-select:none;
      font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
    ">
      <div style="
        position:absolute;
        top:0;
        left:0;
        width:100%;
        height:52px;
        border:2px solid ${borderColor};
        border-radius:14px;
        background:#ffffff;
        color:#0f172a;
        display:flex;
        align-items:center;
        gap:9px;
        padding:7px 11px 7px 9px;
        box-sizing:border-box;
        box-shadow:0 8px 18px ${shadowColor};
      ">
        <span style="
          width:30px;
          height:30px;
          border-radius:9999px;
          background:${labelBackground};
          color:${labelText};
          display:flex;
          align-items:center;
          justify-content:center;
          flex:0 0 30px;
          font-size:14px;
          font-weight:800;
          line-height:1;
        ">${escapeHtml(sequenceLabel)}</span>
        <span style="
          min-width:0;
          flex:1 1 auto;
          display:flex;
          flex-direction:column;
          gap:2px;
        ">
          <span style="
            overflow:hidden;
            text-overflow:ellipsis;
            white-space:nowrap;
            font-size:13px;
            font-weight:800;
            line-height:1.15;
          ">${escapeHtml(title)}</span>
          <span style="
            overflow:hidden;
            text-overflow:ellipsis;
            white-space:nowrap;
            color:#64748b;
            font-size:11px;
            font-weight:700;
            line-height:1.1;
          ">${escapeHtml(subtitle)}</span>
        </span>
      </div>
      <div style="
        position:absolute;
        left:50%;
        top:49px;
        width:0;
        height:0;
        transform:translateX(-50%);
        border-left:10px solid transparent;
        border-right:10px solid transparent;
        border-top:12px solid ${borderColor};
        filter:drop-shadow(0 5px 5px ${shadowColor});
      "></div>
      <div style="
        position:absolute;
        left:50%;
        top:49px;
        width:0;
        height:0;
        transform:translateX(-50%);
        border-left:7px solid transparent;
        border-right:7px solid transparent;
        border-top:9px solid #ffffff;
      "></div>
    </div>
  `;
}
