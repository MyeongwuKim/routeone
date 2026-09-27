/**
 * 용도:
 * 로그인한 사용자의 ID, 표시 이름, 권한 등 사용자 정보를 화면 전체에서 공유한다.
 * 헤더와 내 정보, 계정 관리 화면이 별도 조회 없이 동일한 사용자를 표시할 때 사용한다.
 *
 * 동작 방식:
 * 로그인·세션 조회 성공 시 user를 저장하고 로그아웃 시 제거한다.
 * 새로고침 후 임시 표시를 위해 localStorage에 보존하되 저장 버전이 바뀌면 초기화한다.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { MeQuery } from "@/generated/graphql";

export type AuthUser = NonNullable<MeQuery["me"]>;

type AuthUserState = {
  /** 마지막 세션 조회나 로그인에서 확인한 사용자. 로그아웃 상태는 null */
  user: AuthUser | null;
  /** 로그인 또는 세션 갱신 결과로 user를 교체하며 null도 그대로 저장한다. */
  setUser: (user: AuthUser | null) => void;
  /** 로그아웃·탈퇴 후 user를 null로 비우고 영속 저장값에도 반영한다. */
  clearUser: () => void;
};

export const useAuthUserStore = create<AuthUserState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
      clearUser: () => set({ user: null }),
    }),
    {
      name: "routeone-auth-user",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
      }),
      version: 2,
      migrate: () => ({
        user: null,
      }),
    }
  )
);
