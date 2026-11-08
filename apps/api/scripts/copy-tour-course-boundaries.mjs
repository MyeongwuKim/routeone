import { copyFile, mkdir } from "node:fs/promises";

const destination = new URL("../dist/assets/", import.meta.url);
await mkdir(destination, { recursive: true });
await copyFile(
  new URL("../../web/public/service-region-boundary.json", import.meta.url),
  new URL("service-region-boundary.json", destination)
);
