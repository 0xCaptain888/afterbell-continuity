import { createHash } from "node:crypto";
import { z } from "zod";

const snapshotSchema = z.object({
  chainId: z.number().int().positive(),
  tokenAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  symbol: z.string().min(1),
  underlying: z.string().min(1),
  platform: z.string().min(1),
  tokenToShareRatio: z.number().positive(),
  tokenPriceUsd: z.number().nonnegative(),
  underlyingPriceUsd: z.number().positive(),
  observedAt: z.string().datetime(),
  marketStatus: z.enum(["PRE_MARKET", "REGULAR", "AFTER_HOURS", "CLOSED", "HALTED"]),
  attestationPublishedAt: z.string().datetime().optional(),
  exitLiquidityUsd: z.number().nonnegative().optional(),
  mode: z.enum(["LIVE", "MAINNET", "SIMULATED", "ADVERSARIAL_TEST", "DESIGN", "UNAVAILABLE"])
}).passthrough();

const rightsSchema = z.object({
  backingModel: z.enum(["ONE_TO_ONE", "OVER_COLLATERALIZED", "SYNTHETIC", "UNKNOWN"]),
  dividendTreatment: z.enum(["DISTRIBUTED", "REINVESTED", "NONE", "UNKNOWN"]),
  redemption: z.enum(["DIRECT", "RESTRICTED", "NONE", "UNKNOWN"]),
  sourceStatus: z.enum(["VERIFIED", "PARTIAL", "UNVERIFIED"])
}).passthrough();

const mandateSchema = z.object({
  mandateId: z.string().min(1),
  subject: z.string().min(1),
  maxPositionUsd: z.number().nonnegative(),
  maxPremiumBps: z.number().nonnegative(),
  maxAttestationAgeSeconds: z.number().int().nonnegative(),
  minimumExitLiquidityUsd: z.number().nonnegative(),
  requiredRights: z.array(z.enum(["dividend", "redemption", "one-to-one-backing"])),
  allowedPlatforms: z.array(z.string().min(1)).min(1),
  expiresAt: z.number().int().positive()
}).passthrough();

const inspectionSchema = z.object({
  positionId: z.string().min(1),
  wallet: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  amount: z.number().nonnegative(),
  positionUsd: z.number().nonnegative(),
  inspectionObservedAt: z.string().datetime().optional(),
  snapshot: snapshotSchema,
  rights: rightsSchema,
  mandate: mandateSchema
});

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

function stableJson(value: Json): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key] as Json)}`).join(",")}}`;
}

function sha256(value: Json): `0x${string}` {
  return `0x${createHash("sha256").update(stableJson(value)).digest("hex")}`;
}

function normalizeSdkTupleArrays(input: string): string {
  let output = "";
  let inString = false;
  let escaped = false;
  for (const character of input) {
    if (inString) {
      output += character;
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') {
      inString = true;
      output += character;
    } else if (character === "(") output += "[";
    else if (character === ")") output += "]";
    else output += character;
  }
  return output;
}

function parseJsonCompat(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch (error) {
    // SDK 0.5.5 serializes nested arrays inside task strings using tuple
    // parentheses. Parentheses are not valid JSON, so normalize only those
    // occurring outside quoted strings and retry. This keeps signed string
    // content intact while accepting the exact on-chain JobDescription form.
    if (!input.includes("(") || !input.includes(")")) throw error;
    return JSON.parse(normalizeSdkTupleArrays(input));
  }
}

function unwrapJson(input: string): unknown {
  const trimmed = input.trim();
  const unfenced = trimmed.startsWith("```")
    ? trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
    : trimmed;
  const jobContextMarker = "JOB CONTEXT:";
  const candidate = unfenced.includes(jobContextMarker)
    ? unfenced.slice(unfenced.indexOf(jobContextMarker) + jobContextMarker.length).trim()
    : unfenced;
  const parsed = parseJsonCompat(candidate);

  // ERC-8183 delivery wraps the signed JobDescription as
  // { task: <original task_description>, terms: ... } inside a human-readable
  // execution prompt. The deterministic Watchtower evaluates the original
  // task payload, not the wrapper prose.
  if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
    const task = (parsed as Record<string, unknown>).task;
    if (typeof task === "string") return unwrapJson(task);
    if (task !== undefined) return task;
  }
  return parsed;
}

export function inspectAfterBellPosition(prompt: string): string {
  const parsed = inspectionSchema.parse(unwrapJson(prompt));
  const observedAt = parsed.snapshot.mode === "SIMULATED" && parsed.inspectionObservedAt
    ? parsed.inspectionObservedAt
    : new Date().toISOString();
  const nowSeconds = Math.floor(Date.parse(observedAt) / 1_000);
  const referencePrice = parsed.snapshot.underlyingPriceUsd * parsed.snapshot.tokenToShareRatio;
  const premiumBps = Math.round(((parsed.snapshot.tokenPriceUsd - referencePrice) / referencePrice) * 10_000);
  const attestationAgeSeconds = parsed.snapshot.attestationPublishedAt
    ? Math.max(0, nowSeconds - Math.floor(Date.parse(parsed.snapshot.attestationPublishedAt) / 1_000))
    : undefined;

  const checks: Record<string, boolean> = {
    mandateActive: parsed.mandate.expiresAt > nowSeconds,
    subjectMatches: parsed.mandate.subject.toUpperCase() === parsed.snapshot.underlying.toUpperCase(),
    platformAllowed: parsed.mandate.allowedPlatforms.includes(parsed.snapshot.platform),
    positionWithinLimit: parsed.positionUsd <= parsed.mandate.maxPositionUsd,
    premiumWithinLimit: Math.abs(premiumBps) <= parsed.mandate.maxPremiumBps,
    marketNotHalted: parsed.snapshot.marketStatus !== "HALTED",
    evidenceSufficient: parsed.rights.sourceStatus !== "UNVERIFIED",
    attestationFresh: attestationAgeSeconds !== undefined && attestationAgeSeconds <= parsed.mandate.maxAttestationAgeSeconds,
    exitLiquiditySufficient: parsed.snapshot.exitLiquidityUsd !== undefined && parsed.snapshot.exitLiquidityUsd >= parsed.mandate.minimumExitLiquidityUsd
  };

  for (const required of parsed.mandate.requiredRights) {
    if (required === "dividend") checks.rightDividend = !["NONE", "UNKNOWN"].includes(parsed.rights.dividendTreatment);
    if (required === "redemption") checks.rightRedemption = ["DIRECT", "RESTRICTED"].includes(parsed.rights.redemption);
    if (required === "one-to-one-backing") checks.rightOneToOne = parsed.rights.backingModel === "ONE_TO_ONE";
  }

  const reasons = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
  const hardBlockReasons = new Set(["mandateActive", "subjectMatches", "platformAllowed", "positionWithinLimit", "marketNotHalted", "evidenceSufficient"]);
  let state: "PROTECTED" | "WATCH" | "RESCUE_REQUIRED" | "BLOCKED" = "PROTECTED";
  if (reasons.some((reason) => hardBlockReasons.has(reason))) state = "BLOCKED";
  else if (reasons.length > 0) state = "RESCUE_REQUIRED";
  else if (Math.abs(premiumBps) >= parsed.mandate.maxPremiumBps * 0.8 || (parsed.snapshot.exitLiquidityUsd ?? 0) <= parsed.mandate.minimumExitLiquidityUsd * 1.2) state = "WATCH";

  const decision = {
    schema: "afterbell-watchtower-result/1",
    service: "AfterBell Watchtower",
    observedAt,
    positionId: parsed.positionId,
    state,
    reasons,
    checks,
    metrics: {
      premiumBps,
      normalizedReferencePriceUsd: referencePrice,
      exitLiquidityUsd: parsed.snapshot.exitLiquidityUsd ?? null,
      attestationAgeSeconds: attestationAgeSeconds ?? null
    },
    mode: parsed.snapshot.mode,
    financialTransactionCreated: false,
    signingRequested: false,
    truthNotice: "Deterministic continuity inspection. The service does not possess the buyer wallet, sign a rescue, or broadcast a transaction."
  } as const;

  return JSON.stringify({ ...decision, decisionHash: sha256(decision as unknown as Json) }, null, 2);
}

/**
 * Paid-runtime boundary: malformed buyer input must produce a deterministic,
 * fail-closed deliverable instead of crashing the background worker and
 * leaving a funded job stranded forever.
 */
export function inspectAfterBellWorkPrompt(prompt: string): string {
  try {
    return inspectAfterBellPosition(prompt);
  } catch (error) {
    const decision = {
      schema: "afterbell-watchtower-result/1",
      service: "AfterBell Watchtower",
      observedAt: new Date().toISOString(),
      positionId: "unresolved",
      state: "BLOCKED",
      reasons: ["invalidTaskPayload"],
      checks: { taskPayloadValid: false },
      metrics: {
        premiumBps: null,
        normalizedReferencePriceUsd: null,
        exitLiquidityUsd: null,
        attestationAgeSeconds: null
      },
      mode: "LIVE",
      financialTransactionCreated: false,
      signingRequested: false,
      errorClass: error instanceof Error ? error.name : "UnknownError",
      truthNotice: "The paid task was submitted on-chain, but its payload did not satisfy the WatchedPosition schema. AfterBell failed closed and performed no financial action."
    } as const;
    return JSON.stringify({ ...decision, decisionHash: sha256(decision as unknown as Json) }, null, 2);
  }
}
