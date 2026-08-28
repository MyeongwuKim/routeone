import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { QueryClient } from "@tanstack/react-query";
import { createServer } from "vite";

let server;
let cache;
let getSharedRouteLikeStore;
let sharedRouteLikeMutationKey;

before(async () => {
  server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL("..", import.meta.url)),
    envDir: fileURLToPath(new URL(".", import.meta.url)),
    resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  cache = await server.ssrLoadModule(
    "/src/features/shared-route/queries/sharedRouteCache.ts"
  );
  ({ getSharedRouteLikeStore } = await server.ssrLoadModule(
    "/src/features/shared-route/stores/sharedRouteLikeStore.ts"
  ));
  ({ SHARED_ROUTE_LIKE_MUTATION_KEY: sharedRouteLikeMutationKey } =
    await server.ssrLoadModule(
      "/src/features/shared-route/queries/sharedRouteQueryKeys.ts"
    ));
});

after(async () => {
  await server?.close();
});

function createRoute(id, likedByMe = false, likeCount = 4) {
  return {
    id,
    visibility: "PUBLIC",
    likedByMe,
    likeCount,
    owner: { id: `owner-${id}`, displayName: id, avatarUrl: null },
    stops: [{ id: `stop-${id}`, place: { title: `${id} 장소` } }],
  };
}

function createInfiniteData(mode, routePages) {
  const connectionKey =
    mode === "liked" ? "likedRouteConnection" : "sharedRouteConnection";

  return {
    pages: routePages.map((nodes, index) => ({
      [connectionKey]: {
        nodes,
        pageInfo: {
          endCursor: `cursor-${index + 1}`,
          hasNextPage: index < routePages.length - 1,
        },
      },
    })),
    pageParams: routePages.map((_, index) =>
      index === 0 ? null : `cursor-${index}`
    ),
  };
}

function getRoute(data, mode, routeId) {
  return cache.getSharedRouteInfiniteList(data, mode).find(
    (route) => route.id === routeId
  );
}

function createDeferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

function createPendingLikeMutation(queryClient) {
  const started = createDeferred();
  const deferred = createDeferred();
  const mutation = queryClient.getMutationCache().build(queryClient, {
    mutationKey: sharedRouteLikeMutationKey,
    gcTime: Infinity,
    mutationFn: () => {
      started.resolve();
      return deferred.promise;
    },
  });

  return {
    mutation,
    result: mutation.execute(undefined),
    started: started.promise,
    resolve: deferred.resolve,
  };
}

test("좋아요와 취소는 현재 상태와의 차이만큼 개수를 변경한다", () => {
  const unliked = createRoute("route-a");
  const liked = cache.getSharedRouteLikeState(unliked, true);

  assert.deepEqual(liked, { likedByMe: true, likeCount: 5 });
  assert.deepEqual(cache.getSharedRouteLikeState(liked, false), {
    likedByMe: false,
    likeCount: 4,
  });
  assert.deepEqual(cache.getSharedRouteLikeState(unliked), {
    likedByMe: false,
    likeCount: 4,
  });
});

test("이미 적용된 좋아요와 취소를 다시 적용해도 개수가 중복 증감하지 않는다", () => {
  for (const likedByMe of [false, true]) {
    const route = createRoute("route-a", likedByMe);
    const state = cache.getSharedRouteLikeState(route, likedByMe);

    assert.deepEqual(state, { likedByMe, likeCount: 4 });
    assert.deepEqual(cache.getSharedRouteLikeState(state, likedByMe), state);
  }
});

test("좋아요 수가 0인 상태에서 취소해도 음수가 되지 않는다", () => {
  assert.deepEqual(
    cache.getSharedRouteLikeState(createRoute("route-a", true, 0), false),
    { likedByMe: false, likeCount: 0 }
  );
});

for (const mode of ["feed", "liked"]) {
  test(`${mode} 캐시의 좋아요와 취소를 갱신하면서 기존 데이터는 변경하지 않는다`, () => {
    const route = createRoute("route-a");
    const otherRoute = createRoute("route-b", true, 8);
    const data = createInfiniteData(mode, [[route, otherRoute]]);
    const previousData = structuredClone(data);
    const likedData = cache.optimisticUpdateSharedRouteInfiniteLike({
      data,
      mode,
      route,
      liked: true,
    });
    const likedRoute = getRoute(likedData, mode, route.id);

    assert.deepEqual(likedRoute, { ...route, likedByMe: true, likeCount: 5 });
    assert.deepEqual(getRoute(likedData, mode, otherRoute.id), otherRoute);
    assert.deepEqual(data, previousData);

    const unlikedData = cache.optimisticUpdateSharedRouteInfiniteLike({
      data: likedData,
      mode,
      route: likedRoute,
      liked: false,
      keepUnlikedRoute: true,
    });
    const repeatedUnlikeData = cache.optimisticUpdateSharedRouteInfiniteLike({
      data: unlikedData,
      mode,
      route: getRoute(unlikedData, mode, route.id),
      liked: false,
      keepUnlikedRoute: true,
    });

    assert.deepEqual(repeatedUnlikeData, data);
  });
}

test("좋아요 목록의 취소 항목은 keepUnlikedRoute 설정에 따라 유지하거나 제거한다", () => {
  const route = createRoute("route-a", true, 5);
  const otherRoute = createRoute("route-b", true, 8);
  const data = createInfiniteData("liked", [[route, otherRoute]]);
  const keptData = cache.optimisticUpdateSharedRouteInfiniteLike({
    data,
    mode: "liked",
    route,
    liked: false,
    keepUnlikedRoute: true,
  });
  const removedData = cache.optimisticUpdateSharedRouteInfiniteLike({
    data,
    mode: "liked",
    route,
    liked: false,
  });

  assert.deepEqual(cache.getSharedRouteInfiniteList(keptData, "liked"), [
    { ...route, likedByMe: false, likeCount: 4 },
    otherRoute,
  ]);
  assert.deepEqual(cache.getSharedRouteInfiniteList(removedData, "liked"), [
    otherRoute,
  ]);
});

for (const mode of ["feed", "liked"]) {
  test(`${mode} 실패 복구는 다른 루트의 동시 갱신과 추가된 페이지를 유지한다`, () => {
    const route = createRoute("route-a", true, 5);
    const otherRoute = createRoute("route-b", true, 8);
    const previousData = createInfiniteData(mode, [[route, otherRoute]]);
    const changedRoute = { ...route, likedByMe: false, likeCount: 4 };
    const changedOtherRoute = { ...otherRoute, likeCount: 12 };
    const addedRoute = createRoute("route-c", true, 6);
    const nextPageRoute = createRoute("route-d", true, 3);
    const currentData = createInfiniteData(mode, [
      [addedRoute, changedRoute, changedOtherRoute],
      [nextPageRoute],
    ]);
    const currentSnapshot = structuredClone(currentData);
    const restoredData = cache.restoreSharedRouteInInfiniteData(
      currentData,
      previousData,
      mode,
      route.id
    );

    const expectedData = structuredClone(currentData);
    cache.getSharedRouteConnection(expectedData.pages[0], mode).nodes[1] = route;

    assert.deepEqual(restoredData, expectedData);
    assert.deepEqual(currentData, currentSnapshot);
  });
}

test("취소로 제거한 루트는 원래 페이지 위치에 복원하고 다른 루트의 갱신을 유지한다", () => {
  const firstRoute = createRoute("route-a", true);
  const previousNeighbor = createRoute("route-b", true, 8);
  const route = createRoute("route-c", true, 5);
  const nextNeighbor = createRoute("route-d", true, 3);
  const previousData = createInfiniteData("liked", [
    [firstRoute],
    [previousNeighbor, route, nextNeighbor],
  ]);
  const changedNeighbor = { ...previousNeighbor, likeCount: 12 };
  const addedRoute = createRoute("route-e", true, 2);
  const currentData = createInfiniteData("liked", [
    [addedRoute, firstRoute],
    [changedNeighbor, nextNeighbor],
  ]);
  const restoredData = cache.restoreSharedRouteInInfiniteData(
    currentData,
    previousData,
    "liked",
    route.id
  );
  const expectedData = createInfiniteData("liked", [
    [addedRoute, firstRoute],
    [changedNeighbor, route, nextNeighbor],
  ]);

  assert.deepEqual(restoredData, expectedData);
});

test("실패한 좋아요로 새로 추가된 루트만 제거하고 다른 좋아요 추가는 유지한다", () => {
  const existingRoute = createRoute("route-a", true, 5);
  const failedRoute = createRoute("route-b", true, 1);
  const addedRoute = createRoute("route-c", true, 3);
  const previousData = createInfiniteData("liked", [[existingRoute]]);
  const currentData = createInfiniteData("liked", [
    [addedRoute, failedRoute, existingRoute],
  ]);
  const restoredData = cache.restoreSharedRouteInInfiniteData(
    currentData,
    previousData,
    "liked",
    failedRoute.id
  );

  assert.deepEqual(
    restoredData,
    createInfiniteData("liked", [[addedRoute, existingRoute]])
  );
});

test("같은 QueryClient의 화면들은 요청 중 마지막 좋아요 선택을 함께 읽는다", () => {
  const queryClient = new QueryClient();
  const feedStore = getSharedRouteLikeStore(queryClient);
  const routeId = "route-a";
  const likedState = { likedByMe: true, likeCount: 5 };
  const unlikedState = { likedByMe: false, likeCount: 4 };
  feedStore.getState().setPendingLike(routeId, likedState);

  const likedPageStore = getSharedRouteLikeStore(queryClient);
  assert.deepEqual(likedPageStore.getState().pendingLikes.get(routeId), likedState);
  const observedStates = [];
  const unsubscribe = feedStore.subscribe((state) => {
    observedStates.push(state.pendingLikes.get(routeId));
  });

  try {
    likedPageStore.getState().setPendingLike(routeId, unlikedState);

    assert.deepEqual(feedStore.getState().pendingLikes.get(routeId), unlikedState);
    assert.deepEqual(observedStates, [unlikedState]);
  } finally {
    unsubscribe();
  }
});

test("한 루트의 요청을 완료해도 다른 루트의 진행 중 선택은 유지한다", () => {
  const store = getSharedRouteLikeStore(new QueryClient());
  const routeAState = { likedByMe: true, likeCount: 5 };
  const routeBState = { likedByMe: false, likeCount: 2 };
  store.getState().setPendingLike("route-a", routeAState);
  store.getState().setPendingLike("route-b", routeBState);
  const previousPendingLikes = store.getState().pendingLikes;

  store.getState().setPendingLike("route-a");

  assert.deepEqual([...store.getState().pendingLikes], [["route-b", routeBState]]);
  assert.deepEqual([...previousPendingLikes], [
    ["route-a", routeAState],
    ["route-b", routeBState],
  ]);
});

test("서로 다른 QueryClient는 동일한 루트의 진행 상태를 공유하지 않는다", () => {
  const firstStore = getSharedRouteLikeStore(new QueryClient());
  const secondStore = getSharedRouteLikeStore(new QueryClient());
  const likedState = { likedByMe: true, likeCount: 5 };
  const unlikedState = { likedByMe: false, likeCount: 4 };
  firstStore.getState().setPendingLike("route-a", likedState);

  assert.equal(secondStore.getState().pendingLikes.size, 0);

  secondStore.getState().setPendingLike("route-a", unlikedState);
  assert.deepEqual(firstStore.getState().pendingLikes.get("route-a"), likedState);

  firstStore.getState().setPendingLike("route-a");
  assert.deepEqual(secondStore.getState().pendingLikes.get("route-a"), unlikedState);
});

for (const operation of ["clear", "remove"]) {
  test(`${operation}로 진행 중 요청을 무효화하고 이후의 새 선택은 보존한다`, async () => {
    const queryClient = new QueryClient();
    const store = getSharedRouteLikeStore(queryClient);
    const pending = createPendingLikeMutation(queryClient);
    const previousGeneration = store.getState().generation;
    store.getState().setPendingLike("route-a", { likedByMe: true, likeCount: 5 });

    try {
      await pending.started;
      if (operation === "clear") {
        queryClient.clear();
      } else {
        queryClient.getMutationCache().remove(pending.mutation);
      }

      assert.equal(store.getState().generation, previousGeneration + 1);
      assert.equal(store.getState().pendingLikes.size, 0);

      const nextState = { likedByMe: false, likeCount: 4 };
      store.getState().setPendingLike("route-a", nextState);
      pending.resolve(true);
      await pending.result;
      queryClient.getMutationCache().remove(pending.mutation);

      assert.equal(store.getState().generation, previousGeneration + 1);
      assert.deepEqual(store.getState().pendingLikes.get("route-a"), nextState);
    } finally {
      pending.resolve(true);
      await pending.result;
      queryClient.clear();
    }
  });
}

test("완료된 좋아요 요청을 캐시에서 제거해도 다른 진행 중 요청은 유지한다", async () => {
  const queryClient = new QueryClient();
  const store = getSharedRouteLikeStore(queryClient);
  const first = createPendingLikeMutation(queryClient);
  const second = createPendingLikeMutation(queryClient);
  const otherState = { likedByMe: false, likeCount: 4 };
  store.getState().setPendingLike("route-a", { likedByMe: true, likeCount: 5 });
  store.getState().setPendingLike("route-b", otherState);
  const generation = store.getState().generation;

  try {
    await Promise.all([first.started, second.started]);
    first.resolve(true);
    await first.result;
    store.getState().setPendingLike("route-a");
    queryClient.getMutationCache().remove(first.mutation);

    assert.equal(store.getState().generation, generation);
    assert.deepEqual([...store.getState().pendingLikes], [["route-b", otherState]]);
  } finally {
    first.resolve(true);
    second.resolve(true);
    await Promise.all([first.result, second.result]);
    queryClient.clear();
  }
});
