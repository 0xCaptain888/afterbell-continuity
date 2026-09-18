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
    status: "READY_TO_PUBLISH",
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
    examples: {
      protectedRequest: "agent-studio/examples/protected-request.json",
      protectedResponse: "agent-studio/examples/protected-response.json",
      rescueRequest: "agent-studio/examples/rescue-request.json",
      rescueResponse: "agent-studio/examples/rescue-response.json",
      expectedTransitions: ["PROTECTED", "RESCUE_REQUIRED"]
    },
    publicationChecklist: [
      "Create the service in Binance Agent Studio.",
      "Configure the hosted HTTPS endpoint and bearer secret.",
      "Set per-inspection price to 0.01 USDT.",
      "Run both portable examples against the hosted service.",
      "Capture platform service ID, URL, timestamps, and invocation receipts.",
      "Only then change deploymentStatus from UNPUBLISHED."
    ],
    truthNotice: "The service contract, examples, pricing, authentication, and deterministic state transitions are package-verified. No Binance Agent Studio deployment or paid invocation is claimed."
  }
});

await writeFile("evidence/agent-studio-package.json", `${JSON.stringify(artifact, null, 2)}\n`);

console.log(JSON.stringify({
  status: "AGENT_STUDIO_PACKAGE_READY",
  deploymentStatus: "UNPUBLISHED",
  price: "0.01 USDT per inspection",
  transitions: [protectedEvent.state, rescueEvent.state],
  evidenceRoot: artifact.evidenceRoot,
  output: "evidence/agent-studio-package.json"
}, null, 2));
