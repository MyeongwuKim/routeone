import { readFile, mkdir, writeFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createWalkingDataPack, type OsmWalkingInput } from "../apps/web/src/features/walking/osmWalkingData";
import { WALKING_COVERAGE } from "../apps/web/src/features/walking/walkingCoverage";

/**
 * 공개 OSM JSON 스냅샷에서 배포용 보행로 파일을 만든다.
 * 예: pnpm --filter api exec node --import tsx ../../scripts/prepare-walking-data.ts /tmp/gangneung-osm.json
 * 파일이 여러 개면 노드/길 ID를 중복 제거해 합친다. 런타임에는 공개 데이터 서버를 호출하지 않는다.
 */
async function prepareWalkingData() {
  const files = process.argv.slice(2);
  if (files.length === 0) throw new Error("OSM JSON 스냅샷 경로를 전달해 주세요.");
  const elements = new Map<string, OsmWalkingInput["elements"][number]>();
  let sourceTimestamp: string | undefined;
  for (const file of files) {
    const data = JSON.parse(await readFile(file, "utf8")) as OsmWalkingInput;
    if (!Array.isArray(data.elements)) throw new Error(`잘못된 OSM 데이터: ${file}`);
    for (const element of data.elements) elements.set(`${element.type}:${element.id}`, element);
    const fileDate = data.osm3s?.timestamp_osm_base ?? (await stat(file)).mtime.toISOString();
    // 예전 원본을 다시 변환해도 데이터가 오늘 갱신된 것처럼 표시하지 않는다.
    if (!sourceTimestamp || fileDate < sourceTimestamp) sourceTimestamp = fileDate;
  }
  const downloadedAt = new Date().toISOString();
  const pack = createWalkingDataPack({ elements: [...elements.values()], osm3s: { timestamp_osm_base: sourceTimestamp } }, {
    regionId: WALKING_COVERAGE.id, regionLabel: WALKING_COVERAGE.label,
    bounds: WALKING_COVERAGE.bounds, downloadedAt,
  });
  if (pack.segments.length < 100) throw new Error("보행로 데이터가 너무 적어 배포 파일을 만들지 않았습니다.");
  const outputDirectory = fileURLToPath(new URL("../apps/web/public/walking-data/", import.meta.url));
  await mkdir(outputDirectory, { recursive: true });
  const outputPath = `${outputDirectory}${WALKING_COVERAGE.filename}`;
  const json = JSON.stringify(pack);
  await writeFile(outputPath, `${json}\n`);
  console.log(JSON.stringify({ file: outputPath, nodes: pack.nodes.length, segments: pack.segments.length, bytes: Buffer.byteLength(json), dataDate: pack.sourceTimestamp }));
}

void prepareWalkingData().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
