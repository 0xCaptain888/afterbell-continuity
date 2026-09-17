import { readFile, writeFile } from "node:fs/promises";
import { parseRwaTokenRecords, rankRwaCandidates } from "../src/inventory.js";

const inventory = JSON.parse(await readFile("evidence/live/rwa-inventory.json", "utf8")) as {
  assets?: { bstock?: unknown; ondo?: unknown };
};
if (!inventory.assets?.bstock || !inventory.assets.ondo) throw new Error("live_inventory_missing_run_npm_run_data_gate");
const candidates = rankRwaCandidates([
  ...parseRwaTokenRecords(inventory.assets.bstock),
  ...parseRwaTokenRecords(inventory.assets.ondo)
]);
const output = {
  schema: "afterbell-candidate-ranking/1",
  generatedAt: new Date().toISOString(),
  mode: "LIVE_DATA_DERIVED",
  scoringNotice: "Scores rank technical demo suitability only; they are not investment recommendations.",
  candidates
};
await writeFile("evidence/live/candidate-ranking.json", JSON.stringify(output, null, 2));
console.log(JSON.stringify(output, null, 2));
