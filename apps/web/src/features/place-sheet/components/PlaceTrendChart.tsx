import { useMemo, useState, type CSSProperties } from "react";
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  type TooltipItem,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { IoStatsChart } from "react-icons/io5";
import {
  toWeeklyAndMonthlySeries,
  type TouristConcentrationPoint,
} from "@/lib/visitKoreaTourApi";

type TrendTabType = "weekly" | "monthly";

type PlaceTrendChartProps = {
  points: TouristConcentrationPoint[];
  isLoading: boolean;
  errorMessage: string | null;
  isTouristAttraction: boolean;
};

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler
);

function formatYmdLabel(ymd: string) {
  if (!/^\d{8}$/.test(ymd)) {
    return ymd;
  }

  const month = ymd.slice(4, 6);
  const day = ymd.slice(6, 8);
  return `${month}.${day}`;
}

function buildTrendChartData(points: TouristConcentrationPoint[]) {
  return {
    labels: points.map((point) => formatYmdLabel(point.baseYmd)),
    datasets: [
      {
        label: "예측 집중률",
        data: points.map((point) => point.concentrationRate),
        borderColor: "#0d9488",
        backgroundColor: "rgba(13, 148, 136, 0.14)",
        borderWidth: 2.5,
        pointRadius: 2.5,
        pointHoverRadius: 4,
        fill: true,
        tension: 0.34,
      },
    ],
  };
}

function SkeletonBar({
  className,
  rounded = "rounded-full",
  style,
}: {
  className: string;
  rounded?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={`skeleton-shimmer block bg-slate-200 dark:bg-slate-700 ${rounded} ${className}`}
      style={style}
    />
  );
}

function TrendChartSkeleton() {
  return (
    <div className="flex min-h-44 flex-col justify-end gap-3 rounded-xl bg-brand-50 px-4 py-4 dark:bg-slate-950/35">
      <div className="grid h-28 grid-cols-7 items-end gap-2">
        {[44, 72, 52, 88, 66, 96, 58].map((height, index) => (
          <SkeletonBar
            key={index}
            className="w-full"
            rounded="rounded-t-lg rounded-b-sm"
            style={{ height: `${height}%` }}
          />
        ))}
      </div>
      <SkeletonBar className="h-3 w-3/4" />
      <SkeletonBar className="h-3 w-1/2" />
    </div>
  );
}

function PlaceTrendChart({
  points,
  isLoading,
  errorMessage,
  isTouristAttraction,
}: PlaceTrendChartProps) {
  const [trendTab, setTrendTab] = useState<TrendTabType>("monthly");
  const concentrationSeries = useMemo(
    () => toWeeklyAndMonthlySeries(points),
    [points]
  );
  const activeTrendPoints =
    trendTab === "weekly"
      ? concentrationSeries.weekly
      : concentrationSeries.monthly;
  const trendChartData = useMemo(
    () => buildTrendChartData(activeTrendPoints),
    [activeTrendPoints]
  );
  const trendChartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          mode: "index" as const,
          intersect: false,
          callbacks: {
            label: (context: TooltipItem<"line">) =>
              `예측 집중률 ${(context.parsed.y ?? 0).toFixed(1)}`,
          },
        },
      },
      scales: {
        x: {
          ticks: {
            maxTicksLimit: trendTab === "weekly" ? 7 : 8,
            color: "#475569",
            font: {
              size: 11,
            },
          },
          grid: {
            display: false,
          },
        },
        y: {
          beginAtZero: true,
          suggestedMax: 100,
          ticks: {
            color: "#64748b",
            callback: (value: string | number) => `${value}`,
            font: {
              size: 11,
            },
          },
          grid: {
            color: "rgba(148, 163, 184, 0.25)",
          },
        },
      },
      interaction: {
        mode: "nearest" as const,
        intersect: false,
      },
    }),
    [trendTab]
  );

  return (
    <section className="rounded-3xl border border-brand-200 bg-white p-4 shadow-sm dark:border-brand-400/30 dark:bg-slate-900/70">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="font-trip text-sm text-brand-700">예측 집중률 추이</p>
        <div className="inline-flex rounded-full border border-brand-200 bg-brand-50 p-1 dark:border-brand-400/30 dark:bg-slate-950/45">
          <button
            type="button"
            onClick={() => setTrendTab("weekly")}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              trendTab === "weekly"
                ? "bg-brand-600 text-white shadow-sm"
                : "text-brand-700"
            }`}
          >
            주간
          </button>
          <button
            type="button"
            onClick={() => setTrendTab("monthly")}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              trendTab === "monthly"
                ? "bg-brand-600 text-white shadow-sm"
                : "text-brand-700"
            }`}
          >
            월간
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-brand-100 bg-white px-3 py-3 dark:border-brand-400/25 dark:bg-slate-950/40">
        {isLoading ? (
          <TrendChartSkeleton />
        ) : activeTrendPoints.length > 0 ? (
          <div className="h-44 w-full">
            <Line data={trendChartData} options={trendChartOptions} />
          </div>
        ) : (
          <div className="flex min-h-44 flex-col items-center justify-center rounded-xl border border-dashed border-brand-200 bg-brand-50/70 px-3 text-center text-sm text-slate-500 dark:border-brand-400/30 dark:bg-slate-950/35 dark:text-slate-300">
            <IoStatsChart className="mb-2 text-lg text-brand-500" />
            <p>
              {errorMessage ??
                (isTouristAttraction
                  ? "선택한 관광지의 예측 집중률 데이터가 아직 없습니다."
                  : "예측 집중률 데이터는 관광지에 한해 제공됩니다.")}
            </p>
          </div>
        )}
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">
        이동통신 기반 방문자 집계 데이터를 바탕으로 산출한 관광지 예측 집중률
        추이입니다.
      </p>
    </section>
  );
}

export default PlaceTrendChart;
