/**
 * 용도:
 * 같은 요청의 동시 저장처럼 재시도 가능한 충돌이 생기면 트랜잭션 전체를 다시 실행한다.
 * 타임아웃이나 일반 저장 오류는 그대로 전달한다.
 */
import { Prisma, type PrismaClient } from "@prisma/client";

export async function runTransactionWithRetry<T>(
  prisma: PrismaClient,
  operation: (transaction: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await prisma.$transaction(operation);
    } catch (error) {
      if (attempt >= 4 || !(error instanceof Prisma.PrismaClientKnownRequestError)
        || (error.code !== "P2002" && error.code !== "P2034")) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 15));
    }
  }
}
