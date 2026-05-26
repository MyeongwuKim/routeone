import { useMemo, useState } from "react";
import { FaHeart, FaRegHeart } from "react-icons/fa";

type SharedRoute = {
  id: string;
  title: string;
  author: string;
  days: string;
  spots: string[];
  likes: number;
};

const MOCK_SHARED_ROUTES: SharedRoute[] = [
  {
    id: "route-1",
    title: "속초 바다 감성 1박2일",
    author: "강원러버",
    days: "Day1~Day2",
    spots: ["속초해변", "대포항", "영금정", "아바이마을"],
    likes: 128,
  },
  {
    id: "route-2",
    title: "강릉 카페 + 해변 루트",
    author: "오션덕후",
    days: "Day1",
    spots: ["안목해변", "경포대", "강릉중앙시장"],
    likes: 94,
  },
  {
    id: "route-3",
    title: "평창-정선 드라이브 코스",
    author: "로드트립러",
    days: "Day1~Day2",
    spots: ["대관령양떼목장", "정선아리랑시장", "하이원"],
    likes: 73,
  },
];

function SharedRoutePage() {
  const [likedRouteIds, setLikedRouteIds] = useState<Set<string>>(new Set());

  const routes = useMemo(
    () =>
      MOCK_SHARED_ROUTES.map((route) => ({
        ...route,
        isLiked: likedRouteIds.has(route.id),
        totalLikes: route.likes + (likedRouteIds.has(route.id) ? 1 : 0),
      })),
    [likedRouteIds]
  );

  const handleToggleLike = (routeId: string) => {
    setLikedRouteIds((prev) => {
      const next = new Set(prev);
      if (next.has(routeId)) {
        next.delete(routeId);
      } else {
        next.add(routeId);
      }
      return next;
    });
  };

  return (
    <section className="space-y-3 pb-4">
      <div className="rounded-2xl border border-brand-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-brand-700">공유 루트 커뮤니티</p>
        <p className="mt-1 text-xs text-slate-500">
          댓글 없이 하트 평가만 가능한 공개 루트 피드
        </p>
      </div>

      {routes.map((route) => (
        <article
          key={route.id}
          className="rounded-2xl border border-brand-100 bg-white p-4 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">{route.title}</p>
              <p className="mt-1 text-xs text-slate-500">
                by {route.author} · {route.days}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleToggleLike(route.id)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                route.isLiked
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-slate-200 bg-white text-slate-500"
              }`}
            >
              <span className="inline-flex items-center gap-1">
                {route.isLiked ? <FaHeart /> : <FaRegHeart />}
                {route.totalLikes}
              </span>
            </button>
          </div>

          <ul className="mt-3 flex flex-wrap gap-1.5">
            {route.spots.map((spot) => (
              <li
                key={`${route.id}-${spot}`}
                className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-medium text-brand-700"
              >
                {spot}
              </li>
            ))}
          </ul>
        </article>
      ))}
    </section>
  );
}

export default SharedRoutePage;
