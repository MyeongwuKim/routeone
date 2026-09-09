/**
 * 용도: DB에 남아 있는 모든 이미지 참조를 확인해 사용 중인 사진의 삭제를 막는다.
 * 동작 방식: 사진 ID뿐 아니라 URL, 썸네일, 장소 스냅샷과 프로필도 확인한다.
 * 공개 여부나 부모 게시물의 존재로 필터링하지 않아 비공개·복제된 사진도 보존한다.
 */
import type { PrismaClient } from "@prisma/client";

type ImageReferencePrisma = Pick<PrismaClient, "routeStop" | "placePhoto" | "placeStayStat" | "user">;

export async function isImageReferenced(prisma: ImageReferencePrisma, imageId: string) {
  if (!imageId.trim()) throw new Error("An image ID is required for reference lookup.");
  // URL의 variant·서명 쿼리가 달라도 찾는다. 부분 일치 오탐은 삭제 대신 보존한다.
  const urlFilters = [...new Set([imageId, encodeURIComponent(imageId)])].map(
    (value) => ({ contains: value })
  );
  const matches = await Promise.all([
    prisma.routeStop.findFirst({
      where: { OR: [
        { verificationPhotoImageId: imageId },
        ...urlFilters.flatMap((filter) => [
          { verificationPhotoUrl: filter },
          { place: { is: { imageUrl: filter } } },
        ]),
      ] },
      select: { id: true },
    }),
    prisma.placePhoto.findFirst({
      where: { OR: [
        { imageId },
        ...urlFilters.flatMap((filter) => [
          { imageUrl: filter }, { thumbnailUrl: filter }, { placeImageUrl: filter },
        ]),
      ] },
      select: { id: true },
    }),
    prisma.placeStayStat.findFirst({
      where: { OR: urlFilters.map((filter) => ({ imageUrl: filter })) },
      select: { id: true },
    }),
    prisma.user.findFirst({
      where: { OR: urlFilters.map((filter) => ({ avatarUrl: filter })) },
      select: { id: true },
    }),
  ]);
  return matches.some(Boolean);
}
