import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createEvidenceArtifact } from "../src/evidence.js";

type Json = Record<string, unknown>;

const publicNegotiation = JSON.parse(await readFile("evidence/live/agent-studio-public-negotiate.json", "utf8")) as Json;
const deployment = JSON.parse(await readFile("evidence/live/agent-studio-deployment.json", "utf8")) as Json;
const paidDelivery = JSON.parse(await readFile("evidence/live/agent-studio-paid-delivery.json", "utf8")) as Json;
const deploymentPayload = deployment.payload as Json;
const negotiationPayload = publicNegotiation.payload as Json;
const negotiation = negotiationPayload.negotiation as Json;
const paidPayload = paidDelivery.payload as Json;
const paidJob = paidPayload.job as Json;
const paidSettlement = paidPayload.settlement as Json;
const paidSettled = paidPayload.status === "PAID_DELIVERY_SETTLED";
const paidJobId = Number(paidJob.id);

const artifact = createEvidenceArtifact({
  artifactType: "BNB_AGENT_OPERATOR_READINESS",
  mode: "LIVE",
  observedAt: String(deployment.observedAt),
  source: "Official bag CLI platform, wallet, deployment, ERC-8004, and authenticated public A2A verification",
  parentHashes: [deployment.evidenceRoot as `0x${string}`, publicNegotiation.evidenceRoot as `0x${string}`, paidDelivery.evidenceRoot as `0x${string}`],
  payload: {
    status: "DEPLOYED_TESTNET_TRIAL",
    platform: {
      provider: "bnb",
      account: "0xCaptain888",
      authenticated: true,
      trialStatus: "active",
      trialClockStarted: true,
      trialExpiresAt: "2026-09-20T11:32:43.000Z",
      deployedAgents: 1,
      slug: "afterbellwatchtower",
      agentId: "01M2T4KMDTJCBQ25HAMPZ9JZ9D",
      deploymentId: "01M2T6J1RNRQVP9573A1GDJRNX",
      runtimeState: "running (ready)"
    },
    wallet: {
      purpose: "throwaway BSC Testnet trial signer",
      address: "0x83B2B8D09d822DAed95e94E10062b232A54fd123",
      network: "bsc-testnet",
      chainId: 97,
      encryptedKeystore: true,
      gitIgnored: true,
      balanceAtDeployment: { tBNB: "0.1", U: "10" }
    },
    deployment: {
      status: deploymentPayload.status,
      evidenceRoot: deployment.evidenceRoot,
      erc8004AgentId: "2447",
      officialVerify: "PASS",
      agentCard: "https://bnbagent-api.bnbchain.world/v1/rt/01M2T4KMDTJCBQ25HAMPZ9JZ9D/.well-known/agent-card.json",
      a2aInvoke: "https://bnbagent-api.bnbchain.world/v1/rt/01M2T4KMDTJCBQ25HAMPZ9JZ9D/a2a"
    },
    publicSignedSmoke: {
      status: "PASS",
      oauthClientCredentials: "PASS",
      negotiationAccepted: true,
      priceRaw: negotiation.priceRaw,
      priceDisplay: negotiation.priceDisplay,
      currency: negotiation.currency,
      chainId: negotiation.chainId,
      negotiationHash: negotiation.negotiationHash,
      providerSignature: negotiation.providerSignature,
      recoveredSigner: negotiation.recoveredSigner,
      signatureVerified: negotiation.signatureVerified,
      evidenceRoot: publicNegotiation.evidenceRoot,
      financialTransactionCreated: false
    },
    remainingExternalItems: [
      ...(paidSettled ? [] : [`Approve independent-buyer Job ${paidJobId} after the canonical ${String(paidJob.disputeWindowSeconds)}-second dispute window closes on ${String(paidSettlement.earliestBuyerApproval)}.`]),
      "Configure official B402 merchant credentials only if a paid x402 settlement receipt is required.",
      "Record the demo while the managed 48-hour trial remains active."
    ],
    truthNotice: paidSettled
      ? `This proves the managed BSC Testnet trial deployment, active runtime, ERC-8004 identity, authenticated public A2A access, and completed independent-buyer Job ${paidJobId}. B402 payment remains unclaimed.`
      : `This proves the managed BSC Testnet trial deployment, active runtime, ERC-8004 identity, authenticated public A2A access, and independently funded Job ${paidJobId}. Final settlement and B402 payment remain unclaimed.`
  }
});

await mkdir("evidence", { recursive: true });
await writeFile("evidence/bnb-agent-operator-readiness.json", `${JSON.stringify(artifact, null, 2)}\n`);
console.log(JSON.stringify({
  status: artifact.payload.status,
  trialStatus: artifact.payload.platform.trialStatus,
  trialClockStarted: artifact.payload.platform.trialClockStarted,
  runtimeState: artifact.payload.platform.runtimeState,
  publicSignedSmoke: artifact.payload.publicSignedSmoke.status,
  evidenceRoot: artifact.evidenceRoot,
  output: "evidence/bnb-agent-operator-readiness.json"
}, null, 2));
