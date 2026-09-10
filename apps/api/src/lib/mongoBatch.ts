/**
 * 용도:
 * 문서마다 값이 다른 수정과 upsert를 MongoDB 명령 하나로 묶는다.
 *
 * 동작 방식:
 * 호출한 트랜잭션의 세션을 그대로 사용하고, 명령 크기를 나눠 전송한다.
 * MongoDB가 응답 안에 담아 반환하는 쓰기 오류도 예외로 바꿔 롤백한다.
 */
import { Prisma } from "@prisma/client";

type MongoCollection = "RouteDay" | "RouteStop" | "PlaceStayStat" | "PlacePhoto" | "UserNotification";
export type MongoUpdate = {
  q: Prisma.InputJsonObject;
  u: Prisma.InputJsonObject | Prisma.InputJsonObject[];
  upsert?: boolean;
  multi?: boolean;
};

const MAX_BATCH_COUNT = 100;
const MAX_BATCH_BYTES = 4 * 1024 * 1024;

export function mongoId(id: string): Prisma.InputJsonObject {
  return { $oid: id };
}

function mongoValue(value: unknown): Prisma.InputJsonValue | null {
  if (value == null) return null;
  if (value instanceof Date) return { $date: value.toISOString() };
  if (Array.isArray(value)) return value.map(mongoValue);
  if (typeof value === "object") return mongoDocument(value as Record<string, unknown>);
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  throw new Error("MongoDB 일괄 저장 값이 올바르지 않습니다.");
}

export function mongoDocument(
  data: Record<string, unknown>,
  objectIdFields: readonly string[] = []
): Prisma.InputJsonObject {
  return Object.fromEntries(
    Object.entries(data)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [
        key,
        value != null && objectIdFields.includes(key)
          ? mongoId(String(value))
          : mongoValue(value),
      ])
  );
}

export function mongoUpsert(
  query: Prisma.InputJsonObject,
  create: Record<string, unknown>,
  update: Record<string, unknown>,
  objectIdFields: readonly string[] = []
): MongoUpdate {
  const now = new Date();
  const set = mongoDocument({ ...update, updatedAt: now }, objectIdFields);
  const insert = mongoDocument({ ...create, createdAt: now }, objectIdFields);
  // 같은 필드를 $set과 $setOnInsert 양쪽에 넣으면 MongoDB가 거부한다.
  const insertOnly = Object.fromEntries(Object.entries(insert).filter(([key]) => !(key in set)));
  return { q: query, u: { $set: set, $setOnInsert: insertOnly }, upsert: true };
}

export async function runMongoUpdates(
  transaction: Pick<Prisma.TransactionClient, "$runCommandRaw">,
  collection: MongoCollection,
  updates: MongoUpdate[],
  requireEveryMatch = false
) {
  let offset = 0;
  while (offset < updates.length) {
    const batch: MongoUpdate[] = [];
    let bytes = 0;
    while (offset < updates.length && batch.length < MAX_BATCH_COUNT) {
      const update = updates[offset]!;
      const size = Buffer.byteLength(JSON.stringify(update));
      if (size > MAX_BATCH_BYTES) throw new Error("MongoDB 일괄 수정 항목이 너무 큽니다.");
      if (batch.length > 0 && bytes + size > MAX_BATCH_BYTES) break;
      batch.push(update);
      bytes += size;
      offset += 1;
    }

    const result = await transaction.$runCommandRaw({
      update: collection,
      updates: batch,
      ordered: true,
    });
    const errors = result.writeErrors as { code?: number }[] | undefined;
    const failure = errors?.[0] ?? result.writeConcernError;
    if (result.ok !== 1 || failure) {
      const code = errors?.[0]?.code;
      if (code === 11000 || code === 112) {
        throw new Prisma.PrismaClientKnownRequestError("MongoDB 일괄 저장 충돌", {
          code: code === 11000 ? "P2002" : "P2034",
          clientVersion: Prisma.prismaVersion.client,
        });
      }
      throw new Error(`MongoDB 일괄 저장 실패 (${collection}, code=${code ?? "unknown"})`);
    }
    if (requireEveryMatch && result.n !== batch.length) {
      throw new Error("일괄 수정 대상이 변경되었습니다. 다시 시도해 주세요.");
    }
  }
}
