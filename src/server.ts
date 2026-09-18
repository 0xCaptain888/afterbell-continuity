import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { buildEconomicFingerprint, compareEconomicEquivalence } from "./equivalence.js";
import { verifyBearerToken } from "./auth.js";
import { deserializeSignedCredential, evaluateConsumerAdmission } from "./consumer.js";
import { signCredential, verifyCredential } from "./credential.js";
import { evaluateContinuity } from "./policy.js";
import { buildRescuePlan } from "./rescue.js";
import { buildPassport } from "./verifier.js";
import { addresses, demoAccount, sampleCredential, sampleEconomic, sampleExecution, sampleMandate, sampleRights, sampleSnapshot } from "./sample.js";
import { privateKeyToAccount } from "viem/accounts";
import { FileWatchTaskStore, type WatchTask } from "./task-store.js";
import { ContinuityWatchtower } from "./watchtower.js";
import type { AssetSnapshot, ContinuityMandate, ExecutionEvidence, RightsFingerprint, SignedCredential } from "./types.js";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const siteRoot = join(projectRoot, "site");
const publicEvidenceRoot = join(projectRoot, "evidence", "live");
const port = Number(process.env.PORT ?? 4173);
const host = process.env.HOST ?? "127.0.0.1";
const apiToken = process.env.AFTERBELL_API_TOKEN;
if (!["127.0.0.1", "localhost", "::1"].includes(host) && !apiToken) {
  throw new Error("public_bind_requires_afterbell_api_token");
}
const taskStore = new FileWatchTaskStore(process.env.AFTERBELL_TASK_JOURNAL ?? join(projectRoot, ".runtime/watchtower.jsonl"));
const watchtower = new ContinuityWatchtower();

const mime: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function json(response: import("node:http").ServerResponse, status: number, value: unknown) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  });
  response.end(JSON.stringify(value, (_, item) => typeof item === "bigint" ? item.toString() : item, 2));
}

function authorizeWrite(request: import("node:http").IncomingMessage, response: import("node:http").ServerResponse): boolean {
  if (verifyBearerToken(request.headers.authorization, apiToken)) return true;
  json(response, 401, { error: "unauthorized" });
  return false;
}

async function readJsonBody<T>(request: import("node:http").IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const value = Buffer.from(chunk);
    size += value.length;
    if (size > 1_000_000) throw new Error("request_body_too_large");
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as T;
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
    });
    return response.end();
  }
  if (url.pathname === "/api/health") {
    return json(response, 200, { status: "ok", service: "afterbell-continuity", mode: "SIMULATED", timestamp: new Date().toISOString() });
  }
  if (url.pathname === "/api/v1/demo/position") {
    return json(response, 200, { snapshot: sampleSnapshot, rights: sampleRights, economic: sampleEconomic, mandate: sampleMandate });
  }
  if (url.pathname === "/api/v1/demo/check") {
    const decision = evaluateContinuity({
      snapshot: sampleSnapshot,
      rights: sampleRights,
      economic: sampleEconomic,
      mandate: sampleMandate,
      positionUsd: 21.34,
      proposedTradeUsd: 5,
      proposedSlippageBps: 24,
      nowSeconds: Math.floor(Date.parse("2026-09-17T12:00:00.000Z") / 1000)
    });
    return json(response, 200, { mode: "SIMULATED", decision });
  }
  if (url.pathname === "/api/v1/demo/judge") {
    const safe = evaluateContinuity({
      snapshot: sampleSnapshot,
      rights: sampleRights,
      economic: sampleEconomic,
      mandate: sampleMandate,
      positionUsd: 21.34,
      proposedTradeUsd: 5,
      proposedSlippageBps: 24,
      nowSeconds: Math.floor(Date.parse("2026-09-17T12:00:00.000Z") / 1000)
    });
    const badSnapshot = { ...sampleSnapshot, tokenPriceUsd: sampleSnapshot.underlyingPriceUsd * 1.035, exitLiquidityUsd: 4_000 };
    const badEconomic = buildEconomicFingerprint(badSnapshot, sampleRights);
    const rescue = evaluateContinuity({
      snapshot: badSnapshot,
      rights: sampleRights,
      economic: badEconomic,
      mandate: sampleMandate,
      positionUsd: 21.34,
      nowSeconds: Math.floor(Date.parse("2026-09-17T12:00:00.000Z") / 1000)
    });
    const tampered = buildPassport(sampleExecution({ executedCalldataHash: `0x${"ef".repeat(32)}` }));
    const equivalent = compareEconomicEquivalence(sampleEconomic, sampleEconomic, sampleRights, sampleRights);
    const signedCredential = await signCredential(sampleCredential(Math.floor(Date.parse("2026-09-17T12:00:00.000Z") / 1000)), demoAccount);
    const credentialVerification = await verifyCredential({ signed: signedCredential, expectedSigner: demoAccount.address, nowSeconds: Math.floor(Date.parse("2026-09-17T12:01:00.000Z") / 1000) });
    return json(response, 200, {
      runId: `judge-${Date.now()}`,
      status: "COMPLETE",
      modes: ["SIMULATED", "ADVERSARIAL_TEST"],
      stages: [
        { id: "live-baseline", label: "Baseline continuity check", mode: "SIMULATED", result: safe.state, details: safe },
        { id: "rights", label: "Rights fingerprint bound", mode: "SIMULATED", result: sampleRights.sourceStatus, details: sampleRights },
        { id: "premium-rescue", label: "Premium and liquidity violation", mode: "ADVERSARIAL_TEST", result: rescue.state, details: rescue },
        { id: "equivalence", label: "Economic equivalence", mode: "SIMULATED", result: equivalent.classification, details: equivalent },
        { id: "tamper", label: "Tampered calldata", mode: "ADVERSARIAL_TEST", result: tampered.verification.result, details: tampered },
        { id: "credential", label: "EIP-712 continuity credential", mode: "SIMULATED", result: credentialVerification.valid ? "VALID" : "INVALID", details: credentialVerification }
      ]
    });
  }

  if (url.pathname === "/api/v1/agent/watchtower" && request.method === "POST") {
    if (!authorizeWrite(request, response)) return;
    try {
      const position = await readJsonBody<import("./watchtower.js").WatchedPosition>(request);
      if (!position?.positionId || !position.snapshot || !position.rights || !position.mandate) throw new Error("invalid_watched_position");
      const event = watchtower.inspect(position);
      return json(response, 200, {
        schema: "afterbell-agent-service/1",
        deploymentMode: "LOCAL_UNPUBLISHED",
        event,
        truthNotice: "Deterministic local service response. This is not yet an Agent Studio deployment receipt."
      });
    } catch (error) {
      return json(response, 422, { error: error instanceof Error ? error.message : String(error) });
    }
  }

  if (url.pathname === "/api/v1/watch/tasks" && request.method === "GET") {
    return json(response, 200, { tasks: await taskStore.list() });
  }

  if (url.pathname === "/api/v1/watch/tasks" && request.method === "POST") {
    if (!authorizeWrite(request, response)) return;
    try {
      const body = await readJsonBody<{ position: import("./watchtower.js").WatchedPosition; intervalSeconds?: number }>(request);
      const intervalSeconds = body.intervalSeconds ?? 300;
      if (!body.position?.positionId || !body.position.snapshot || !body.position.rights || !body.position.mandate) throw new Error("invalid_watched_position");
      if (!Number.isInteger(intervalSeconds) || intervalSeconds < 30 || intervalSeconds > 86_400) throw new Error("invalid_interval_seconds");
      const now = new Date();
      const task: WatchTask = {
        taskId: randomUUID(),
        status: "ACTIVE",
        intervalSeconds,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        nextRunAt: new Date(now.getTime() + intervalSeconds * 1000).toISOString(),
        position: body.position
      };
      await taskStore.upsert(task);
      return json(response, 201, task);
    } catch (error) {
      return json(response, 422, { error: error instanceof Error ? error.message : String(error) });
    }
  }

  const inspectMatch = url.pathname.match(/^\/api\/v1\/watch\/tasks\/([^/]+)\/inspect$/);
  if (inspectMatch && request.method === "POST") {
    if (!authorizeWrite(request, response)) return;
    const task = await taskStore.get(inspectMatch[1] ?? "");
    if (!task) return json(response, 404, { error: "watch_task_not_found" });
    try {
      const body = await readJsonBody<Partial<Pick<import("./watchtower.js").WatchedPosition, "snapshot" | "rights" | "positionUsd" | "amount">>>(request);
      const position = { ...task.position, ...body };
      const observedAt = new Date().toISOString();
      const event = watchtower.inspect(position, observedAt);
      const updated: WatchTask = {
        ...task,
        position,
        updatedAt: observedAt,
        nextRunAt: new Date(Date.parse(observedAt) + task.intervalSeconds * 1000).toISOString(),
        lastEvent: event
      };
      await taskStore.upsert(updated);
      return json(response, 200, { task: updated, event });
    } catch (error) {
      return json(response, 422, { error: error instanceof Error ? error.message : String(error) });
    }
  }

  if (request.method === "POST" && url.pathname === "/api/v1/continuity/check") {
    try {
      const body = await readJsonBody<{
        snapshot: AssetSnapshot;
        rights: RightsFingerprint;
        mandate: ContinuityMandate;
        positionUsd: number;
        proposedTradeUsd?: number;
        proposedSlippageBps?: number;
        dailySpendUsd?: number;
      }>(request);
      const economic = buildEconomicFingerprint(body.snapshot, body.rights);
      const decision = evaluateContinuity({ ...body, economic });
      return json(response, 200, { economic, decision });
    } catch (error) {
      return json(response, 422, { error: error instanceof Error ? error.message : String(error) });
    }
  }

  if (request.method === "POST" && url.pathname === "/api/v1/rescue/plan") {
    try {
      const body = await readJsonBody<{
        reason: string;
        fromAsset: `0x${string}`;
        amount: string;
        expectedOutput: string;
        estimatedSlippageBps: number;
        quoteObservedAt: string;
        quoteTtlSeconds: number;
        mandate: ContinuityMandate;
        quotePayload: unknown;
        mode: AssetSnapshot["mode"];
      }>(request);
      return json(response, 200, buildRescuePlan(body));
    } catch (error) {
      return json(response, 422, { error: error instanceof Error ? error.message : String(error) });
    }
  }

  if (request.method === "POST" && url.pathname === "/api/v1/credentials/verify") {
    try {
      const body = await readJsonBody<{ signed: SignedCredential; expectedSigner?: `0x${string}`; nowSeconds?: number }>(request);
      const signed = {
        ...body.signed,
        credential: {
          ...body.signed.credential,
          economicExposureMicros: BigInt(body.signed.credential.economicExposureMicros),
          issuedAt: BigInt(body.signed.credential.issuedAt),
          expiresAt: BigInt(body.signed.credential.expiresAt)
        }
      };
      return json(response, 200, await verifyCredential({ signed, ...(body.expectedSigner ? { expectedSigner: body.expectedSigner } : {}), ...(body.nowSeconds ? { nowSeconds: body.nowSeconds } : {}) }));
    } catch (error) {
      return json(response, 422, { error: error instanceof Error ? error.message : String(error) });
    }
  }

  if (request.method === "POST" && url.pathname === "/api/v1/credentials/issue") {
    if (!authorizeWrite(request, response)) return;
    const key = process.env.AFTERBELL_SIGNER_PRIVATE_KEY;
    if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) return json(response, 503, { error: "credential_signer_not_configured" });
    try {
      const credential = await readJsonBody<import("./types.js").ContinuityCredential>(request);
      const normalized = {
        ...credential,
        registry: credential.registry ?? addresses.registry,
        economicExposureMicros: BigInt(credential.economicExposureMicros),
        issuedAt: BigInt(credential.issuedAt),
        expiresAt: BigInt(credential.expiresAt)
      };
      return json(response, 200, await signCredential(normalized, privateKeyToAccount(key as `0x${string}`)));
    } catch (error) {
      return json(response, 422, { error: error instanceof Error ? error.message : String(error) });
    }
  }

  if (request.method === "POST" && url.pathname === "/api/v1/passports/verify") {
    try {
      const execution = await readJsonBody<ExecutionEvidence>(request);
      return json(response, 200, buildPassport(execution));
    } catch (error) {
      return json(response, 422, { error: error instanceof Error ? error.message : String(error) });
    }
  }

  if (request.method === "POST" && url.pathname === "/api/v1/consumers/admit") {
    try {
      const body = await readJsonBody<{
        signedCredential: unknown;
        passport: import("./types.js").ContinuityPassport;
        trustedSigner: `0x${string}`;
        nowSeconds?: number;
        maximumRiskTier?: 0 | 1 | 2 | 3;
      }>(request);
      if (!body.passport || !/^0x[0-9a-fA-F]{40}$/.test(body.trustedSigner ?? "")) throw new Error("invalid_consumer_admission_request");
      return json(response, 200, await evaluateConsumerAdmission({
        signedCredential: deserializeSignedCredential(body.signedCredential),
        passport: body.passport,
        trustedSigner: body.trustedSigner,
        ...(body.nowSeconds === undefined ? {} : { nowSeconds: body.nowSeconds }),
        ...(body.maximumRiskTier === undefined ? {} : { maximumRiskTier: body.maximumRiskTier })
      }));
    } catch (error) {
      return json(response, 422, { error: error instanceof Error ? error.message : String(error) });
    }
  }

  if (request.method === "GET" && url.pathname.startsWith("/evidence/")) {
    const evidenceName = normalize(url.pathname.slice("/evidence/".length)).replace(/^(\.\.(\/|\\|$))+/, "");
    const evidencePath = join(publicEvidenceRoot, evidenceName);
    if (!evidencePath.startsWith(publicEvidenceRoot) || !evidenceName.endsWith(".json")) return json(response, 403, { error: "forbidden" });
    try {
      const body = await readFile(evidencePath);
      response.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
      return response.end(body);
    } catch {
      return json(response, 404, { error: "evidence_not_found" });
    }
  }

  const requested = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
  const safePath = normalize(requested).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = join(siteRoot, safePath);
  if (!filePath.startsWith(siteRoot)) return json(response, 403, { error: "forbidden" });
  try {
    const body = await readFile(filePath);
    response.writeHead(200, { "Content-Type": mime[extname(filePath)] ?? "application/octet-stream" });
    response.end(body);
  } catch {
    json(response, 404, { error: "not_found" });
  }
});

server.listen(port, host, () => {
  console.log(`AfterBell Continuity running at http://${host}:${port}`);
});
