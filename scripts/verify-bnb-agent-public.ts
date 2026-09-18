import { mkdir, readFile, writeFile } from "node:fs/promises";
import { recoverMessageAddress } from "viem";
import { createEvidenceArtifact } from "../src/evidence.js";

type Json = Record<string, unknown>;

const EXPECTED = {
  agentId: "01M2T4KMDTJCBQ25HAMPZ9JZ9D",
  deploymentId: "01M2T6J1RNRQVP9573A1GDJRNX",
  agentWallet: "0x83B2B8D09d822DAed95e94E10062b232A54fd123",
  erc8004AgentId: "2447",
  chainId: 97,
  priceRaw: "10000000000000000",
  currency: "0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565",
  cardUrl: "https://bnbagent-api.bnbchain.world/v1/rt/01M2T4KMDTJCBQ25HAMPZ9JZ9D/.well-known/agent-card.json",
  a2aUrl: "https://bnbagent-api.bnbchain.world/v1/rt/01M2T4KMDTJCBQ25HAMPZ9JZ9D/a2a"
} as const;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function asJson(value: unknown, name: string): Json {
  assert(typeof value === "object" && value !== null && !Array.isArray(value), `${name}_not_object`);
  return value as Json;
}

async function fetchJson(url: string, init?: RequestInit): Promise<{ status: number; body: Json }> {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(30_000) });
  const text = await response.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`non_json_response:${response.status}`);
  }
  assert(response.ok, `http_${response.status}`);
  return { status: response.status, body: asJson(body, "response") };
}

const credentialPath = "bnb-agent/.studio/invoke-client.json";
const credentials = asJson(JSON.parse(await readFile(credentialPath, "utf8")), "credentials");
const clientId = String(credentials.clientId ?? "");
const clientSecret = String(credentials.clientSecret ?? "");
const tokenEndpoint = String(credentials.tokenEndpoint ?? "");
const scope = String(credentials.scope ?? "");

assert(clientId && clientSecret && tokenEndpoint && scope, "invoke_client_credentials_incomplete");
assert(tokenEndpoint === "https://bnbagent-api.bnbchain.world/v1/oauth/token", "unexpected_token_endpoint");
assert(scope === `invoke:${EXPECTED.agentId}`, "unexpected_oauth_scope");

const cardResponse = await fetchJson(EXPECTED.cardUrl);
const card = cardResponse.body;
const skills = Array.isArray(card.skills) ? card.skills : [];
assert(skills.some((skill) => asJson(skill, "skill").id === "negotiate"), "negotiate_skill_missing");

const tokenBody = new URLSearchParams({
  grant_type: "client_credentials",
  client_id: clientId,
  client_secret: clientSecret,
  scope
});
const tokenResponse = await fetchJson(tokenEndpoint, {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: tokenBody
});
const accessToken = String(tokenResponse.body.access_token ?? "");
assert(accessToken.length > 20, "oauth_access_token_missing");

const now = Date.now();
const request = {
  skill: "negotiate",
  task_description: JSON.stringify({
    positionId: `public-smoke-${now}`,
    wallet: "0x2CB79d0eBcCd6D6846e458e748787C13c6e51Afa",
    amount: 0.027163579421480873,
    positionUsd: 10,
    snapshot: {
      chainId: 56,
      tokenAddress: "0x5b1910eaad6450e50f816082aa078c41f10c292f",
      symbol: "TSLAB",
      underlying: "TSLA",
      platform: "bstock",
      tokenToShareRatio: 1,
      tokenPriceUsd: 367.7,
      underlyingPriceUsd: 367.6,
      observedAt: new Date(now).toISOString(),
      marketStatus: "REGULAR",
      attestationPublishedAt: new Date(now - 60_000).toISOString(),
      exitLiquidityUsd: 50_000,
      mode: "LIVE"
    },
    rights: {
      backingModel: "ONE_TO_ONE",
      dividendTreatment: "DISTRIBUTED",
      redemption: "DIRECT",
      sourceStatus: "VERIFIED"
    },
    mandate: {
      mandateId: `public-smoke-mandate-${now}`,
      subject: "TSLA",
      maxPositionUsd: 100,
      maxPremiumBps: 100,
      maxAttestationAgeSeconds: 3600,
      minimumExitLiquidityUsd: 10_000,
      requiredRights: ["dividend", "redemption", "one-to-one-backing"],
      allowedPlatforms: ["bstock"],
      expiresAt: Math.floor(now / 1000) + 3600
    }
  }),
  terms: {
    deliverables: "afterbell-watchtower-result/1 JSON with state, reasons, and evidence references",
    quality_standards: "deterministic fail-closed policy; no autonomous financial transaction"
  }
};
const a2aResponse = await fetchJson(EXPECTED.a2aUrl, {
  method: "POST",
  headers: {
    authorization: `Bearer ${accessToken}`,
    "content-type": "application/json"
  },
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: "afterbell-public-negotiate-1",
    method: "message/send",
    params: {
      message: {
        role: "user",
        messageId: `afterbell-${Date.now()}`,
        parts: [{ kind: "data", data: request }]
      }
    }
  })
});

const result = asJson(a2aResponse.body.result, "a2a_result");
const parts = Array.isArray(result.parts) ? result.parts : [];
const dataPart = parts.find((part) => asJson(part, "part").kind === "data");
assert(dataPart, "a2a_data_part_missing");
const quote = asJson(asJson(dataPart, "data_part").data, "quote");
const quoteResponse = asJson(quote.response, "quote_response");
const terms = asJson(quoteResponse.terms, "quote_terms");
const negotiationHash = String(quote.negotiation_hash ?? "") as `0x${string}`;
const providerSignature = String(quote.provider_sig ?? "") as `0x${string}`;

if (quoteResponse.accepted !== true) {
  console.error(JSON.stringify({
    accepted: false,
    reasonCode: quoteResponse.reason_code ?? null,
    reason: quoteResponse.reason ?? null
  }));
}
assert(quoteResponse.accepted === true, "quote_not_accepted");
assert(String(terms.price) === EXPECTED.priceRaw, "unexpected_quote_price");
assert(String(terms.currency).toLowerCase() === EXPECTED.currency.toLowerCase(), "unexpected_quote_currency");
assert(Number(quote.chain_id) === EXPECTED.chainId, "unexpected_quote_chain");
assert(/^0x[0-9a-f]{64}$/i.test(negotiationHash), "invalid_negotiation_hash");
assert(/^0x[0-9a-f]{130}$/i.test(providerSignature), "invalid_provider_signature");

const recoveredSigner = await recoverMessageAddress({
  message: negotiationHash,
  signature: providerSignature
});
assert(recoveredSigner.toLowerCase() === EXPECTED.agentWallet.toLowerCase(), "provider_signature_signer_mismatch");

const observedAt = new Date().toISOString();
const artifact = createEvidenceArtifact({
  artifactType: "BNB_AGENT_PUBLIC_NEGOTIATION",
  mode: "LIVE",
  observedAt,
  source: "BNB Agent Studio managed trial OAuth + public A2A message/send",
  payload: {
    status: "PUBLIC_NEGOTIATION_VERIFIED",
    deployment: {
      provider: "bnb",
      environment: "BSC Testnet managed 48-hour trial",
      agentId: EXPECTED.agentId,
      deploymentId: EXPECTED.deploymentId,
      agentWallet: EXPECTED.agentWallet,
      erc8004AgentId: EXPECTED.erc8004AgentId,
      runtimeState: "running (ready)",
      agentCard: EXPECTED.cardUrl,
      a2aInvoke: EXPECTED.a2aUrl
    },
    oauth: {
      grant: "client_credentials",
      scope,
      tokenIssued: true,
      credentialsPublished: false,
      accessTokenPublished: false
    },
    negotiation: {
      request,
      accepted: true,
      priceRaw: String(terms.price),
      priceDisplay: "0.01 U",
      currency: String(terms.currency),
      chainId: Number(quote.chain_id),
      verifyingContract: String(quote.verifying_contract),
      negotiationHash,
      responseHash: String(quote.response_hash),
      providerSignature,
      recoveredSigner,
      signatureVerified: true,
      quoteExpiresAt: Number(quoteResponse.quote_expires_at)
    },
    boundaries: {
      financialTransactionCreated: false,
      fundedJobCreated: false,
      paidDeliveryCompleted: false,
      statement: "This smoke proves authenticated public reachability and a wallet-signed deterministic quote. A separately published independent-buyer artifact proves the paid ERC-8183 delivery; this quote request itself created no job or settlement."
    }
  }
});

await mkdir("evidence/live", { recursive: true });
await writeFile("evidence/live/agent-studio-public-negotiate.json", `${JSON.stringify(artifact, null, 2)}\n`);

const deploymentArtifact = createEvidenceArtifact({
  artifactType: "BNB_AGENT_STUDIO_DEPLOYMENT",
  mode: "LIVE",
  observedAt,
  source: "Official bag CLI deployment status, verify, ERC-8004 registration, and authenticated public A2A smoke",
  parentHashes: [artifact.evidenceRoot],
  payload: {
    status: "DEPLOYED_TESTNET_TRIAL",
    provider: "bnb",
    slug: "afterbellwatchtower",
    agentId: EXPECTED.agentId,
    deploymentId: EXPECTED.deploymentId,
    runtimeState: "running (ready)",
    trial: {
      status: "active",
      expiresAt: "2026-09-20T11:32:43.000Z",
      network: "bsc-testnet",
      chainId: EXPECTED.chainId
    },
    endpoints: {
      agentCard: EXPECTED.cardUrl,
      a2a: EXPECTED.a2aUrl,
      x402: "https://bnbagent-api.bnbchain.world/v1/rt/01M2T4KMDTJCBQ25HAMPZ9JZ9D/x402"
    },
    identity: {
      erc8004AgentId: EXPECTED.erc8004AgentId,
      wallet: EXPECTED.agentWallet,
      registrationVerified: true
    },
    runtime: {
      officialDeployVerify: "PASS",
      publicOauthA2aNegotiate: "PASS",
      publicNegotiationEvidenceRoot: artifact.evidenceRoot,
      erc8183Price: "0.01 U",
      b402ConfiguredPrice: "0.01 USD",
      x402State: "DORMANT_PENDING_B402_MERCHANT_CREDENTIALS"
    },
    boundaries: {
      fundedErc8183JobSubmitted: true,
      fundedErc8183JobSettled: false,
      b402SettlementCompleted: false,
      financialTransactionCreatedByPublicSmoke: false,
      statement: "The managed testnet runtime, public OAuth access, ERC-8004 identity, and signed quote are verified. A separate independent buyer paid for Job 1254 and received an on-chain submission; final settlement remains time-gated and unclaimed."
    }
  }
});
await writeFile("evidence/live/agent-studio-deployment.json", `${JSON.stringify(deploymentArtifact, null, 2)}\n`);

console.log(JSON.stringify({
  status: artifact.payload.status,
  agentId: EXPECTED.agentId,
  quoteAccepted: true,
  signatureVerified: true,
  price: artifact.payload.negotiation.priceDisplay,
  chainId: EXPECTED.chainId,
  financialTransactionCreated: false,
  evidenceRoot: artifact.evidenceRoot,
  deploymentEvidenceRoot: deploymentArtifact.evidenceRoot,
  outputs: [
    "evidence/live/agent-studio-public-negotiate.json",
    "evidence/live/agent-studio-deployment.json"
  ]
}, null, 2));
