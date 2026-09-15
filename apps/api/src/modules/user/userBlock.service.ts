/**
 * 용도:
 * 사용자가 숨기기로 한 다른 사용자의 차단 관계를 저장하고 조회한다.
 *
 * 동작 방식:
 * 차단자와 대상 사용자를 한 쌍으로 보관하며 공유 콘텐츠 조회에서 사용할 대상 ID를 반환한다.
 */
import type { PrismaClient, User } from "@prisma/client";
import { UserFacingError } from "../../graphql/userFacingError.js";

export async function getBlockedUserIds(
  prisma: PrismaClient,
  blockerId: string
) {
  const blocks = await prisma.userBlock.findMany({
    where: { blockerId },
    select: { blockedId: true },
  });

  return blocks.map((block) => block.blockedId);
}

export async function hasBlockedUser(
  prisma: PrismaClient,
  blockerId: string,
  blockedId: string
) {
  const block = await prisma.userBlock.findUnique({
    where: {
      blockerId_blockedId: { blockerId, blockedId },
    },
    select: { id: true },
  });

  return Boolean(block);
}

export async function getBlockedUsers(prisma: PrismaClient, user: User) {
  const blocks = await prisma.userBlock.findMany({
    where: { blockerId: user.id },
    orderBy: { createdAt: "desc" },
  });

  if (blocks.length === 0) {
    return [];
  }

  const users = await prisma.user.findMany({
    where: { id: { in: blocks.map((block) => block.blockedId) } },
  });
  const userById = new Map(users.map((blockedUser) => [blockedUser.id, blockedUser]));

  return blocks
    .map((block) => userById.get(block.blockedId))
    .filter((blockedUser): blockedUser is User => Boolean(blockedUser));
}

export async function blockUser(
  prisma: PrismaClient,
  user: User,
  blockedId: string
) {
  if (blockedId === user.id) {
    throw new UserFacingError("내 계정은 차단할 수 없습니다.");
  }

  const blockedUser = await prisma.user.findUnique({
    where: { id: blockedId },
  });

  if (!blockedUser) {
    throw new UserFacingError("차단할 사용자를 찾을 수 없습니다.");
  }

  await prisma.userBlock.upsert({
    where: {
      blockerId_blockedId: { blockerId: user.id, blockedId },
    },
    update: {},
    create: { blockerId: user.id, blockedId },
  });

  return blockedUser;
}

export async function unblockUser(
  prisma: PrismaClient,
  user: User,
  blockedId: string
) {
  const blockedUser = await prisma.user.findUnique({
    where: { id: blockedId },
  });

  await prisma.userBlock.deleteMany({
    where: { blockerId: user.id, blockedId },
  });

  if (!blockedUser) {
    throw new UserFacingError("차단 해제할 사용자를 찾을 수 없습니다.");
  }

  return blockedUser;
}
