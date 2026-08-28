import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { setImmediate as flushTasks } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { createServer } from "vite";

let server;
let authApi;
let queryKey;
let useAccountUser;
let useAuthUserStore;
let AccountSummaryCard;
let AccountDetailsSection;
let MyInfoPage;
let MyAccountPage;
let text;

const account = {
  id: "account-loading-test",
  accountId: "account-loading-test",
  email: "account@example.test",
  displayName: "계정 표시 테스트",
  avatarUrl: null,
  authProviders: ["GOOGLE"],
  role: "USER",
  createdAt: "2026-08-01T00:00:00.000Z",
};

before(async () => {
  server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL("..", import.meta.url)),
    envDir: fileURLToPath(new URL(".", import.meta.url)),
    resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  ({ authApi, ME_QUERY_KEY: queryKey } = await server.ssrLoadModule("/src/api/authApi.ts"));
  ({ useAccountUser } = await server.ssrLoadModule("/src/components/account/useAccountUser.ts"));
  ({ useAuthUserStore } = await server.ssrLoadModule("/src/stores/authUserStore.ts"));
  ({ default: AccountSummaryCard } = await server.ssrLoadModule("/src/components/account/AccountSummaryCard.tsx"));
  ({ default: AccountDetailsSection } = await server.ssrLoadModule("/src/components/account/AccountDetailsSection.tsx"));
  ({ default: MyInfoPage } = await server.ssrLoadModule("/src/pages/MyInfoPage.tsx"));
  ({ default: MyAccountPage } = await server.ssrLoadModule("/src/pages/MyAccountPage.tsx"));
  const { getUiText } = await server.ssrLoadModule("/src/lib/uiText.ts");
  text = getUiText("ko");
});

after(async () => {
  await server?.close();
});

function createHarness(t, { data, error, fetchStatus, authUser = null } = {}) {
  t.mock.method(globalThis, "fetch", () => {
    throw new Error("계정 렌더링 테스트에서 외부 요청을 실행할 수 없습니다.");
  });
  // Zustand's SSR subscription reads the initial snapshot, not getState().
  const authSnapshot = useAuthUserStore.getInitialState();
  const previousUser = authSnapshot.user;
  authSnapshot.user = authUser;
  t.after(() => { authSnapshot.user = previousUser; });

  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        retryOnMount: false,
        refetchOnMount: false,
        gcTime: Infinity,
      },
    },
  });
  t.after(() => client.clear());
  if (data !== undefined) client.setQueryData(queryKey, data);
  const query = client.getQueryCache().build(client, { queryKey });
  if (error) query.setState({ status: "error", error, fetchStatus: "idle" });
  if (fetchStatus) query.setState({ fetchStatus });

  return {
    client,
    render(Component) {
      return renderToStaticMarkup(createElement(
        QueryClientProvider,
        { client },
        createElement(MemoryRouter, null, createElement(Component))
      ));
    },
  };
}

function assertNoAccountPlaceholders(markup) {
  for (const placeholder of [
    text.account.fallbackName,
    text.myInfo.accountChecking,
    text.myInfo.localTestAccount,
    text.account.providers.UNKNOWN,
  ]) {
    assert.equal(markup.includes(placeholder), false, `${placeholder} 표시 금지`);
  }
}

function assertLoading(markup) {
  assert.match(markup, /skeleton-shimmer/);
  assert.match(markup, /role="status"/);
  assert.match(markup, /aria-busy="true"/);
  assert.ok(markup.includes(text.account.loading));
  assert.doesNotMatch(markup, /role="alert"/);
  assertNoAccountPlaceholders(markup);
}

function assertEnabledButton(markup, label) {
  const button = [...markup.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)]
    .map(([element]) => element)
    .find((element) => element.includes(label));
  assert.ok(button, `${label} 버튼이 표시되어야 합니다.`);
  assert.doesNotMatch(button, /\sdisabled(?:=|[\s>])/);
}

function assertLoadError(markup) {
  assert.match(markup, /role="alert"/);
  assert.ok(markup.includes(text.account.loadError));
  assertEnabledButton(markup, text.common.retry);
  assert.doesNotMatch(markup, /skeleton-shimmer/);
  assertNoAccountPlaceholders(markup);
}

function assertAccount(markup) {
  assert.ok(markup.includes(account.displayName));
  assert.ok(markup.includes(account.email));
  assert.ok(markup.includes(text.account.providers.GOOGLE));
  assert.doesNotMatch(markup, /skeleton-shimmer|role="alert"/);
  assertNoAccountPlaceholders(markup);
}

test("요약 카드와 계정 상세는 계정이 없는 대기 중 임의 텍스트 대신 스켈레톤을 표시한다", () => {
  for (const Component of [AccountSummaryCard, AccountDetailsSection]) {
    assertLoading(renderToStaticMarkup(createElement(Component, {
      user: null,
      isLoading: true,
      onRetry() {},
      onClick() {},
    })));
  }
});

test("계정이 없는 완료 상태는 스켈레톤 대신 오류와 재시도 버튼을 표시한다", () => {
  for (const Component of [AccountSummaryCard, AccountDetailsSection]) {
    assertLoadError(renderToStaticMarkup(createElement(Component, {
      user: null,
      isLoading: false,
      onRetry() {},
      onClick() {},
    })));
  }
});

test("기존 계정 정보가 있으면 로딩 플래그보다 실제 계정 표시를 우선한다", () => {
  for (const Component of [AccountSummaryCard, AccountDetailsSection]) {
    assertAccount(renderToStaticMarkup(createElement(Component, {
      user: account,
      isLoading: true,
      onRetry() {},
      onClick() {},
    })));
  }
});

test("내 정보의 첫 조회 중에도 메뉴와 설정 버튼을 사용할 수 있다", (t) => {
  const { render } = createHarness(t);
  const markup = render(MyInfoPage);
  assertLoading(markup);
  for (const label of [
    text.myInfo.visitedRoutes,
    text.myInfo.likedRoutes,
    text.myInfo.darkMode,
    text.myInfo.language,
    text.myInfo.notificationSettings,
    text.myInfo.appInfo,
  ]) {
    assertEnabledButton(markup, label);
  }
});

test("계정 상세의 첫 조회 중에도 뒤로가기와 로그아웃 버튼을 사용할 수 있다", (t) => {
  const { render } = createHarness(t);
  const markup = render(MyAccountPage);
  assertLoading(markup);
  assertEnabledButton(markup, text.common.backToMyInfo);
  assertEnabledButton(markup, text.account.logout);
});

test("me:null 응답은 두 화면에서 무한 로딩 없이 재시도 가능한 오류가 된다", (t) => {
  const { render } = createHarness(t, { data: { me: null } });
  for (const Page of [MyInfoPage, MyAccountPage]) assertLoadError(render(Page));
});

test("계정 조회 실패는 오류를 표시하고 뒤로가기와 로그아웃을 막지 않는다", (t) => {
  const { render } = createHarness(t, { error: new Error("테스트 조회 실패") });
  assertLoadError(render(MyInfoPage));
  const markup = render(MyAccountPage);
  assertLoadError(markup);
  assertEnabledButton(markup, text.common.backToMyInfo);
  assertEnabledButton(markup, text.account.logout);
});

test("캐시된 me 계정은 배경 조회가 진행 중이거나 실패해도 계속 표시한다", (t) => {
  const { client, render } = createHarness(t, {
    data: { me: account },
    fetchStatus: "fetching",
  });
  for (const Page of [MyInfoPage, MyAccountPage]) assertAccount(render(Page));
  client.getQueryCache().find({ queryKey }).setState({
    error: new Error("테스트 배경 조회 실패"),
    status: "error",
    fetchStatus: "idle",
  });
  for (const Page of [MyInfoPage, MyAccountPage]) assertAccount(render(Page));
});

test("authUser 캐시가 있으면 me 조회 결과가 없어도 두 화면에 즉시 표시한다", (t) => {
  const { client, render } = createHarness(t, { authUser: account });
  assert.equal(client.getQueryData(queryKey), undefined);
  for (const Page of [MyInfoPage, MyAccountPage]) assertAccount(render(Page));
});

test("재시도는 실제 계정 조회를 다시 실행하고 성공하면 스켈레톤을 계정 정보로 바꾼다", async (t) => {
  let finishRequest;
  const pending = new Promise((resolve) => { finishRequest = resolve; });
  const request = t.mock.method(authApi, "me", () => pending);
  const { client, render } = createHarness(t, { data: { me: null } });
  let accountQuery;
  function AccountProbe() {
    accountQuery = useAccountUser();
    return createElement(AccountSummaryCard, {
      user: accountQuery.user,
      isLoading: accountQuery.isLoading,
      onRetry: accountQuery.retry,
      onClick() {},
    });
  }

  assertLoadError(render(AccountProbe));
  accountQuery.retry();
  assert.equal(request.mock.callCount(), 1);
  assertLoading(render(AccountProbe));
  finishRequest({ me: account });
  await flushTasks();
  assert.equal(client.getQueryData(queryKey).me, account);
  assertAccount(render(AccountProbe));
});
