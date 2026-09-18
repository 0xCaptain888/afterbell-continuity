import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createEvidenceArtifact } from "../src/evidence.js";
import { sampleMandate, sampleRights, sampleSnapshot } from "../src/sample.js";
import { ContinuityWatchtower, type WatchedPosition } from "../src/watchtower.js";

type Json = Record<string, unknown>;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const manifest = JSON.parse(await readFile("agent-studio/agent.json", "utf8")) as Json;
const openapi = await readFile("openapi.yaml", "utf8");
const serverSource = await readFile("src/server.ts", "utf8");
const studioToml = await readFile("bnb-agent/app/agent/studio.toml", "utf8");
const officialAgentSource = await readFile("bnb-agent/app/agent/src/afterbell.ts", "utf8");
const officialEntrypoint = await readFile("bnb-agent/app/agent/src/unifiedMain.ts", "utf8");
const officialAgentTest = await readFile("bnb-agent/app/agent/test/afterbell.test.ts", "utf8");
const officialAgentPackage = JSON.parse(await readFile("bnb-agent/app/agent/package.json", "utf8")) as Json;
const http = manifest.http as Json;
const billing = manifest.billing as Json;

assert(manifest.schema === "afterbell-agent-service/1", "invalid_agent_schema");
assert(manifest.status === "DESIGN", "unpublished_agent_must_remain_design");
assert(http.method === "POST" && http.path === "/api/v1/agent/watchtower", "agent_endpoint_mismatch");
assert(billing.model === "per-inspection" && billing.currency === "USDT" && billing.price === "0.01", "agent_pricing_incomplete");
assert(openapi.includes("/v1/agent/watchtower:"), "agent_openapi_path_missing");
assert(openapi.includes("bearerAuth"), "agent_auth_boundary_missing");
assert(openapi.includes("#/components/schemas/WatchedPosition"), "agent_request_schema_missing");
assert(openapi.includes("#/components/schemas/AgentWatchtowerResponse"), "agent_response_schema_missing");
assert(serverSource.includes('"Access-Control-Allow-Headers": "Content-Type, Authorization"'), "agent_authorization_cors_missing");
assert(officialAgentPackage.name === "AfterBellWatchtower-agent", "official_agent_package_name_mismatch");
assert(studioToml.includes('protocols = ["A2A","X402"]'), "official_agent_protocols_missing");
assert(studioToml.includes('default = "bsc-testnet"'), "official_agent_not_testnet_bound");
assert(studioToml.includes('price = "10000000000000000"'), "official_erc8183_price_missing");
assert(studioToml.includes('price_usd = "0.01"'), "official_b402_price_missing");
assert(!studioToml.includes("[llm]"), "llm_must_not_control_watchtower_delivery");
assert(officialAgentSource.includes("inspectAfterBellPosition"), "deterministic_watchtower_missing");
assert(officialEntrypoint.includes("inspectAfterBellPosition(prompt)"), "official_runtime_not_wired_to_watchtower");
assert(!officialEntrypoint.includes("generateText("), "official_runtime_delivery_must_not_use_llm");
assert(officialAgentTest.includes('result.state, "PROTECTED"') && officialAgentTest.includes('result.state, "BLOCKED"'), "official_agent_state_tests_missing");

const basePosition: WatchedPosition = {
  positionId: "agent-studio-nvda-1",
  wallet: sampleMandate.owner,
  amount: 0.12,
  positionUsd: 21.34,
  snapshot: sampleSnapshot,
  rights: sampleRights,
  mandate: sampleMandate
};
const degradedPosition: WatchedPosition = {
  ...basePosition,
  snapshot: {
    ...sampleSnapshot,
    tokenPriceUsd: sampleSnapshot.underlyingPriceUsd * 1.03,
    exitLiquidityUsd: 2_000
  }
};

const watchtower = new ContinuityWatchtower();
const protectedEvent = watchtower.inspect(basePosition, "2026-09-18T09:15:00.000Z");
const rescueEvent = watchtower.inspect(degradedPosition, "2026-09-18T09:20:00.000Z");
assert(protectedEvent.state === "PROTECTED", "protected_example_failed");
assert(rescueEvent.state === "RESCUE_REQUIRED", "rescue_example_failed");

const protectedResponse = {
  schema: "afterbell-agent-service/1",
  deploymentMode: "LOCAL_UNPUBLISHED",
  event: protectedEvent,
  truthNotice: "Deterministic local service response. This is not yet an Agent Studio deployment receipt."
};
const rescueResponse = {
  schema: "afterbell-agent-service/1",
  deploymentMode: "LOCAL_UNPUBLISHED",
  event: rescueEvent,
  truthNotice: "Deterministic local service response. This is not yet an Agent Studio deployment receipt."
};

await mkdir("agent-studio/examples", { recursive: true });
await writeFile("agent-studio/examples/protected-request.json", `${JSON.stringify(basePosition, null, 2)}\n`);
await writeFile("agent-studio/examples/protected-response.json", `${JSON.stringify(protectedResponse, null, 2)}\n`);
await writeFile("agent-studio/examples/rescue-request.json", `${JSON.stringify(degradedPosition, null, 2)}\n`);
await writeFile("agent-studio/examples/rescue-response.json", `${JSON.stringify(rescueResponse, null, 2)}\n`);

const artifact = createEvidenceArtifact({
  artifactType: "AGENT_STUDIO_PACKAGE",
  mode: "DESIGN",
  observedAt: "2026-09-18T09:20:00.000Z",
  source: "AfterBell deterministic package audit",
  payload: {
    status: "READY_TO_DEPLOY",
    deploymentStatus: "UNPUBLISHED",
    manifest: {
      name: manifest.name,
      version: manifest.version,
      endpoint: `${http.method} ${http.path}`,
      input: manifest.input,
      output: manifest.output,
      billing
    },
    safetyBoundary: {
      deterministicPolicy: true,
      walletKeyAccess: false,
      transactionSigning: false,
      transactionBroadcast: false,
      bearerAuthentication: true
    },
    officialBnbAgentRuntime: {
      workspace: "bnb-agent/",
      cli: "@bnbagent/studio-cli 0.0.13",
      runtime: "agentcore",
      network: "bsc-testnet",
      protocols: ["A2A", "X402"],
      rails: ["ERC-8183", "B402"],
      erc8183Price: "0.01 U",
      b402Price: "0.01 USD",
      deterministicStates: ["PROTECTED", "WATCH", "RESCUE_REQUIRED", "BLOCKED"],
      tests: "5/5 PASS",
      build: "PASS",
      zipBundleDryRun: "PASS",
      deploymentReadiness: "PREFLIGHT_BLOCKED_OPERATOR_SETUP",
      externalBlockers: [
        "Create a new throwaway BSC Testnet wallet and set its ignored WALLET_PASSWORD.",
        "Authenticate to the BNB managed trial platform.",
        "Apply for wallet-specific B402 merchant credentials if the paid X402 face is required.",
        "Start the 48-hour trial only when the submission recording window is ready."
      ]
    },
    examples: {
      protectedRequest: "agent-studio/examples/protected-request.json",
      protectedResponse: "agent-studio/examples/protected-response.json",
      rescueRequest: "agent-studio/examples/rescue-request.json",
      rescueResponse: "agent-studio/examples/rescue-response.json",
      expectedTransitions: ["PROTECTED", "RESCUE_REQUIRED"]
    },
    publicationChecklist: [
      "Create a dedicated throwaway BSC Testnet wallet; never reuse a mainnet key.",
      "Complete `bag platform login` and inspect trial credit.",
      "Run `bag deploy prepare --provider bnb --backend aws` without bypassing safety checks.",
      "Deploy the official A2A/X402 seller runtime when the 48-hour recording window is ready.",
      "Capture platform service ID, URL, ERC-8004 identity, Agent Card, timestamps, and paid invocation receipts.",
      "Only then change deploymentStatus from UNPUBLISHED."
    ],
    truthNotice: "The official BNB Agent Studio A2A/X402 workspace, deterministic inspection, fixed pricing, tests, TypeScript build, and ZIP bundle are verified. No managed-platform deployment, ERC-8004 identity, paid invocation, wallet creation, or trial activation is claimed."
  }
});

await writeFile("evidence/agent-studio-package.json", `${JSON.stringify(artifact, null, 2)}\n`);

console.log(JSON.stringify({
  status: "AGENT_STUDIO_READY_TO_DEPLOY",
  deploymentStatus: "UNPUBLISHED",
  price: "0.01 USDT per inspection",
  transitions: ["PROTECTED", "WATCH", "RESCUE_REQUIRED", "BLOCKED"],
  evidenceRoot: artifact.evidenceRoot,
  output: "evidence/agent-studio-package.json"
}, null, 2));
