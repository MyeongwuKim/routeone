import "dotenv/config";
import { prisma } from "../lib/prisma.js";

async function main() {
  const result = await prisma.$runCommandRaw({
    update: "User",
    updates: [
      {
        q: {
          $or: [
            { role: { $exists: false } },
            { role: null },
          ],
        },
        u: {
          $set: {
            role: "USER",
          },
        },
        multi: true,
      },
    ],
  });

  const modifiedCount =
    typeof result.nModified === "number" ? result.nModified : 0;

  console.log(`[user-role-backfill] updated=${modifiedCount}`);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
