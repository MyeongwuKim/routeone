import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { QueryClient, QueryObserver } from "@tanstack/react-query";

const queryKey = ["notification-inbox"];
const authEvent = "routeone:auth-session-change";
const compiled = ts.transpileModule(
  readFileSync(new URL("../src/features/notifications/notificationBadgeSync.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
).outputText;

const inbox = (count) => ({
  unreadNotificationCount: count,
  notificationInbox: { items: [], pageInfo: { hasNextPage: false, endCursor: null } },
});
const changedCounts = (counts) => counts.filter((count, index) => index === 0 || count !== counts[index - 1]);
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};
async function until(predicate) {
  for (let i = 0; i < 100; i += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.ok(predicate(), "배지 동기화가 완료되어야 한다");
}

function harness(t, { token = "user-1-token", native = true } = {}) {
  const state = { token, revision: 0, count: 3, requests: 0, read: null, canSetBadge: true, displayedCount: 0 };
  const counts = [];
  const window = new EventTarget();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const exports = {};
  const modules = {
    "@tanstack/react-query": { QueryObserver },
    "@/api/notificationApi": {
      NOTIFICATION_INBOX_FIRST_PAGE_QUERY_KEY: queryKey,
      NOTIFICATION_INBOX_PAGE_SIZE: 20,
      notificationApi: { inbox: async () => {
        state.requests += 1;
        return state.read ? state.read() : inbox(state.count);
      } },
    },
    "@/lib/authToken": {
      AUTH_SESSION_CHANGE_EVENT: authEvent,
      getAuthToken: () => state.token,
      createAuthSessionRequest: () => {
        const tokenAtStart = state.token;
        const revisionAtStart = state.revision;
        const isCurrent = () => state.token === tokenAtStart && state.revision === revisionAtStart;
        return { isCurrent, assertCurrent: () => { if (!isCurrent()) throw new Error("Auth session changed during request"); } };
      },
    },
    "@/native-bridge": { nativeBridge: {
      runtime: { isAvailable: () => native },
      notifications: { setBadgeCount: (count) => {
        counts.push(count);
        if (state.canSetBadge) state.displayedCount = count;
        return true;
      } },
    } },
  };
  vm.runInNewContext(compiled, { exports, window, require: (specifier) => {
    assert.ok(Object.hasOwn(modules, specifier), `Unexpected module: ${specifier}`);
    return modules[specifier];
  } });
  const stop = exports.startNativeNotificationBadgeSync(client);
  t.after(() => { stop(); client.clear(); });
  const changeSession = (token) => {
    state.token = token;
    state.revision += 1;
    window.dispatchEvent(new Event(authEvent));
  };
  return { client, counts, state, stop, changeSession };
}

test("홈을 열지 않은 상태에서도 미확인 개수를 조회하고 읽음 처리의 0을 즉시 반영한다", async (t) => {
  const h = harness(t);
  await until(() => h.counts.length === 1);
  assert.deepEqual(h.counts, [3]);
  h.client.setQueryData(queryKey, inbox(0));
  await until(() => h.counts.at(-1) === 0);
  assert.deepEqual(h.counts, [3, 0]);
});

test("수신·앱 복귀로 알림함을 갱신하면 증가분 대신 새 총개수를 반영한다", async (t) => {
  const h = harness(t);
  await until(() => h.counts.length === 1);
  h.state.count = 5;
  await h.client.invalidateQueries({ queryKey });
  await until(() => h.counts.at(-1) === 5);
  await h.client.invalidateQueries({ queryKey });
  assert.deepEqual(changedCounts(h.counts), [3, 5]);
});

test("서버 조회가 실패해도 표시 중인 배지를 임의로 0으로 만들지 않는다", async (t) => {
  const h = harness(t);
  await until(() => h.counts.length === 1);
  h.state.read = async () => { throw new Error("test API unavailable"); };
  await h.client.invalidateQueries({ queryKey });
  assert.deepEqual(changedCounts(h.counts), [3]);
});

test("OS 권한 복귀 뒤에는 미확인 개수가 같아도 배지를 다시 적용한다", async (t) => {
  const h = harness(t, { token: null });
  h.state.canSetBadge = false;
  h.changeSession("user-1-token");
  await until(() => h.counts.length > 0);
  assert.equal(h.state.displayedCount, 0);
  h.state.canSetBadge = true;
  await h.client.invalidateQueries({ queryKey });
  assert.equal(h.state.displayedCount, 3);
});

test("일반 브라우저와 로그아웃 상태에서는 배지용 알림함 조회를 시작하지 않는다", async (t) => {
  const web = harness(t, { native: false });
  const guest = harness(t, { token: null });
  assert.equal(web.state.requests, 0);
  assert.equal(guest.state.requests, 0);
  guest.changeSession("logged-in-token");
  await until(() => guest.counts.length === 1);
  assert.deepEqual(guest.counts, [3]);
});

test("로그아웃 이후 도착한 이전 조회는 배지를 복원하지 않는다", async (t) => {
  const h = harness(t, { token: null });
  const pending = deferred();
  h.state.read = () => pending.promise;
  h.changeSession("user-1-token");
  assert.equal(h.state.requests, 1);
  h.changeSession(null);
  pending.resolve(inbox(9));
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(h.counts, []);
});

test("계정 전환 시 이전 캐시와 늦은 응답을 버리고 새 계정의 개수만 반영한다", async (t) => {
  const h = harness(t);
  await until(() => h.counts.length === 1);
  const pending = deferred();
  h.state.read = () => pending.promise;
  const oldFetch = h.client.invalidateQueries({ queryKey });
  h.state.read = async () => inbox(1);
  h.changeSession("user-2-token");
  await until(() => h.counts.at(-1) === 1);
  pending.resolve(inbox(9));
  await oldFetch;
  assert.deepEqual(changedCounts(h.counts), [3, 1]);
});

test("구독 해제 후에는 캐시 변경이 배지에 전달되지 않는다", async (t) => {
  const h = harness(t);
  await until(() => h.counts.length === 1);
  h.stop();
  h.client.setQueryData(queryKey, inbox(7));
  assert.deepEqual(h.counts, [3]);
});
