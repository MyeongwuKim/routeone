import "dotenv/config";
import { readFileSync } from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { parse as parseDotenv } from "dotenv";
import {
  DEV_VERIFICATION_BYPASS_ENV,
  isDevVerificationBypassEnabled,
} from "./lib/devVerification.js";
import { initializeApiMonitoring } from "./monitoring/sentry.js";

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
initializeApiMonitoring();

const { buildApp } = await import("./app.js");

const port = Number(process.env.PORT ?? process.env.API_PORT ?? 4000);
const app = await buildApp();

function getLanGraphqlUrls(port: number) {
  return [
    ...new Set(
      Object.values(os.networkInterfaces())
        .flatMap((networkInterface) => networkInterface ?? [])
        .filter(
          (networkAddress) =>
            networkAddress.family === "IPv4" &&
            !networkAddress.internal &&
            networkAddress.address !== "0.0.0.0" &&
            !networkAddress.address.startsWith("169.254.")
        )
        .map(
          (networkAddress) =>
            `http://${networkAddress.address}:${port}/graphql`
        )
    ),
  ];
}

const ANSI = {
  reset: "\u001b[0m",
  bold: "\u001b[1m",
  dim: "\u001b[2m",
  cyan: "\u001b[36m",
  green: "\u001b[32m",
  blue: "\u001b[34m",
  magenta: "\u001b[35m",
  yellow: "\u001b[33m",
} as const;

function colorize(value: string, ...codes: string[]) {
  const supportsColor = process.stdout.isTTY && process.env.NO_COLOR == null;

  return supportsColor ? `${codes.join("")}${value}${ANSI.reset}` : value;
}

function printApiReadyBanner(port: number, lanGraphqlUrls: string[]) {
  const rail = colorize("│", ANSI.magenta);
  const localGraphqlUrl = `http://localhost:${port}/graphql`;
  const localHealthUrl = `http://localhost:${port}/health`;
  const rows = [
    {
      label: "GraphQL",
      value: localGraphqlUrl,
      color: ANSI.cyan,
    },
    ...lanGraphqlUrls.map((url, index) => ({
      label: index === 0 ? "Network" : "",
      value: url,
      color: ANSI.green,
    })),
    {
      label: "Health",
      value: localHealthUrl,
      color: ANSI.blue,
    },
  ];

  console.log("");
  console.log(
    colorize("╭────────────────────────────────────────────────────────", ANSI.magenta)
  );
  console.log(
    `${rail} ${colorize("●", ANSI.green)} ${colorize(
      "RouteOne API is ready",
      ANSI.bold,
      ANSI.magenta
    )}`
  );
  console.log(`${rail}`);

  rows.forEach(({ label, value, color }) => {
    console.log(
      `${rail} ${colorize(label.padEnd(9), ANSI.dim)} ${colorize(
        value,
        ANSI.bold,
        color
      )}`
    );
  });

  if (isDevVerificationBypassEnabled()) {
    console.log(`${rail}`);
    console.log(
      `${rail} ${colorize("Test mode", ANSI.bold, ANSI.yellow)} ${colorize(
        `${DEV_VERIFICATION_BYPASS_ENV}=1 · GPS verification bypass enabled`,
        ANSI.yellow
      )}`
    );
  }

  console.log(
    colorize("╰────────────────────────────────────────────────────────", ANSI.magenta)
  );
  console.log("");
}

await app.listen({
  port,
  host: process.env.API_HOST ?? "0.0.0.0",
});

const lanGraphqlUrls = getLanGraphqlUrls(port);
printApiReadyBanner(port, lanGraphqlUrls);
