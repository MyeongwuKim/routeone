import "dotenv/config";
import { readFileSync } from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { parse as parseDotenv } from "dotenv";
import { buildApp } from "./app.js";
import {
  DEV_VERIFICATION_BYPASS_ENV,
  isDevVerificationBypassEnabled,
} from "./lib/devVerification.js";
import { prisma } from "./lib/prisma.js";
import { startNotificationScheduler } from "./modules/notifications/notificationScheduler.service.js";

function loadLocalFestivalServiceKey() {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.VISITKOREA_SERVICE_KEY?.trim() ||
    process.env.TOUR_API_SERVICE_KEY?.trim()
  ) {
    return;
  }

  try {
    const webEnvPath = fileURLToPath(
      new URL("../../web/.env", import.meta.url)
    );
    const webEnv = parseDotenv(readFileSync(webEnvPath));
    const serviceKey =
      webEnv.VITE_VISITKOREA_SERVICE_KEY?.trim() ?? "";

    if (serviceKey) {
      process.env.VISITKOREA_SERVICE_KEY = serviceKey;
    }
  } catch {
    // Local Web env is optional; deployed APIs use their own environment key.
  }
}

loadLocalFestivalServiceKey();

const port = Number(process.env.PORT ?? process.env.API_PORT ?? 4000);
const app = await buildApp();
let stopNotificationScheduler = () => {};

app.addHook("onClose", async () => {
  stopNotificationScheduler();
});

function getLanGraphqlUrls(port: number) {
  return Object.values(os.networkInterfaces())
    .flatMap((networkInterface) => networkInterface ?? [])
    .filter(
      (networkAddress) =>
        networkAddress.family === "IPv4" &&
        !networkAddress.internal &&
        networkAddress.address !== "0.0.0.0"
    )
    .map((networkAddress) => `http://${networkAddress.address}:${port}/graphql`);
}

await app.listen({
  port,
  host: process.env.API_HOST ?? "0.0.0.0",
});

stopNotificationScheduler = startNotificationScheduler(prisma);

console.log(`RouteOne API ready at http://localhost:${port}/graphql`);

if (isDevVerificationBypassEnabled()) {
  console.warn(
    `RouteOne API verification bypass enabled by ${DEV_VERIFICATION_BYPASS_ENV}=1`
  );
}

const lanGraphqlUrls = getLanGraphqlUrls(port);

if (lanGraphqlUrls.length) {
  console.log(`RouteOne API LAN urls: ${lanGraphqlUrls.join(", ")}`);
}
