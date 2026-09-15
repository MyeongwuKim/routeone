import assert from "node:assert/strict";
import test from "node:test";
import {
  blockUser,
  getBlockedUserIds,
  getBlockedUsers,
  hasBlockedUser,
  unblockUser,
} from "../src/modules/user/userBlock.service.ts";
import {
  getPublicRouteConnection,
  getPublicRoutes,
} from "../src/modules/routes/routeQuery.service.ts";
import { getPlacePhotos } from "../src/modules/routes/routeVisit.service.ts";

function createPrisma() {
  const users = [
    { id: "me", displayName: "나" },
    { id: "blocked", displayName: "차단 대상" },
  ];
  const blocks = [];
  const routeQueries = [];
  const photoQueries = [];

  return {
    blocks,
    routeQueries,
    photoQueries,
    prisma: {
      user: {
        async findUnique({ where }) {
          return users.find((user) => user.id === where.id) ?? null;
        },
        async findMany({ where }) {
          return users.filter((user) => where.id.in.includes(user.id));
        },
      },
      userBlock: {
        async findMany({ where, select }) {
          const result = blocks.filter((block) => block.blockerId === where.blockerId);
          return select
            ? result.map((block) => ({ blockedId: block.blockedId }))
            : structuredClone(result);
        },
        async findUnique({ where }) {
          return (
            blocks.find(
              (block) =>
                block.blockerId === where.blockerId_blockedId.blockerId &&
                block.blockedId === where.blockerId_blockedId.blockedId
            ) ?? null
          );
        },
        async upsert({ create }) {
          if (
            !blocks.some(
              (block) =>
                block.blockerId === create.blockerId &&
                block.blockedId === create.blockedId
            )
          ) {
            blocks.push({ id: `block-${blocks.length + 1}`, createdAt: new Date(), ...create });
          }
        },
        async deleteMany({ where }) {
          const index = blocks.findIndex(
            (block) =>
              block.blockerId === where.blockerId &&
              block.blockedId === where.blockedId
          );
          if (index >= 0) blocks.splice(index, 1);
        },
      },
      route: {
        async findMany(args) {
          routeQueries.push(args);
          return [];
        },
      },
      placePhoto: {
        async findMany(args) {
          photoQueries.push(args);
          return [];
        },
      },
    },
  };
}

test("차단 관계는 중복 없이 저장되고 내 목록에서 해제할 수 있다", async () => {
  const db = createPrisma();
  const me = { id: "me" };

  await blockUser(db.prisma, me, "blocked");
  await blockUser(db.prisma, me, "blocked");

  assert.equal(db.blocks.length, 1);
  assert.deepEqual(await getBlockedUserIds(db.prisma, "me"), ["blocked"]);
  assert.equal(await hasBlockedUser(db.prisma, "me", "blocked"), true);
  assert.deepEqual(
    (await getBlockedUsers(db.prisma, me)).map((user) => user.id),
    ["blocked"]
  );

  await unblockUser(db.prisma, me, "blocked");
  assert.equal(await hasBlockedUser(db.prisma, "me", "blocked"), false);
});

test("내 계정 차단은 저장 전에 거절한다", async () => {
  const db = createPrisma();

  await assert.rejects(
    blockUser(db.prisma, { id: "me" }, "me"),
    /내 계정은 차단할 수 없습니다/
  );
  assert.equal(db.blocks.length, 0);
});

test("차단 사용자는 공유 루트 목록과 페이지 조회에서 제외한다", async () => {
  const db = createPrisma();
  db.blocks.push({
    id: "block-1",
    blockerId: "me",
    blockedId: "blocked",
    createdAt: new Date(),
  });

  await getPublicRoutes(db.prisma, { viewerId: "me" });
  await getPublicRouteConnection(db.prisma, { viewerId: "me" });

  assert.deepEqual(db.routeQueries[0].where.ownerId, { notIn: ["blocked"] });
  assert.deepEqual(db.routeQueries[1].where.ownerId, { notIn: ["blocked"] });
});

test("차단 사용자의 방문 사진을 장소 사진 조회에서 제외한다", async () => {
  const db = createPrisma();

  await getPlacePhotos(
    db.prisma,
    { provider: "CUSTOM", title: "장소", lat: 37, lng: 127 },
    { blockedUserIds: ["blocked"] }
  );

  assert.deepEqual(db.photoQueries[0].where.userId, { notIn: ["blocked"] });
});
