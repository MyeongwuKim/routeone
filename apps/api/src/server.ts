import "dotenv/config";
import os from "node:os";
import { buildApp } from "./app.js";
import {
  DEV_VERIFICATION_BYPASS_ENV,
  isDevVerificationBypassEnabled,
} from "./lib/devVerification.js";

const port = Number(process.env.PORT ?? process.env.API_PORT ?? 4000);
const app = await buildApp();

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
