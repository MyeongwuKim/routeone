import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { cleanupOrphanImages } from "../src/modules/images/orphanImageCleanup.service.ts";
import { isImageReferenced } from "../src/modules/images/imageReference.repository.ts";
import { createCloudflareImageStore } from "../src/modules/images/cloudflareImages.client.ts";

const now = new Date("2026-09-09T19:00:00Z");
const oldImage = (id, patch = {}) => ({
  id, filename: `routeone-prod-visit-${id}.jpg`, uploaded: "2026-09-07T00:00:00Z",
  meta: { kind: "route-stop-visit-photo", environment: "prod" }, ...patch,
});
const options = { environment: "prod", now, dryRun: false };

function harness(records, reference = async () => false) {
  const deleted = [];
  const reads = [];
  const dependencies = {
    images: {
      listImages: async () => records,
      getImage: async (id) => { reads.push(id); return records.find((image) => image.id === id); },
      deleteImage: async (id) => { deleted.push(id); return true; },
    },
    isReferenced: reference,
  };
  return { dependencies, deleted, reads, run: (patch = {}) => cleanupOrphanImages(dependencies, { ...options, ...patch }) };
}

test("같은 환경의 오래된 미참조 이미지만 삭제한다", async () => {
  const h = harness([
    oldImage("orphan"), oldImage("used"),
    oldImage("recent", { uploaded: "2026-09-09T00:00:00Z" }),
    oldImage("boundary", { uploaded: "2026-09-08T19:00:00Z" }),
    oldImage("dev", { meta: { kind: "route-stop-visit-photo", environment: "dev" } }),
    oldImage("other-app", { meta: { kind: "other-photo", environment: "prod" } }),
    oldImage("unknown", { meta: undefined }), oldImage("draft", { draft: true }),
    oldImage("no-time", { uploaded: undefined }), oldImage("bad-time", { uploaded: "invalid" }),
  ], async (id) => id === "used");
  const result = await h.run();
  assert.deepEqual(h.deleted, ["orphan"]);
  assert.equal(result.referencedCount, 1);
  assert.equal(result.skippedCount, 8);
  assert.equal(result.deletedCount, 1);
});

test("메타데이터가 같아도 routeone-으로 시작하지 않는 파일은 DB 조회와 삭제에서 제외한다", async () => {
  const referenceChecks = [];
  const h = harness([
    oldImage("routeone"),
    oldImage("other-service", { filename: "closet-photo.jpg" }),
    oldImage("contains-prefix", { filename: "backup-routeone-prod-photo.jpg" }),
    oldImage("similar-prefix", { filename: "routeone2-photo.jpg" }),
    oldImage("no-filename", { filename: undefined }),
    oldImage("empty-filename", { filename: "" }),
    oldImage("metadata-filename-only", {
      filename: undefined,
      meta: { kind: "route-stop-visit-photo", environment: "prod", fileName: "routeone-prod-photo.jpg" },
    }),
  ], async (id) => { referenceChecks.push(id); return false; });
  const result = await h.run();
  assert.deepEqual(result.candidateIds, ["routeone"]);
  assert.equal(result.skippedCount, 6);
  assert.deepEqual(referenceChecks, ["routeone", "routeone"]);
  assert.deepEqual(h.reads, ["routeone"]);
  assert.deepEqual(h.deleted, ["routeone"]);
});

test("routeone-dev 파일도 메타데이터의 환경과 일치할 때만 삭제한다", async () => {
  const records = [
    oldImage("dev-orphan", {
      filename: "routeone-dev-visit-test.jpg",
      meta: { kind: "route-stop-visit-photo", environment: "dev" },
    }),
    oldImage("prod-orphan"),
  ];
  const h = harness(records);
  h.dependencies.images.listImages = async (environment) => {
    assert.equal(environment, "dev");
    return records;
  };
  const result = await h.run({ environment: "dev" });
  assert.deepEqual(h.deleted, ["dev-orphan"]);
  assert.equal(result.skippedCount, 1);
});

test("기본 점검 모드는 삭제 API를 호출하지 않는다", async () => {
  const h = harness([oldImage("orphan"), oldImage("other-service", { filename: "closet-photo.jpg" })]);
  const result = await h.run({ dryRun: undefined });
  assert.equal(result.dryRun, true);
  assert.deepEqual(result.candidateIds, ["orphan"]);
  assert.deepEqual(h.deleted, []);
  assert.deepEqual(h.reads, []);
});

test("최근 사진 포함 점검은 유예 시간만 건너뛰고 사용 중인 사진과 다른 서비스는 제외한다", async () => {
  const h = harness([
    oldImage("old-orphan"),
    oldImage("just-uploaded", { uploaded: now.toISOString() }),
    oldImage("boundary", { uploaded: "2026-09-08T19:00:00Z" }),
    oldImage("recent-used", { uploaded: now.toISOString() }),
    oldImage("other-service", { filename: "closet-photo.jpg", uploaded: now.toISOString() }),
    oldImage("other-environment", { meta: { kind: "route-stop-visit-photo", environment: "dev" } }),
    oldImage("unknown-kind", { meta: undefined }),
    oldImage("draft", { draft: true }),
    oldImage("no-time", { uploaded: undefined }),
  ], async (id) => id === "recent-used");
  const normal = await h.run({ dryRun: true });
  assert.deepEqual(normal.candidateIds, ["old-orphan"]);
  assert.equal(normal.includeRecent, false);
  assert.equal(normal.cutoffAt, "2026-09-08T19:00:00.000Z");
  const preview = await h.run({ dryRun: true, includeRecent: true });
  assert.deepEqual(preview.candidateIds, ["old-orphan", "just-uploaded", "boundary"]);
  assert.equal(preview.includeRecent, true);
  assert.equal(preview.cutoffAt, null);
  assert.equal(preview.referencedCount, 1);
  assert.equal(preview.skippedCount, 5);
  assert.equal(preview.deletedCount, 0);
  assert.deepEqual(h.reads, []);
  assert.deepEqual(h.deleted, []);
});

test("최근 사진 포함 옵션으로 실제 삭제를 요청하면 목록 조회 전부터 차단한다", async () => {
  const h = harness([oldImage("orphan")]);
  h.dependencies.images.listImages = async () => { assert.fail("실제 삭제와 유예 무시는 함께 실행할 수 없다."); };
  h.dependencies.isReferenced = async () => { assert.fail("잘못된 옵션에서는 DB를 조회하면 안 된다."); };
  await assert.rejects(h.run({ includeRecent: true }), /only allowed in dry-run mode/);
  assert.deepEqual(h.deleted, []);
});

test("삭제 직전 파일명이 다른 서비스의 이름으로 바뀌거나 없어지면 보존한다", async () => {
  const h = harness([oldImage("renamed"), oldImage("missing-filename")]);
  h.dependencies.images.getImage = async (id) => oldImage(id, {
    filename: id === "renamed" ? "closet-photo.jpg" : undefined,
  });
  const result = await h.run();
  assert.equal(result.preservedOnRecheckCount, 2);
  assert.deepEqual(h.deleted, []);
});

test("후보 선정 후 DB에 연결된 이미지는 삭제 직전 재확인에서 보존한다", async () => {
  let reads = 0;
  const h = harness([oldImage("late-save")], async () => ++reads > 1);
  const result = await h.run();
  assert.equal(result.preservedOnRecheckCount, 1);
  assert.deepEqual(h.deleted, []);
});

test("상세에서 환경이나 업로드 시각이 달라진 이미지를 보존한다", async () => {
  const h = harness([oldImage("changed-env"), oldImage("changed-time")]);
  h.dependencies.images.getImage = async (id) => id === "changed-env"
    ? oldImage(id, { meta: { kind: "route-stop-visit-photo", environment: "dev" } })
    : oldImage(id, { uploaded: now.toISOString() });
  const result = await h.run();
  assert.equal(result.preservedOnRecheckCount, 2);
  assert.deepEqual(h.deleted, []);
});

test("목록 조회 실패 또는 최초 DB 조회 실패 시 아무것도 삭제하지 않는다", async () => {
  const h = harness([oldImage("first"), oldImage("second")], async (id) => {
    if (id === "second") throw new Error("DB unavailable");
    return false;
  });
  await assert.rejects(h.run(), /DB unavailable/);
  assert.deepEqual(h.deleted, []);
  h.dependencies.images.listImages = async () => { throw new Error("list failed"); };
  await assert.rejects(h.run(), /list failed/);
  assert.deepEqual(h.deleted, []);
});

test("삭제 직전 DB 오류와 삭제 API 오류는 성공으로 처리하지 않는다", async () => {
  let reads = 0;
  const h = harness([oldImage("orphan")], async () => {
    if (++reads > 1) throw new Error("recheck failed");
    return false;
  });
  await assert.rejects(h.run(), /recheck failed/);
  assert.deepEqual(h.deleted, []);
  h.dependencies.isReferenced = async () => false;
  h.dependencies.images.deleteImage = async () => { throw new Error("delete failed"); };
  await assert.rejects(h.run(), /delete failed/);
});

test("삭제 상한을 넘으면 일부도 삭제하지 않고 점검을 요구한다", async () => {
  const h = harness([oldImage("one"), oldImage("two")]);
  await assert.rejects(h.run({ maxDeletes: 1 }), /exceeding the delete limit/);
  assert.deepEqual(h.deleted, []);
  const preview = await h.run({ dryRun: true, maxDeletes: 1 });
  assert.equal(preview.candidateCount, 2);
  assert.equal(preview.candidateIds.length, 1);
});

test("이미 삭제된 이미지의 상세·삭제 404를 정상 처리한다", async () => {
  const h = harness([oldImage("missing-first"), oldImage("missing-later")]);
  h.dependencies.images.getImage = async (id) => id === "missing-first" ? null : oldImage(id);
  h.dependencies.images.deleteImage = async () => false;
  const result = await h.run();
  assert.equal(result.missingCount, 2);
  assert.equal(result.deletedCount, 0);
});

test("24시간 미만 유예·잘못된 환경·삭제 상한은 실행 전에 거부한다", async () => {
  const h = harness([]);
  for (const patch of [{ graceHours: 0 }, { graceHours: 23 }, { environment: "all" }, { maxDeletes: 0 }, { now: new Date("invalid") }]) {
    await assert.rejects(h.run(patch), /Image cleanup requires/);
  }
});

function matches(record, where) {
  if (where.OR) return where.OR.some((entry) => matches(record, entry));
  return Object.entries(where).every(([key, condition]) => {
    if (typeof condition === "string") return record[key] === condition;
    if (condition.is) return matches(record[key] ?? {}, condition.is);
    if (condition.contains) return record[key]?.includes(condition.contains) ?? false;
    throw new Error(`Unsupported test filter: ${key}`);
  });
}

const sources = {
  user: ["avatarUrl"],
  routeStop: ["verificationPhotoImageId", "verificationPhotoUrl", "place.imageUrl"],
  placeStayStat: ["imageUrl"],
  placePhoto: ["imageId", "imageUrl", "thumbnailUrl", "placeImageUrl"],
};

test("스키마의 이미지 필드가 늘어나면 참조 검사 누락을 감지한다", () => {
  const fields = {};
  function imagePaths(model, prefix = "") {
    return model.fields.flatMap((field) => {
      if (field.type === "String" && /image|photo|avatar|thumbnail/i.test(field.name)) return [prefix + field.name];
      const composite = Prisma.dmmf.datamodel.types.find((type) => type.name === field.type);
      return composite ? imagePaths(composite, `${prefix}${field.name}.`) : [];
    });
  }
  for (const model of Prisma.dmmf.datamodel.models) {
    const paths = imagePaths(model);
    if (paths.length) fields[model.name[0].toLowerCase() + model.name.slice(1)] = paths.sort();
  }
  assert.deepEqual(fields, Object.fromEntries(Object.entries(sources).map(([key, value]) => [key, [...value].sort()])));
});

test("ID·서명 URL·썸네일·스냅샷·비활성 사진·프로필 참조를 모두 보존한다", async () => {
  for (const [source, paths] of Object.entries(sources)) {
    for (const path of paths) {
      const record = { id: "record", status: "INACTIVE", routeVisibility: "PRIVATE" };
      const value = path.endsWith("Id") ? "image-123" : "https://imagedelivery.net/account/image-123/thumbnail?sig=xxx";
      if (path.includes(".")) record.place = { imageUrl: value };
      else record[path] = value;
      const prisma = Object.fromEntries(Object.keys(sources).map((name) => [name, {
        findFirst: async ({ where }) => name === source && matches(record, where) ? { id: record.id } : null,
      }]));
      assert.equal(await isImageReferenced(prisma, "image-123"), true, `${source}.${path}`);
      assert.equal(await isImageReferenced(prisma, "unused"), false, `${source}.${path}`);
    }
  }
});

test("참조 조회 한 곳이 실패해도 미참조로 처리하지 않는다", async () => {
  const prisma = Object.fromEntries(Object.keys(sources).map((name) => [name, { findFirst: async () => null }]));
  prisma.user.findFirst = async () => { throw new Error("profile lookup failed"); };
  await assert.rejects(isImageReferenced(prisma, "image-123"), /profile lookup failed/);
});

const response = (result, status = 200, success = true) => new Response(JSON.stringify({ success, result }), { status });
function client(fetchImpl) {
  return createCloudflareImageStore({ accountId: "test-account", token: "test-token", fetchImpl });
}

test("Cloudflare 목록은 모든 페이지에 RouteOne 환경 필터를 적용하고 중복 ID를 합친다", async () => {
  const calls = [];
  const store = client(async (url) => {
    calls.push(new URL(url));
    return calls.length === 1
      ? response({ images: [oldImage("one")], continuation_token: "next+token" })
      : response({ images: [oldImage("one"), oldImage("two")], continuation_token: "" });
  });
  assert.deepEqual((await store.listImages("prod")).map(({ id, filename }) => ({ id, filename })), [
    { id: "one", filename: "routeone-prod-visit-one.jpg" },
    { id: "two", filename: "routeone-prod-visit-two.jpg" },
  ]);
  for (const url of calls) {
    assert.equal(url.searchParams.get("meta.kind[eq:string]"), "route-stop-visit-photo");
    assert.equal(url.searchParams.get("meta.environment[eq:string]"), "prod");
  }
  assert.equal(calls[1].searchParams.get("continuation_token"), "next+token");
});

test("개발 목록 요청은 Cloudflare에서 dev로 제한하고 환경 없는 전체 조회를 거부한다", async () => {
  const calls = [];
  const store = client(async (url) => {
    calls.push(new URL(url));
    return response({ images: [] });
  });
  await store.listImages("dev");
  assert.equal(calls[0].searchParams.get("meta.kind[eq:string]"), "route-stop-visit-photo");
  assert.equal(calls[0].searchParams.get("meta.environment[eq:string]"), "dev");
  for (const environment of [undefined, "", "all"]) {
    await assert.rejects(store.listImages(environment), /requires a dev or prod environment/);
  }
  assert.equal(calls.length, 1);
});

test("Cloudflare가 유효한 파일명을 주지 않으면 삭제 후보에서 제외한다", async () => {
  const deleted = [];
  const store = client(async (_url, init) => {
    if (init.method === "DELETE") { deleted.push(_url); return response({}); }
    return response({ images: [undefined, null, 123, {}].map((filename, index) => oldImage(`invalid-${index}`, { filename })) });
  });
  const result = await cleanupOrphanImages({
    images: store,
    isReferenced: async () => { assert.fail("파일명이 없는 사진은 DB 참조를 조회하면 안 된다."); },
  }, options);
  assert.equal(result.skippedCount, 4);
  assert.equal(result.candidateCount, 0);
  assert.deepEqual(deleted, []);
});

test("두 번째 페이지 실패·반복 토큰·누락된 목록 응답을 거부한다", async () => {
  let calls = 0;
  const broken = client(async () => ++calls === 1
    ? response({ images: [oldImage("one")], continuation_token: "next" })
    : response({}, 503));
  await assert.rejects(broken.listImages("prod"), /503/);
  await assert.rejects(client(async () => response({ images: [], continuation_token: "same" })).listImages("prod"), /repeated/);
  await assert.rejects(client(async () => response({})).listImages("prod"), /missing images/);
  await assert.rejects(client(async () => response({ images: [] }, 200, false)).listImages("prod"), /unsuccessful/);
});

test("상세 metadata 호환과 삭제 404·권한 오류를 구분한다", async () => {
  const store = client(async (_url, init) => init.method === "DELETE"
    ? response({}, 404)
    : response({ id: "one", filename: oldImage("one").filename, metadata: oldImage("one").meta, uploaded: oldImage("one").uploaded }));
  const image = await store.getImage("one");
  assert.equal(image.meta.kind, "route-stop-visit-photo");
  assert.equal(image.filename, "routeone-prod-visit-one.jpg");
  assert.equal(await store.deleteImage("one"), false);
  assert.equal(await client(async () => response({})).deleteImage("one"), true);
  await assert.rejects(client(async () => response({}, 403)).deleteImage("one"), /403/);
  await assert.rejects(client(async () => response({ id: "other" })).getImage("one"), /different image ID/);
});
