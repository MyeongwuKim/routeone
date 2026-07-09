import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { MeQuery } from "@/generated/graphql";

export type AuthUser = NonNullable<MeQuery["me"]>;

type AuthUserState = {
  user: AuthUser | null;
  setUser: (user: AuthUser | null) => void;
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
      version: 1,
    }
  )
);

export function getAuthUserLabel(user: AuthUser | null) {
  return user?.accountId ?? user?.displayName ?? user?.email ?? null;
}
