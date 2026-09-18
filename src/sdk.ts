import type {
  AssetSnapshot,
  ContinuityCredential,
  ContinuityMandate,
  ContinuityPassport,
  ExecutionEvidence,
  PolicyDecision,
  RescuePlan,
  RightsFingerprint,
  SignedCredential,
  VerificationResult
} from "./types.js";

export class AfterBellApiError extends Error {
  constructor(readonly status: number, readonly payload: unknown) {
    super(`AfterBell API request failed with status ${status}`);
    this.name = "AfterBellApiError";
  }
}

export type AfterBellClientOptions = {
  baseUrl: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
};

export class AfterBellClient {
  private readonly baseUrl: string;
  private readonly requestFetch: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: AfterBellClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.requestFetch = options.fetch ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.requestFetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: { "Content-Type": "application/json", ...init?.headers },
        signal: controller.signal
      });
      const payload = await response.json() as unknown;
      if (!response.ok) throw new AfterBellApiError(response.status, payload);
      return payload as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  health() {
    return this.request<{ status: "ok"; service: string; mode: string; timestamp: string }>("/health");
  }

  checkContinuity(input: {
    snapshot: AssetSnapshot;
    rights: RightsFingerprint;
    mandate: ContinuityMandate;
    positionUsd: number;
    proposedTradeUsd?: number;
    proposedSlippageBps?: number;
    dailySpendUsd?: number;
  }) {
    return this.request<{ decision: PolicyDecision }>("/v1/continuity/check", {
      method: "POST",
      body: JSON.stringify(input)
    });
  }

  planRescue(input: {
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
  }) {
    return this.request<RescuePlan>("/v1/rescue/plan", { method: "POST", body: JSON.stringify(input) });
  }

  issueCredential(credential: ContinuityCredential) {
    return this.request<SignedCredential>("/v1/credentials/issue", {
      method: "POST",
      body: JSON.stringify(credential, (_, value) => typeof value === "bigint" ? value.toString() : value)
    });
  }

  verifyCredential(input: { signed: SignedCredential; expectedSigner?: `0x${string}`; nowSeconds?: number }) {
    return this.request<{ valid: boolean; reasons: string[]; digest: `0x${string}` }>("/v1/credentials/verify", {
      method: "POST",
      body: JSON.stringify(input, (_, value) => typeof value === "bigint" ? value.toString() : value)
    });
  }

  verifyExecution(execution: ExecutionEvidence) {
    return this.request<ContinuityPassport & { verification: VerificationResult }>("/v1/passports/verify", {
      method: "POST",
      body: JSON.stringify(execution)
    });
  }

  admitConsumer(input: {
    signedCredential: SignedCredential;
    passport: ContinuityPassport;
    trustedSigner: `0x${string}`;
    nowSeconds?: number;
    maximumRiskTier?: 0 | 1 | 2 | 3;
  }) {
    return this.request<import("./consumer.js").ConsumerAdmissionDecision>("/v1/consumers/admit", {
      method: "POST",
      body: JSON.stringify(input, (_, value) => typeof value === "bigint" ? value.toString() : value)
    });
  }
}

export * from "./types.js";
export * from "./consumer.js";
