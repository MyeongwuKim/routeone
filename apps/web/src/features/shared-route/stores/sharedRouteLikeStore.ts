import type { QueryClient } from "@tanstack/react-query";
import { createStore, type StoreApi } from "zustand/vanilla";
import type { SharedRouteLikeState } from "../queries/sharedRouteCache";
import { SHARED_ROUTE_LIKE_MUTATION_KEY } from "../queries/sharedRouteQueryKeys";

type SharedRouteLikeStore = {
  generation: number;
  pendingLikes: Map<string, SharedRouteLikeState>;
  setPendingLike: (routeId: string, state?: SharedRouteLikeState) => void;
};

const likeStores = new WeakMap<QueryClient, StoreApi<SharedRouteLikeStore>>();

// Share pending clicks across the feed and liked pages, including navigation mid-request.
export function getSharedRouteLikeStore(queryClient: QueryClient) {
  const existingStore = likeStores.get(queryClient);

  if (existingStore) {
    return existingStore;
  }

  const store = createStore<SharedRouteLikeStore>((set) => ({
    generation: 0,
    pendingLikes: new Map(),
    setPendingLike: (routeId, state) =>
      set((current) => {
        const pendingLikes = new Map(current.pendingLikes);

        if (state) {
          pendingLikes.set(routeId, state);
        } else {
          pendingLikes.delete(routeId);
        }

        return { pendingLikes };
      }),
  }));
  queryClient.getMutationCache().subscribe((event) => {
    if (
      event.type === "removed" &&
      event.mutation.state.status === "pending" &&
      event.mutation.options.mutationKey?.[0] === SHARED_ROUTE_LIKE_MUTATION_KEY[0]
    ) {
      store.setState((current) => ({
        generation: current.generation + 1,
        pendingLikes: new Map(),
      }));
    }
  });
  likeStores.set(queryClient, store);

  return store;
}
