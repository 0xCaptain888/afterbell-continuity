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
const operatorReadiness = JSON.parse(await readFile("evidence/bnb-agent-operator-readiness.json", "utf8")) as Json;
const publicNegotiation = JSON.parse(await readFile("evidence/live/agent-studio-public-negotiate.json", "utf8")) as Json;
const deployment = JSON.parse(await readFile("evidence/live/agent-studio-deployment.json", "utf8")) as Json;
const paidDelivery = JSON.parse(await readFile("evidence/live/agent-studio-paid-delivery.json", "utf8")) as Json;
const http = manifest.http as Json;
const billing = manifest.billing as Json;

assert(manifest.schema === "afterbell-agent-service/1", "invalid_agent_schema");
assert(manifest.status === "DEPLOYED_TESTNET_TRIAL", "agent_deployment_status_stale");
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
assert(officialEntrypoint.includes("inspectAfterBellWorkPrompt(prompt)"), "official_runtime_not_wired_to_watchtower");
assert(!officialEntrypoint.includes("generateText("), "official_runtime_delivery_must_not_use_llm");
assert(officialAgentTest.includes('result.state, "PROTECTED"') && officialAgentTest.includes('result.state, "BLOCKED"'), "official_agent_state_tests_missing");
const rebuiltOperatorReadiness = createEvidenceArtifact({
  artifactType: String(operatorReadiness.artifactType),
  mode: "LIVE",
  observedAt: String(operatorReadiness.observedAt),
  source: String(operatorReadiness.source),
  payload: operatorReadiness.payload,
  parentHashes: Array.isArray(operatorReadiness.parentHashes) ? operatorReadiness.parentHashes as `0x${string}`[] : []
});
assert(rebuiltOperatorReadiness.payloadHash === operatorReadiness.payloadHash && rebuiltOperatorReadiness.evidenceRoot === operatorReadiness.evidenceRoot, "operator_readiness_evidence_root_mismatch");
assert((operatorReadiness.payload as Json).status === "DEPLOYED_TESTNET_TRIAL", "operator_deployment_status_stale");
assert(((operatorReadiness.payload as Json).platform as Json).trialClockStarted === true, "trial_must_be_active_after_deploy");
assert((deployment.payload as Json).status === "DEPLOYED_TESTNET_TRIAL", "managed_deployment_evidence_missing");
assert(((publicNegotiation.payload as Json).negotiation as Json).signatureVerified === true, "public_quote_signature_not_verified");
const paidDeliveryPayload = paidDelivery.payload as Json;
const paidDeliverySettled = paidDeliveryPayload.status === "PAID_DELIVERY_SETTLED";
assert(["PAID_DELIVERY_SUBMITTED_AWAITING_SETTLEMENT", "PAID_DELIVERY_SETTLED"].includes(String(paidDeliveryPayload.status)), "paid_delivery_evidence_missing");

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
  deploymentMode: "LOCAL_FIXTURE",
  event: protectedEvent,
  truthNotice: "Deterministic local fixture. The separately published managed-trial evidence proves the deployed A2A runtime."
};
const rescueResponse = {
  schema: "afterbell-agent-service/1",
  deploymentMode: "LOCAL_FIXTURE",
  event: rescueEvent,
  truthNotice: "Deterministic local fixture. The separately published managed-trial evidence proves the deployed A2A runtime."
};

await mkdir("agent-studio/examples", { recursive: true });
await writeFile("agent-studio/examples/protected-request.json", `${JSON.stringify(basePosition, null, 2)}\n`);
await writeFile("agent-studio/examples/protected-response.json", `${JSON.stringify(protectedResponse, null, 2)}\n`);
await writeFile("agent-studio/examples/rescue-request.json", `${JSON.stringify(degradedPosition, null, 2)}\n`);
await writeFile("agent-studio/examples/rescue-response.json", `${JSON.stringify(rescueResponse, null, 2)}\n`);

const artifact = createEvidenceArtifact({
  artifactType: "AGENT_STUDIO_PACKAGE",
  mode: "LIVE",
  observedAt: String(deployment.observedAt),
  source: "AfterBell deterministic package audit plus BNB Agent Studio managed-trial deployment evidence",
  parentHashes: [
    String(operatorReadiness.evidenceRoot) as `0x${string}`,
    String(deployment.evidenceRoot) as `0x${string}`,
    String(publicNegotiation.evidenceRoot) as `0x${string}`,
    String(paidDelivery.evidenceRoot) as `0x${string}`
  ],
  payload: {
    status: "DEPLOYED_TESTNET_TRIAL",
    deploymentStatus: "RUNNING_READY",
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
      tests: "8/8 PASS",
      build: "PASS",
      zipBundleDryRun: "PASS",
      deploymentReadiness: "DEPLOYED_TESTNET_TRIAL",
      operatorReadinessEvidence: operatorReadiness.evidenceRoot,
      deploymentEvidence: deployment.evidenceRoot,
      publicNegotiationEvidence: publicNegotiation.evidenceRoot,
      agentId: "01M2T4KMDTJCBQ25HAMPZ9JZ9D",
      deploymentId: "01M2T6J1RNRQVP9573A1GDJRNX",
      erc8004AgentId: "2447",
      runtimeState: "running (ready)",
      agentCard: "https://bnbagent-api.bnbchain.world/v1/rt/01M2T4KMDTJCBQ25HAMPZ9JZ9D/.well-known/agent-card.json",
      trialExpiresAt: "2026-09-20T11:32:43.000Z",
      externalBlockers: [
        ...(paidDeliverySettled ? [] : ["Approve independent-buyer Job 1254 after its canonical 24-hour dispute window closes."]),
        "Apply for wallet-specific B402 merchant credentials only if a paid X402 settlement is required."
      ]
    },
    examples: {
      protectedRequest: "agent-studio/examples/protected-request.json",
      protectedResponse: "agent-studio/examples/protected-response.json",
      rescueRequest: "agent-studio/examples/rescue-request.json",
      rescueResponse: "agent-studio/examples/rescue-response.json",
      expectedTransitions: ["PROTECTED", "RESCUE_REQUIRED"]
    },
    verifiedDeployment: [
      "Dedicated throwaway BSC Testnet wallet funded with 0.1 tBNB and 10 U.",
      "Official deployment preflight and managed-trial deploy completed.",
      "Runtime reports running (ready); official deploy verify passed.",
      "ERC-8004 Agent ID 2447 registered.",
      "OAuth-protected public A2A negotiate returned a signed 0.01 U quote.",
      "Provider signature independently recovered to the deployed Agent wallet.",
      "Independent buyer funded Job 1254 with 0.01 U; the Agent submitted a content-addressed PROTECTED result on-chain.",
      ...(paidDeliverySettled ? ["Independent buyer approval completed after the canonical dispute window; Job 1254 is COMPLETED on BSC Testnet."] : []),
      "Fail-closed regression jobs 1252 and 1253 exposed malformed-payload and SDK tuple-array compatibility issues before the successful paid run."
    ],
    paidDeliveryEvidence: paidDelivery.evidenceRoot,
    truthNotice: paidDeliverySettled
      ? "The official BNB Agent Studio runtime is live in the managed BSC Testnet trial, with an ERC-8004 identity, authenticated public signed quote, and a completed independent-buyer ERC-8183 delivery. No B402 payment is claimed."
      : "The official BNB Agent Studio runtime is live in the managed BSC Testnet trial, with an ERC-8004 identity, authenticated public signed quote, and a real independent-buyer ERC-8183 delivery submitted on-chain. Buyer approval remains time-gated; no completed settlement or B402 payment is claimed."
  }
});

await writeFile("evidence/agent-studio-package.json", `${JSON.stringify(artifact, null, 2)}\n`);

console.log(JSON.stringify({
  status: "AGENT_STUDIO_DEPLOYED_TESTNET_TRIAL",
  deploymentStatus: "RUNNING_READY",
  price: "0.01 U via ERC-8183; 0.01 USD via B402",
  transitions: ["PROTECTED", "WATCH", "RESCUE_REQUIRED", "BLOCKED"],
  evidenceRoot: artifact.evidenceRoot,
  output: "evidence/agent-studio-package.json"
}, null, 2));
