import "dotenv/config";
import os from "node:os";
import { buildApp } from "./app.js";

const port = Number(process.env.API_PORT ?? 4000);
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
const lanGraphqlUrls = getLanGraphqlUrls(port);

if (lanGraphqlUrls.length) {
  console.log(`RouteOne API LAN urls: ${lanGraphqlUrls.join(", ")}`);
}
