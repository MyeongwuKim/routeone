import "dotenv/config";
import { buildApp } from "./app.js";

const port = Number(process.env.API_PORT ?? 4000);
const app = await buildApp();

await app.listen({
  port,
  host: process.env.API_HOST ?? "0.0.0.0",
});

console.log(`RouteOne API ready at http://localhost:${port}/graphql`);
