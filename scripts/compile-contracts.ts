import { readFile, writeFile, mkdir } from "node:fs/promises";
import solc from "solc";

const names = ["AfterBellTypes.sol", "ContinuityRegistry.sol", "GuardedStockVault.sol", "ExecutionBondEscrow.sol"];
const sources: Record<string, { content: string }> = {};
for (const name of names) sources[name] = { content: await readFile(`contracts/${name}`, "utf8") };

const input = {
  language: "Solidity",
  sources,
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } }
  }
};

const output = JSON.parse(solc.compile(JSON.stringify(input))) as {
  errors?: Array<{ severity: string; formattedMessage: string }>;
  contracts?: Record<string, Record<string, unknown>>;
};
const errors = (output.errors ?? []).filter((item) => item.severity === "error");
if (errors.length) {
  for (const error of errors) console.error(error.formattedMessage);
  process.exit(1);
}
await mkdir("artifacts", { recursive: true });
await writeFile("artifacts/solc-output.json", JSON.stringify(output.contracts, null, 2));
console.log(JSON.stringify({ status: "CONTRACTS_COMPILED", contracts: Object.keys(output.contracts ?? {}) }, null, 2));
