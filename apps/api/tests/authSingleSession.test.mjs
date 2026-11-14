import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import { generateKeyPairSync, sign } from "node:crypto";
import { createAuthToken, hashPassword } from "../src/lib/auth.ts";
import { userResolvers } from "../src/modules/user/user.resolver.ts";

const userId = "000000000000000000000071";
const otherUserId = "000000000000000000000072";
const password = "fixture-password";
const passwordHash = hashPassword(password);
let users;
let devices;
let failDeviceCleanup = false;

const database = {
  authAccount: {
    async findFirst() {
      return { user: structuredClone(users[0]) };
    },
  },
  user: {
    async findFirst({ where }) {
      return structuredClone(users.find(user => user.accountId === where.accountId) ?? null);
    },
    async findUnique({ where }) {
      return structuredClone(users.find(user => user.id === where.id) ?? null);
    },
    async update({ where, data }) {
      const user = users.find(user => user.id === where.id);
      assert.ok(user, "테스트 사용자가 있어야 한다.");
      Object.assign(user, structuredClone(data));
      return structuredClone(user);
    },
  },
  pushDevice: {
    async updateMany({ where, data }) {
      if (failDeviceCleanup) throw new Error("Injected device cleanup failure");
      const matching = devices.filter(device => device.userId === where.userId);
      matching.forEach(device => Object.assign(device, structuredClone(data)));
      return { count: matching.length };
    },
  },
  async $transaction(operation) {
    const snapshot = structuredClone({ users, devices });
    try {
      return await operation({ user: database.user, pushDevice: database.pushDevice });
    } catch (error) {
      users = snapshot.users;
      devices = snapshot.devices;
      throw error;
    }
  },
};

// 실제 context의 토큰 검사·사용자 조회를 연결하되 운영 DB에는 접근하지 않는다.
const previousPrisma = globalThis.prisma;
globalThis.prisma = database;
const { createContext } = await import("../src/context.ts");
after(() => {
  if (previousPrisma === undefined) delete globalThis.prisma;
  else globalThis.prisma = previousPrisma;
});

beforeEach(() => {
  users = [userId, otherUserId].map((id, i) => ({
    id, accountId: `fixture-user-${i}`, passwordHash, activeSessionId: null,
    role: "USER", displayName: "테스트 사용자", locale: "ko",
  }));
  devices = [userId, otherUserId].map(id => ({ userId: id, enabled: true, disabledAt: null }));
  failDeviceCleanup = false;
});

const login = (id = userId) => userResolvers.Mutation.loginWithPassword(null, {
  input: { accountId: users.find(user => user.id === id).accountId, password },
}, { prisma: database, authenticatedUserId: null, user: null });
const contextFor = token => createContext({ headers: { authorization: `Bearer ${token}` } });
const assertRejected = token => assert.rejects(() => contextFor(token), error => error.extensions?.code === "UNAUTHENTICATED" || error.code === "UNAUTHENTICATED");

test("새 기기 로그인 뒤 이전 기기 토큰은 실제 요청 context에서 거절한다", async () => {
  const first = await login();
  assert.equal((await contextFor(first.token)).user?.id, userId);
  const second = await login();
  assert.equal((await contextFor(second.token)).user?.id, userId);
  await assertRejected(first.token);
});

test("비밀번호가 틀린 로그인 시도는 사용 중인 세션을 해제하지 않는다", async () => {
  const first = await login();
  await assert.rejects(() => userResolvers.Mutation.loginWithPassword(null, {
    input: { accountId: users[0].accountId, password: "wrong-fixture-password" },
  }, { prisma: database }), /아이디 또는 비밀번호/);
  assert.equal((await contextFor(first.token)).user?.id, userId);
});

test("자동 갱신은 현재 로그인을 유지하고 다음 로그인은 갱신 전후 토큰을 모두 폐기한다", async () => {
  const first = await login();
  const context = await contextFor(first.token);
  const refreshed = await userResolvers.Mutation.refreshAuthSession(null, null, context);
  assert.equal((await contextFor(first.token)).user?.id, userId);
  assert.equal((await contextFor(refreshed.token)).user?.id, userId);
  const second = await login();
  await assertRejected(first.token);
  await assertRejected(refreshed.token);
  assert.equal((await contextFor(second.token)).user?.id, userId);
});

test("다른 계정의 로그인과 푸시 등록은 유지한다", async () => {
  const other = await login(otherUserId);
  devices.find(device => device.userId === otherUserId).enabled = true;
  await login();
  await login();
  assert.equal((await contextFor(other.token)).user?.id, otherUserId);
  assert.equal(devices.find(device => device.userId === otherUserId).enabled, true);
});

test("새 로그인은 이전 기기의 서버 푸시 등록도 비활성화한다", async () => {
  await login();
  assert.equal(devices.find(device => device.userId === userId).enabled, false);
  assert.ok(devices.find(device => device.userId === userId).disabledAt instanceof Date);
});

test("푸시 정리에 실패하면 세션 교체도 함께 원복한다", async () => {
  const first = await login();
  failDeviceCleanup = true;
  await assert.rejects(login, /Injected device cleanup failure/);
  assert.equal((await contextFor(first.token)).user?.id, userId);
});

test("세션 식별자가 없는 이전 토큰은 재로그인을 요구한다", async () => {
  const legacy = createAuthToken(userId);
  await assertRejected(legacy);
});

test("토큰이 없는 공개 요청은 비로그인 context로 유지한다", async () => {
  const context = await createContext({ headers: {} });
  assert.equal(context.authenticatedUserId, null);
  assert.equal(context.user, null);
});

test("새 로그인 전에 인증된 갱신 요청도 폐기된 세션을 되살리지 않는다", async () => {
  const first = await login();
  const oldContext = await contextFor(first.token);
  const second = await login();
  const lateRefresh = await userResolvers.Mutation.refreshAuthSession(null, null, oldContext);
  await assertRejected(lateRefresh.token);
  assert.equal((await contextFor(second.token)).user?.id, userId);
});

test("동일 시각에 발급된 로그인도 서로 다른 서버 세션으로 구분한다", async t => {
  const fixedNow = Date.now();
  t.mock.method(Date, "now", () => fixedNow);
  const first = await login();
  const second = await login();
  await assertRejected(first.token);
  assert.equal((await contextFor(second.token)).user?.id, userId);
});

test("네이티브 OAuth 로그인도 같은 계정의 이전 비밀번호 세션을 해제한다", async t => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const kid = "single-session-fixture";
  t.mock.method(globalThis, "fetch", async url => {
    assert.equal(url, "https://appleid.apple.com/auth/keys");
    return new Response(JSON.stringify({ keys: [{ ...publicKey.export({ format: "jwk" }), kid, alg: "RS256" }] }));
  });
  const header = Buffer.from(JSON.stringify({ alg: "RS256", kid })).toString("base64url");
  const claims = Buffer.from(JSON.stringify({ iss: "https://appleid.apple.com", aud: "com.routeone.app.dev",
    exp: Math.floor(Date.now() / 1000) + 60, sub: "single-session-fixture-user" })).toString("base64url");
  const input = `${header}.${claims}`;
  const identityToken = `${input}.${sign("RSA-SHA256", Buffer.from(input), privateKey).toString("base64url")}`;
  const first = await login();
  const native = await userResolvers.Mutation.loginWithNativeOAuth(null, {
    input: { provider: "APPLE", identityToken },
  }, { prisma: database });
  await assertRejected(first.token);
  assert.equal((await contextFor(native.token)).user?.id, userId);
});

test("실제 GraphQL HTTP 응답에서도 이전 세션을 401·인증 오류 코드로 구분한다", async () => {
  const { buildApp } = await import("../src/app.ts");
  const app = await buildApp();
  app.log.level = "silent";
  try {
    const first = await login();
    const second = await login();
    const send = token => app.inject({ method: "POST", url: "/graphql",
      headers: { authorization: `Bearer ${token}` }, payload: { query: "query { me { id } }" } });
    const revoked = await send(first.token);
    assert.equal(revoked.statusCode, 401);
    assert.equal(revoked.json().errors[0].extensions.code, "UNAUTHENTICATED");
    const current = await send(second.token);
    assert.equal(current.statusCode, 200);
    assert.equal(current.json().data.me.id, userId);
  } finally {
    await app.close();
  }
});
