import { buildEconomicFingerprint, compareEconomicEquivalence } from "./equivalence.js";
import { deserializeSignedCredential, evaluateConsumerAdmission } from "./consumer.js";
import { signCredential, verifyCredential } from "./credential.js";
import { evaluateContinuity } from "./policy.js";
import { buildRescuePlan } from "./rescue.js";
import { addresses, demoAccount, sampleCredential, sampleEconomic, sampleExecution, sampleMandate, sampleRights, sampleSnapshot } from "./sample.js";
import type { AssetSnapshot, ContinuityMandate, ExecutionEvidence, RightsFingerprint, SignedCredential } from "./types.js";
import { buildPassport } from "./verifier.js";
import { ContinuityWatchtower, type WatchedPosition } from "./watchtower.js";

export type PublicApiRequest = {
  method: string;
  path: string;
  body?: unknown;
};

export type PublicApiResult = {
  status: number;
  body: unknown;
};

const fixtureTimeSeconds = Math.floor(Date.parse("2026-09-17T12:00:00.000Z") / 1000);

function ok(body: unknown, status = 200): PublicApiResult {
  return { status, body };
}

function fail(error: unknown, status = 422): PublicApiResult {
  return { status, body: { error: error instanceof Error ? error.message : String(error) } };
}

function requireObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("json_object_required");
  return value as Record<string, unknown>;
}

async function judgeRun(): Promise<PublicApiResult> {
  const safe = evaluateContinuity({
    snapshot: sampleSnapshot,
    rights: sampleRights,
    economic: sampleEconomic,
    mandate: sampleMandate,
    positionUsd: 21.34,
    proposedTradeUsd: 5,
    proposedSlippageBps: 24,
    nowSeconds: fixtureTimeSeconds
  });
  const badSnapshot = { ...sampleSnapshot, tokenPriceUsd: sampleSnapshot.underlyingPriceUsd * 1.035, exitLiquidityUsd: 4_000 };
  const badEconomic = buildEconomicFingerprint(badSnapshot, sampleRights);
  const rescue = evaluateContinuity({
    snapshot: badSnapshot,
    rights: sampleRights,
    economic: badEconomic,
    mandate: sampleMandate,
    positionUsd: 21.34,
    nowSeconds: fixtureTimeSeconds
  });
  const tampered = buildPassport(sampleExecution({ executedCalldataHash: `0x${"ef".repeat(32)}` }));
  const equivalent = compareEconomicEquivalence(sampleEconomic, sampleEconomic, sampleRights, sampleRights);
  const signedCredential = await signCredential(sampleCredential(fixtureTimeSeconds), demoAccount);
  const credentialVerification = await verifyCredential({
    signed: signedCredential,
    expectedSigner: demoAccount.address,
    nowSeconds: fixtureTimeSeconds + 60
  });
  return ok({
    runId: `judge-${Date.now()}`,
    status: "COMPLETE",
    deploymentMode: "SERVERLESS_READ_ONLY",
    modes: ["SIMULATED", "ADVERSARIAL_TEST"],
    truthNotice: "A reproducible fixture run. No wallet signature, transaction, or custody is requested.",
    stages: [
      { id: "baseline", label: "Baseline continuity check", mode: "SIMULATED", result: safe.state, details: safe },
      { id: "rights", label: "Rights fingerprint bound", mode: "SIMULATED", result: sampleRights.sourceStatus, details: sampleRights },
      { id: "rescue", label: "Premium and liquidity violation", mode: "ADVERSARIAL_TEST", result: rescue.state, details: rescue },
      { id: "equivalence", label: "Economic equivalence", mode: "SIMULATED", result: equivalent.classification, details: equivalent },
      { id: "tamper", label: "Tampered calldata", mode: "ADVERSARIAL_TEST", result: tampered.verification.result, details: tampered },
      { id: "credential", label: "EIP-712 continuity credential", mode: "SIMULATED", result: credentialVerification.valid ? "VALID" : "INVALID", details: credentialVerification }
    ]
  });
}

export async function handlePublicApi(request: PublicApiRequest): Promise<PublicApiResult | undefined> {
  const method = request.method.toUpperCase();
  const path = request.path.replace(/\/+$/, "") || "/";

  if (method === "GET" && (path === "/" || path === "/api" || path === "/api/health")) {
    return ok({
      status: "ok",
      service: "afterbell-continuity-public-api",
      deploymentMode: "SERVERLESS_READ_ONLY",
      timestamp: new Date().toISOString(),
      capabilities: ["continuity-check", "rescue-plan", "credential-verification", "passport-verification", "consumer-admission", "stateless-watchtower"],
      disabledCapabilities: ["wallet-signing", "credential-issuance", "persistent-tasks", "transaction-broadcast"],
      truthNotice: "This public endpoint is deterministic and non-custodial. Stateful Agent operations remain outside the public serverless boundary."
    });
  }
  if (method === "GET" && path === "/api/v1/demo/position") {
    return ok({ snapshot: sampleSnapshot, rights: sampleRights, economic: sampleEconomic, mandate: sampleMandate });
  }
  if (method === "GET" && path === "/api/v1/demo/check") {
    const decision = evaluateContinuity({
      snapshot: sampleSnapshot,
      rights: sampleRights,
      economic: sampleEconomic,
      mandate: sampleMandate,
      positionUsd: 21.34,
      proposedTradeUsd: 5,
      proposedSlippageBps: 24,
      nowSeconds: fixtureTimeSeconds
    });
    return ok({ mode: "SIMULATED", deploymentMode: "SERVERLESS_READ_ONLY", decision });
  }
  if (method === "GET" && path === "/api/v1/demo/judge") return judgeRun();

  try {
    if (method === "POST" && path === "/api/v1/agent/watchtower") {
      const position = requireObject(request.body) as unknown as WatchedPosition;
      if (!position.positionId || !position.snapshot || !position.rights || !position.mandate) throw new Error("invalid_watched_position");
      const event = new ContinuityWatchtower().inspect(position);
      return ok({
        schema: "afterbell-agent-service/1",
        deploymentMode: "SERVERLESS_STATELESS",
        event,
        truthNotice: "Deterministic public inspection only. No task was persisted and no wallet action was requested."
      });
    }
    if (method === "POST" && path === "/api/v1/continuity/check") {
      const body = requireObject(request.body) as unknown as {
        snapshot: AssetSnapshot;
        rights: RightsFingerprint;
        mandate: ContinuityMandate;
        positionUsd: number;
        proposedTradeUsd?: number;
        proposedSlippageBps?: number;
        dailySpendUsd?: number;
      };
      const economic = buildEconomicFingerprint(body.snapshot, body.rights);
      return ok({ economic, decision: evaluateContinuity({ ...body, economic }) });
    }
    if (method === "POST" && path === "/api/v1/rescue/plan") {
      const body = requireObject(request.body) as unknown as Parameters<typeof buildRescuePlan>[0];
      return ok(buildRescuePlan(body));
    }
    if (method === "POST" && path === "/api/v1/credentials/verify") {
      const body = requireObject(request.body) as unknown as { signed: SignedCredential; expectedSigner?: `0x${string}`; nowSeconds?: number };
      const signed = {
        ...body.signed,
        credential: {
          ...body.signed.credential,
          economicExposureMicros: BigInt(body.signed.credential.economicExposureMicros),
          issuedAt: BigInt(body.signed.credential.issuedAt),
          expiresAt: BigInt(body.signed.credential.expiresAt)
        }
      };
      return ok(await verifyCredential({
        signed,
        ...(body.expectedSigner ? { expectedSigner: body.expectedSigner } : {}),
        ...(body.nowSeconds === undefined ? {} : { nowSeconds: body.nowSeconds })
      }));
    }
    if (method === "POST" && path === "/api/v1/passports/verify") {
      return ok(buildPassport(requireObject(request.body) as unknown as ExecutionEvidence));
    }
    if (method === "POST" && path === "/api/v1/consumers/admit") {
      const body = requireObject(request.body) as unknown as {
        signedCredential: unknown;
        passport: import("./types.js").ContinuityPassport;
        trustedSigner: `0x${string}`;
        nowSeconds?: number;
        maximumRiskTier?: 0 | 1 | 2 | 3;
      };
      if (!body.passport || !/^0x[0-9a-fA-F]{40}$/.test(body.trustedSigner ?? "")) throw new Error("invalid_consumer_admission_request");
      return ok(await evaluateConsumerAdmission({
        signedCredential: deserializeSignedCredential(body.signedCredential),
        passport: body.passport,
        trustedSigner: body.trustedSigner,
        ...(body.nowSeconds === undefined ? {} : { nowSeconds: body.nowSeconds }),
        ...(body.maximumRiskTier === undefined ? {} : { maximumRiskTier: body.maximumRiskTier })
      }));
    }
    if (path.startsWith("/api/v1/watch/tasks") || path === "/api/v1/credentials/issue") {
      return fail("capability_disabled_on_public_serverless_runtime", 501);
    }
  } catch (error) {
    return fail(error);
  }
  return undefined;
}
