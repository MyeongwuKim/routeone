import assert from "node:assert/strict";
import test from "node:test";
import { mongoDocument, mongoUpsert, runMongoUpdates } from "../src/lib/mongoBatch.ts";
import { runTransactionWithRetry } from "../src/lib/transaction.ts";

const update = { q: { placeKey: "test" }, u: { $set: { visitCount: 1 } } };

test("bulk commands stop on embedded write errors so earlier writes cannot be committed", async () => {
  for (const response of [
    { ok: 1, n: 1, writeErrors: [{ code: 121 }] },
    { ok: 1, n: 1, writeConcernError: { code: 64 } },
    { ok: 0 },
  ]) {
    let calls = 0;
    const transaction = { $runCommandRaw: async () => { calls++; return response; } };
    await assert.rejects(runMongoUpdates(transaction, "PlaceStayStat", Array(201).fill(update)), /저장 실패/);
    assert.equal(calls, 1);
  }
});

test("batch commands split by both operation count and encoded size", async () => {
  const commands = [];
  const transaction = { $runCommandRaw: async (command) => {
    commands.push(command);
    return { ok: 1, n: command.updates.length };
  } };
  await runMongoUpdates(transaction, "PlaceStayStat", Array(201).fill(update), true);
  assert.deepEqual(commands.map(command => command.updates.length), [100, 100, 1]);
  commands.length = 0;
  const large = { q: {}, u: { $set: { title: "가".repeat(800_000) } } };
  await runMongoUpdates(transaction, "PlaceStayStat", [large, large]);
  assert.equal(commands.length, 2);
  await assert.rejects(runMongoUpdates(transaction, "PlaceStayStat", [
    { q: {}, u: { $set: { title: "가".repeat(1_500_000) } } },
  ]), /너무 큽니다/);
});

test("batch updates reject missing targets and skip empty commands", async () => {
  let calls = 0;
  const transaction = { $runCommandRaw: async () => { calls++; return { ok: 1, n: 0 }; } };
  await runMongoUpdates(transaction, "RouteDay", [], true);
  assert.equal(calls, 0);
  await assert.rejects(runMongoUpdates(transaction, "RouteDay", [update], true), /대상이 변경/);
});

test("upserts keep insert defaults separate and encode IDs and dates without interpreting text", () => {
  const id = "0123456789abcdef01234567";
  const date = new Date("2026-09-10T00:00:00Z");
  const result = mongoUpsert({ key: "key" }, { userId: id, readAt: null, title: "old" },
    { title: "$literal-title", availableAt: date }, ["userId"]);
  assert.deepEqual(result.u.$setOnInsert.userId, { $oid: id });
  assert.equal(result.u.$set.title, "$literal-title");
  assert.equal("title" in result.u.$setOnInsert, false);
  assert.equal(result.u.$setOnInsert.readAt, null);
  assert.equal("readAt" in result.u.$set, false);
  assert.deepEqual(result.u.$set.availableAt, { $date: date.toISOString() });
  assert.throws(() => mongoDocument({ value: NaN }), /올바르지/);
});

test("duplicate bulk upserts retry the whole transaction, while ordinary failures do not", async () => {
  let attempts = 0;
  const prisma = { $transaction: async operation => {
    attempts++;
    return operation({ $runCommandRaw: async () => attempts === 1
      ? { ok: 1, writeErrors: [{ code: 11000 }] } : { ok: 1, n: 1 } });
  } };
  await runTransactionWithRetry(prisma, tx => runMongoUpdates(tx, "PlacePhoto", [update]));
  assert.equal(attempts, 2);
  attempts = 0;
  const broken = { $transaction: async () => { attempts++; throw new Error("not retryable"); } };
  await assert.rejects(runTransactionWithRetry(broken, () => {}), /not retryable/);
  assert.equal(attempts, 1);
});
