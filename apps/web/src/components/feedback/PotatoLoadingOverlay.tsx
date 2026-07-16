import { useUiLoadingStore, type AppLoadingAnimation } from "@/stores/uiLoadingStore";

type PotatoLoadingCardProps = {
  title: string;
  description?: string;
  footerText?: string;
  animation?: AppLoadingAnimation;
  compact?: boolean;
  className?: string;
};

function PotatoLoadingStyles() {
  return (
    <style>
      {`
        @keyframes potatoFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-5px); }
        }
        @keyframes potatoThinkTilt {
          0%, 100% { transform: rotate(-1.4deg); }
          50% { transform: rotate(1.6deg); }
        }
        @keyframes potatoBlinkCute {
          0%, 44%, 100% { transform: scaleY(1); }
          46%, 48% { transform: scaleY(0.12); }
        }
        @keyframes potatoEyeMove {
          0%, 100% { transform: translateX(-0.8px); }
          50% { transform: translateX(1.2px); }
        }
        @keyframes potatoMapWiggle {
          0%, 100% { transform: rotate(-3deg); }
          50% { transform: rotate(3deg); }
        }
        @keyframes potatoMapInspect {
          0%, 100% { transform: translateY(0px) rotate(-1deg); }
          50% { transform: translateY(-1.8px) rotate(1.8deg); }
        }
        @keyframes potatoPupilFocus {
          0%, 100% { transform: translate(-0.4px, 0.9px); }
          35% { transform: translate(0.7px, 1.2px); }
          70% { transform: translate(0.1px, 1.6px); }
        }
        @keyframes potatoPupilSide {
          0%, 100% { transform: translateX(-0.6px); }
          50% { transform: translateX(0.8px); }
        }
        @keyframes potatoShadowPulse {
          0%, 100% { transform: scaleX(1); opacity: 0.22; }
          50% { transform: scaleX(0.9); opacity: 0.15; }
        }
        @keyframes potatoLensSwing {
          0%, 100% { transform: rotate(-4deg) translateY(0px); }
          50% { transform: rotate(4deg) translateY(-0.6px); }
        }
        @keyframes potatoPonderNod {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(1.6deg); }
        }
        @keyframes potatoThoughtBubble {
          0%, 100% { transform: translateY(0px); opacity: 0.75; }
          50% { transform: translateY(-2px); opacity: 1; }
        }
        @keyframes potatoThoughtDot {
          0%, 20%, 100% { opacity: 0.2; transform: scale(0.8); }
          40%, 70% { opacity: 1; transform: scale(1); }
        }
        @keyframes potatoQuestionTilt {
          0%, 100% { transform: rotate(-6deg); }
          50% { transform: rotate(7deg); }
        }
        @keyframes potatoRouteTravel {
          0% { transform: translate(5px, 48px); opacity: 0; }
          8% { transform: translate(5px, 48px); opacity: 1; }
          28% { transform: translate(34px, 30px); opacity: 1; }
          52% { transform: translate(63px, 50px); opacity: 1; }
          76% { transform: translate(92px, 24px); opacity: 1; }
          92% { transform: translate(109px, 34px); opacity: 1; }
          100% { transform: translate(109px, 34px); opacity: 0; }
        }
        @keyframes potatoRouteBob {
          0%, 100% { transform: translateY(0px) rotate(-5deg); }
          50% { transform: translateY(-5px) rotate(4deg); }
        }
        @keyframes potatoRouteDash {
          0% { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: -28; }
        }
        @keyframes potatoRouteShadow {
          0%, 100% { transform: scaleX(0.92); opacity: 0.16; }
          50% { transform: scaleX(0.68); opacity: 0.1; }
        }
        @keyframes potatoRouteLeaf {
          0%, 100% { transform: rotate(-7deg); }
          50% { transform: rotate(10deg); }
        }
        @keyframes potatoRoutePulse {
          0%, 100% { transform: scale(1); opacity: 0.65; }
          50% { transform: scale(1.16); opacity: 1; }
        }
      `}
    </style>
  );
}

function PotatoCharacter({
  animation,
  compact,
}: {
  animation: AppLoadingAnimation;
  compact: boolean;
}) {
  const isMapThinking = animation === "map-thinking";
  const isRanking = animation === "ranking";
  const isMapRendering = animation === "map-rendering";
  const isSearching = animation === "searching";
  const isPondering = animation === "pondering";
  const isEmpty = animation === "empty";
  const isRunning = animation === "running";
  const shouldHoldMap = isMapThinking || isRanking || isMapRendering;

  if (isRunning) {
    return (
      <div className={`${compact ? "h-20 w-28" : "h-24 w-32"} relative shrink-0`}>
        <svg viewBox="0 0 150 120" className="relative z-10 h-full w-full" aria-hidden="true">
          <path
            d="M18 88 C34 58,47 64,59 81 C72 100,88 86,96 60 C104 33,119 33,132 48"
            fill="none"
            stroke="#CBD5E1"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <path
            d="M18 88 C34 58,47 64,59 81 C72 100,88 86,96 60 C104 33,119 33,132 48"
            fill="none"
            stroke="#38BDF8"
            strokeDasharray="5 8"
            strokeLinecap="round"
            strokeWidth="3"
            style={{ animation: "potatoRouteDash 1.1s linear infinite" }}
          />
          <g style={{ transformOrigin: "18px 88px", animation: "potatoRoutePulse 1.4s ease-in-out infinite" }}>
            <circle cx="18" cy="88" r="4.5" fill="#22C55E" stroke="#166534" strokeWidth="1.5" />
          </g>
          <g style={{ transformOrigin: "132px 48px", animation: "potatoRoutePulse 1.4s ease-in-out infinite 0.35s" }}>
            <circle cx="132" cy="48" r="5" fill="#FB7185" stroke="#BE123C" strokeWidth="1.5" />
            <path d="M132 53 L132 61" stroke="#BE123C" strokeWidth="1.8" strokeLinecap="round" />
          </g>
          <circle cx="59" cy="81" r="3.4" fill="#FFFFFF" stroke="#94A3B8" strokeWidth="1.6" />
          <circle cx="96" cy="60" r="3.4" fill="#FFFFFF" stroke="#94A3B8" strokeWidth="1.6" />

          <g style={{ animation: "potatoRouteTravel 2.4s ease-in-out infinite" }}>
            <ellipse
              cx="19"
              cy="39"
              rx="14"
              ry="3.8"
              fill="#64748B"
              opacity="0.28"
              style={{ animation: "potatoRouteShadow 0.56s ease-in-out infinite" }}
            />
            <g
              style={{
                animation: "potatoRouteBob 0.56s ease-in-out infinite",
                transformOrigin: "18px 21px",
              }}
            >
              <path
                d="M18 2C29 2 37 11 36 23C35 34 28 41 18 41C8 41 1 33 1 23C1 11 8 2 18 2Z"
                fill="#CFA06D"
                stroke="#2A1A13"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <ellipse cx="11" cy="15" rx="2.2" ry="1.8" fill="#B9864F" opacity="0.5" />
              <ellipse cx="25" cy="29" rx="2" ry="1.7" fill="#B9864F" opacity="0.45" />
              <circle cx="13" cy="22" r="2.1" fill="#111827" />
              <circle cx="23" cy="22" r="2.1" fill="#111827" />
              <circle cx="12.3" cy="21.3" r="0.7" fill="#FFFFFF" />
              <circle cx="22.3" cy="21.3" r="0.7" fill="#FFFFFF" />
              <path
                d="M15 30 C18 32,21 32,24 30"
                fill="none"
                stroke="#2A1A13"
                strokeLinecap="round"
                strokeWidth="1.7"
              />
              <circle cx="8.5" cy="28" r="1.8" fill="#F6C8B5" opacity="0.72" />
              <circle cx="27.5" cy="28" r="1.8" fill="#F6C8B5" opacity="0.72" />
              <g
                style={{
                  animation: "potatoRouteLeaf 0.56s ease-in-out infinite",
                  transformOrigin: "20px 5px",
                }}
              >
                <path
                  d="M17 5 C20 -3,30 -2,32 6 C28 9,21 9,17 5Z"
                  fill="#47B26B"
                  stroke="#1D6B37"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                />
                <path d="M23 6 C23 3,24 1,26 0" fill="none" stroke="#1D6B37" strokeLinecap="round" strokeWidth="1.3" />
              </g>
            </g>
          </g>
        </svg>
      </div>
    );
  }

  return (
    <div className={`${compact ? "h-20 w-20" : "h-24 w-24"} relative shrink-0`}>
      <div
        className="absolute bottom-[6px] left-1/2 h-3 w-14 -translate-x-1/2 rounded-full bg-slate-400/30"
        style={{
          animation: isEmpty ? "none" : "potatoShadowPulse 1.8s ease-in-out infinite",
        }}
      />
      <svg
        viewBox="0 0 120 120"
        className="relative z-10 h-full w-full"
        style={{
          animation: isMapThinking
            ? "potatoThinkTilt 1.1s ease-in-out infinite"
            : isPondering || isSearching || isEmpty
              ? "none"
              : "potatoFloat 1.6s ease-in-out infinite",
          transformOrigin: "60px 64px",
        }}
        aria-hidden="true"
      >
        <g>
          <path
            d="M60 16C82 16 100 33 100 55C100 82 84 103 60 104C36 104 20 83 20 58C20 34 38 16 60 16Z"
            fill="#CFA06D"
            stroke="#2A1A13"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <ellipse cx="45" cy="45" rx="3.6" ry="3.1" fill="#B9864F" opacity="0.52" />
          <ellipse cx="76" cy="73" rx="3.2" ry="2.9" fill="#B9864F" opacity="0.45" />
          <ellipse cx="62" cy="88" rx="2.7" ry="2.3" fill="#B9864F" opacity="0.45" />
        </g>
        {isSearching ? (
          <g>
            <circle cx="50" cy="58" r="3.1" fill="#111827" />
            <circle cx="49.3" cy="57.3" r="1.1" fill="#ffffff" />
            <path
              d="M67 58 Q70 55 73 58"
              fill="none"
              stroke="#111827"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        ) : (
          <g
            style={{
              animation:
                  isMapThinking || isPondering
                    ? "potatoEyeMove 1.2s ease-in-out infinite"
                    : "none",
            }}
          >
            <g
              style={{
                animation:
                  isMapThinking || isPondering
                    ? "potatoPupilFocus 1.5s ease-in-out infinite"
                    : "none",
              }}
            >
              <circle cx="50" cy="58" r="2.6" fill="#111827" />
              <circle cx="70" cy="58" r="2.6" fill="#111827" />
            </g>
          </g>
        )}
        <g>
          <line
            x1="45"
            y1="52"
            x2="55"
            y2="52"
            stroke="#2A1A13"
            strokeWidth="1.4"
            strokeLinecap="round"
            opacity="0.36"
          />
          <line
            x1="65"
            y1="52"
            x2="75"
            y2="52"
            stroke="#2A1A13"
            strokeWidth="1.4"
            strokeLinecap="round"
            opacity="0.36"
          />
        </g>
        <circle cx="60" cy="70" r="3.1" fill="none" stroke="#2A1A13" strokeWidth="2" />
        <circle cx="42" cy="69" r="2.6" fill="#F6C8B5" opacity="0.7" />
        <circle cx="78" cy="69" r="2.6" fill="#F6C8B5" opacity="0.7" />
        <path d="M50 104 L48 110" stroke="#2A1A13" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M70 104 L72 110" stroke="#2A1A13" strokeWidth="2.2" strokeLinecap="round" />
        <g>
          <path
            d="M62 20 C66 10,79 10,82 20 C77 24,69 24,62 20Z"
            fill="#47B26B"
            stroke="#1D6B37"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M70 20 C70 16,71 14,73 12"
            fill="none"
            stroke="#1D6B37"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </g>

        {shouldHoldMap ? (
          <g
            style={{
              transformOrigin: "60px 78px",
              animation: isMapThinking
                ? "potatoMapInspect 1.1s ease-in-out infinite"
                : "potatoMapWiggle 1.3s ease-in-out infinite",
            }}
          >
            <path
              d="M46 74 C40 70,34 69,30 67"
              fill="none"
              stroke="#2A1A13"
              strokeWidth="2.6"
              strokeLinecap="round"
            />
            <path
              d="M74 74 C80 70,86 69,90 67"
              fill="none"
              stroke="#2A1A13"
              strokeWidth="2.6"
              strokeLinecap="round"
            />
            <rect
              x="42"
              y="64"
              width="36"
              height="24"
              rx="4.5"
              fill="#E0F2FE"
              stroke="#2A1A13"
              strokeWidth="2"
            />
            <path d="M50 67 V85 M60 67 V85 M70 67 V85" stroke="#38BDF8" strokeWidth="1.6" />
            <circle cx="54" cy="74" r="1.8" fill="#F97316" />
            <path d="M64 80 L70 74" stroke="#0EA5E9" strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="41.5" cy="75.5" r="2.4" fill="#2A1A13" />
            <circle cx="78.5" cy="75.5" r="2.4" fill="#2A1A13" />
            {isRanking ? (
              <g>
                <circle cx="75" cy="66" r="5" fill="#F59E0B" stroke="#2A1A13" strokeWidth="1.2" />
                <text x="75" y="69" textAnchor="middle" fontSize="5.6" fill="#ffffff" fontWeight="700">
                  1
                </text>
              </g>
            ) : null}
          </g>
        ) : null}

        {isSearching ? (
          <g>
            <g style={{ animation: "potatoThoughtBubble 1.2s ease-in-out infinite" }}>
              <circle cx="34" cy="40" r="3.6" fill="#ffffff" stroke="#2A1A13" strokeWidth="1.4" />
              <circle cx="26" cy="31.5" r="4.8" fill="#ffffff" stroke="#2A1A13" strokeWidth="1.4" />
              <rect
                x="10"
                y="8"
                width="34"
                height="20"
                rx="10"
                fill="#ffffff"
                stroke="#2A1A13"
                strokeWidth="1.7"
              />
              <circle
                cx="20"
                cy="18"
                r="1.8"
                fill="#94A3B8"
                style={{ animation: "potatoThoughtDot 1.2s ease-in-out infinite" }}
              />
              <circle
                cx="27"
                cy="18"
                r="1.8"
                fill="#94A3B8"
                style={{ animation: "potatoThoughtDot 1.2s ease-in-out infinite 0.2s" }}
              />
              <circle
                cx="34"
                cy="18"
                r="1.8"
                fill="#94A3B8"
                style={{ animation: "potatoThoughtDot 1.2s ease-in-out infinite 0.4s" }}
              />
            </g>
            <path
              d="M77 75 C73 72,68 71,63 72"
              fill="none"
              stroke="#2A1A13"
              strokeWidth="2.6"
              strokeLinecap="round"
            />
            <circle cx="63" cy="72" r="2.2" fill="#2A1A13" />
            <circle cx="50" cy="58" r="12" fill="#dbeafe" stroke="#2563EB" strokeWidth="2.6" />
            <line x1="58" y1="66" x2="64" y2="72" stroke="#2A1A13" strokeWidth="3" strokeLinecap="round" />
            <circle cx="50" cy="58" r="4.5" fill="#111827" />
            <circle cx="48.8" cy="56.8" r="1.4" fill="#ffffff" />
          </g>
        ) : null}

        {isPondering ? (
          <g>
            <path
              d="M40 74 C34 77,31 83,31 89"
              fill="none"
              stroke="#2A1A13"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
            <path
              d="M78 74 C73 72,69 70,66 69"
              fill="none"
              stroke="#2A1A13"
              strokeWidth="2.6"
              strokeLinecap="round"
            />
            <circle cx="63.5" cy="68.5" r="2.2" fill="#2A1A13" />
          </g>
        ) : null}

        {isEmpty ? (
          <g>
            <path
              d="M42 73 C34 68,29 64,25 58"
              fill="none"
              stroke="#2A1A13"
              strokeWidth="2.6"
              strokeLinecap="round"
            />
            <path
              d="M78 73 C86 68,91 64,95 58"
              fill="none"
              stroke="#2A1A13"
              strokeWidth="2.6"
              strokeLinecap="round"
            />
            <g
              style={{
                animation: "potatoQuestionTilt 1.35s ease-in-out infinite",
                transformOrigin: "88px 30px",
              }}
            >
              <circle cx="88" cy="30" r="11" fill="#ffffff" stroke="#2A1A13" strokeWidth="1.7" />
              <text
                x="88"
                y="35"
                textAnchor="middle"
                fontSize="17"
                fill="#2563EB"
                fontWeight="800"
              >
                ?
              </text>
            </g>
          </g>
        ) : null}

      </svg>
    </div>
  );
}

export function PotatoLoadingCard({
  title,
  description,
  footerText,
  animation = "generic",
  compact = false,
  className = "",
}: PotatoLoadingCardProps) {
  return (
    <div
      className={`w-full rounded-3xl border border-brand-200 bg-white/95 shadow-2xl backdrop-blur dark:border-brand-400/30 dark:bg-[#0b211f]/95 ${
        compact ? "max-w-none px-4 py-4" : "max-w-sm px-5 py-5"
      } ${className}`}
    >
      <PotatoLoadingStyles />
      <div className="flex items-center gap-4">
        <PotatoCharacter animation={animation} compact={compact} />
        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</p>
          {description ? (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
              {description}
            </p>
          ) : null}
          {footerText ? (
            <p className={`${compact ? "mt-1.5 text-[11px]" : "mt-2 text-xs"} text-brand-700 dark:text-brand-200`}>
              {footerText}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function PotatoLoadingOverlay() {
  const { isOpen, title, description, footerText, animation, dimmed } = useUiLoadingStore();

  if (!isOpen) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[1800] flex items-center justify-center px-4">
      {dimmed ? <div className="absolute inset-0 bg-slate-900/5" /> : null}
      <PotatoLoadingCard
        title={title}
        description={description}
        footerText={footerText}
        animation={animation}
      />
    </div>
  );
}
