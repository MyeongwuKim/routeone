import { NavLink, Outlet, useLocation } from "react-router-dom";
import type { IconType } from "react-icons";
import {
  MdMap,
  MdOutlineAccountCircle,
  MdOutlineHub,
  MdOutlineRoute,
} from "react-icons/md";

type TabItem = {
  to: string;
  label: string;
  icon: IconType;
};

const tabs: TabItem[] = [
  { to: "/home", label: "지도", icon: MdMap },
  { to: "/my-route", label: "내 루트", icon: MdOutlineRoute },
  { to: "/shared-route", label: "공유 루트", icon: MdOutlineHub },
  { to: "/me", label: "내 정보", icon: MdOutlineAccountCircle },
];

function BottomTabLayout() {
  const { pathname } = useLocation();
  const isHome = pathname === "/home";
  const shouldSlideInPage = pathname.startsWith("/me/");

  return (
    <div className="relative h-dvh overflow-hidden bg-brand-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <main className="absolute inset-x-0 bottom-[92px] top-0">
        <div
          className={isHome ? "h-full" : "h-full overflow-x-hidden overflow-y-auto"}
        >
          <div
            key={pathname}
            className={
              isHome
                ? "h-full"
                : `mx-auto w-full max-w-md px-5 py-3 ${
                    shouldSlideInPage ? "route-page-slide-enter" : ""
                  }`
            }
          >
            <Outlet />
          </div>
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-brand-200 bg-white/95 px-3 pb-[max(0.7rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-6px_20px_rgba(15,23,42,0.08)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 dark:shadow-[0_-6px_20px_rgba(0,0,0,0.35)]">
        <div className="mx-auto w-full max-w-md">
          <ul className="grid grid-cols-4 gap-1">
            {tabs.map((tab) => (
              <li key={tab.to}>
                <NavLink
                  to={tab.to}
                  className={({ isActive }) =>
                    `flex h-16 flex-col items-center justify-center rounded-xl text-xs font-semibold transition ${
                      isActive
                        ? "bg-brand-50 text-brand-700 dark:bg-brand-900/50 dark:text-brand-200"
                        : "text-slate-500 hover:bg-brand-50 hover:text-brand-700 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-brand-200"
                    }`
                  }
                >
                  <span className="text-[26px] leading-none">
                    <tab.icon />
                  </span>
                  <span className="mt-1.5 text-[13px]">{tab.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </div>
  );
}

export default BottomTabLayout;
