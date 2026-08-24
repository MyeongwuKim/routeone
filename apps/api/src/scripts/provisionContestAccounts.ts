import "dotenv/config";
import { prisma } from "../lib/prisma.js";
import {
  hashPassword,
  normalizeAccountId,
  verifyPassword,
} from "../lib/auth.js";

const DEFAULT_OWNER_ACCOUNT_ID = "routeonekim";
const DEFAULT_OWNER_GOOGLE_EMAIL = "routeonekim@gmail.com";
const DEFAULT_REVIEWER_ACCOUNT_ID = "openapi";

function readAccountId(name: string, fallback: string) {
  return normalizeAccountId(process.env[name] ?? fallback);
}

function readRequired(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function readEmail(name: string, fallback: string) {
  return (process.env[name] ?? fallback).trim().toLowerCase();
}

async function findSingleAccount(accountId: string) {
  const users = await prisma.user.findMany({
    where: {
      accountId,
    },
    take: 2,
  });

  if (users.length > 1) {
    throw new Error(
      `Multiple users use accountId '${accountId}'. Resolve duplicates first.`
    );
  }

  return users[0] ?? null;
}

async function findSingleOwner(accountId: string, email: string) {
  const users = await prisma.user.findMany({
    where: {
      OR: [{ accountId }, { email }],
    },
    take: 2,
  });

  if (users.length > 1) {
    throw new Error(
      `Owner accountId '${accountId}' and email '${email}' resolve to different users.`
    );
  }

  return users[0] ?? null;
}

async function main() {
  const ownerAccountId = readAccountId(
    "ROUTEONE_OWNER_ACCOUNT_ID",
    DEFAULT_OWNER_ACCOUNT_ID
  );
  const ownerGoogleEmail = readEmail(
    "ROUTEONE_OWNER_GOOGLE_EMAIL",
    DEFAULT_OWNER_GOOGLE_EMAIL
  );
  const reviewerAccountId = readAccountId(
    "ROUTEONE_REVIEWER_ACCOUNT_ID",
    DEFAULT_REVIEWER_ACCOUNT_ID
  );
  const reviewerPassword = readRequired("ROUTEONE_REVIEWER_ACCOUNT_PASSWORD");

  if (ownerAccountId === reviewerAccountId) {
    throw new Error("Owner and reviewer account IDs must be different.");
  }

  const [owner, reviewer] = await Promise.all([
    findSingleOwner(ownerAccountId, ownerGoogleEmail),
    findSingleAccount(reviewerAccountId),
  ]);

  if (!owner) {
    throw new Error(
      `Owner account '${ownerAccountId}' or '${ownerGoogleEmail}' does not exist. Log in with Google once before provisioning.`
    );
  }

  await prisma.user.update({
    where: {
      id: owner.id,
    },
    data: {
      role: "OWNER",
    },
  });

  const reviewerPasswordHash =
    reviewer?.passwordHash &&
    verifyPassword(reviewerPassword, reviewer.passwordHash)
      ? reviewer.passwordHash
      : hashPassword(reviewerPassword);

  const provisionedReviewer = reviewer
    ? await prisma.user.update({
        where: {
          id: reviewer.id,
        },
        data: {
          passwordHash: reviewerPasswordHash,
          role: "REVIEWER",
        },
      })
    : await prisma.user.create({
        data: {
          accountId: reviewerAccountId,
          passwordHash: reviewerPasswordHash,
          displayName: "공모전 심사 계정",
          locale: "ko",
          role: "REVIEWER",
        },
      });

  console.log(
    `[contest-accounts] owner=${owner.accountId ?? owner.email}:${owner.id} reviewer=${provisionedReviewer.accountId}:${provisionedReviewer.id}`
  );
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
