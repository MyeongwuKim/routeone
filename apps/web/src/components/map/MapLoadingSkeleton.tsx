type MapLoadingSkeletonProps = {
  label: string;
};

export default function MapLoadingSkeleton({ label }: MapLoadingSkeletonProps) {
  return (
    <div
      role="status"
      aria-label={label}
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div className="skeleton-shimmer h-full w-full bg-[#edf2ef] dark:bg-[#102624]">
        <svg
          aria-hidden="true"
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 480 320"
          preserveAspectRatio="xMidYMid slice"
          fill="none"
        >
          <g className="fill-[#dfe8e2] dark:fill-[#1b3531]">
            <path d="M-20 12H122L150 79L81 124H-20Z" />
            <path d="M152 0H295L270 85L178 81Z" />
            <path d="M330 0H500V103L389 88L312 48Z" />
            <path d="M-20 157L81 145L119 216L76 320H-20Z" />
            <path d="M145 128L248 115L275 192L175 219L121 184Z" />
            <path d="M194 249L294 228L329 340H145Z" />
            <path d="M345 145L500 162V257L375 228Z" />
            <path d="M370 259L500 285V340H397Z" />
          </g>
          <path
            d="M290-30C365 50 249 93 318 169S333 268 372 350"
            strokeWidth="24"
            className="stroke-[#d3e4e6] dark:stroke-[#17393e]"
          />
          <g strokeWidth="10" className="stroke-white/90 dark:stroke-[#2a4440]">
            <path d="M-20 143L119 112L272 99L500 137" />
            <path d="M125-20L164 98L98 205L66 340" />
            <path d="M-20 246L152 233L301 205L500 253" />
            <path d="M404-20L365 110L411 340" />
          </g>
          <path
            d="M98 205L154 113L272 100L341 111L368 172"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="2 11"
            className="stroke-brand-600/30 dark:stroke-brand-300/25"
          />
          <g className="fill-brand-600/25 stroke-white dark:fill-brand-300/25 dark:stroke-[#102624]" strokeWidth="4">
            <circle cx="98" cy="205" r="10" />
            <circle cx="368" cy="172" r="13" />
          </g>
        </svg>
      </div>
      <div aria-hidden="true" className="absolute inset-x-4 bottom-4 flex justify-center">
        <span className="rounded-full border border-brand-100 bg-white/95 px-3 py-2 text-xs font-semibold text-brand-700 shadow-sm dark:border-brand-400/20 dark:bg-[#102624]/95 dark:text-brand-100">
          {label}
        </span>
      </div>
    </div>
  );
}
