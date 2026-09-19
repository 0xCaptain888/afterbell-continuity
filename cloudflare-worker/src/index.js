const DEFAULT_EVIDENCE_BASE_URL = "https://0xcaptain888.github.io/afterbell-continuity";
const artifacts = {
  "live-evidence": "live-evidence.json",
  "mainnet-stock-swap": "evidence/mainnet-stock-swap.json",
  "paid-agent-delivery": "evidence/agent-studio-paid-delivery.json",
  "submission-readiness": "evidence/submission-readiness.json"
};

function responseJson(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,OPTIONS",
      "x-content-type-options": "nosniff"
    }
  });
}

async function sha256(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return `0x${[...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function semanticChecks(name, payload) {
  const data = payload?.payload ?? payload;
  if (name === "live-evidence") {
    return {
      schemaPresent: typeof data?.schema === "string",
      mainnetExecutionSucceeded: data?.mainnetExecution?.status === "SUCCESS",
      postSwapAllowanceZero: data?.mainnetExecution?.authorization?.postSwapAllowanceRaw === "0",
      contractsVerified: data?.deployment?.status === "MAINNET_DEPLOYED_VERIFIED",
      missingRightsFailClosed: data?.featured?.every?.((asset) => asset.automaticRescueAllowed === false) === true
    };
  }
  if (name === "mainnet-stock-swap") {
    return {
      receiptSucceeded: data?.verification?.receiptSucceeded === true,
      calldataMatched: data?.verification?.calldataMatchedPreparedTransaction === true,
      exactInputSpent: data?.verification?.exactInputSpent === true,
      allowanceConsumedToZero: data?.verification?.allowanceConsumedToZero === true
    };
  }
  if (name === "paid-agent-delivery") {
    return {
      replacementJobUsed: String(data?.job?.id ?? "") === "1265",
      settlementCompleted: data?.settlement?.completed === true || data?.job?.status === "COMPLETED",
      financialTransactionNotCreated: data?.deliverable?.financialTransactionCreated === false,
      signingNotRequested: data?.deliverable?.signingRequested === false
    };
  }
  return {
    technicallyReady: data?.status === "TECHNICALLY_READY",
    checksPresent: Number(data?.summary?.total ?? data?.checks?.length ?? 0) > 0
  };
}

async function verifyArtifact(name, baseUrl) {
  const relativePath = artifacts[name];
  if (!relativePath) return { name, result: "UNKNOWN_ARTIFACT" };
  const source = `${baseUrl.replace(/\/$/, "")}/${relativePath}`;
  const upstream = await fetch(source, { headers: { accept: "application/json" } });
  if (!upstream.ok) return { name, source, result: "UPSTREAM_ERROR", upstreamStatus: upstream.status };
  const raw = await upstream.text();
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return { name, source, result: "INVALID_JSON", transportDigest: await sha256(raw) };
  }
  const checks = semanticChecks(name, payload);
  return {
    name,
    source,
    result: Object.values(checks).every(Boolean) ? "PASS" : "FAIL_CLOSED",
    checkedAt: new Date().toISOString(),
    transportDigest: await sha256(raw),
    checks,
    truthNotice: "The edge verifier fetched the public artifact independently and recomputed a transport SHA-256 digest. Protocol evidence roots remain defined by the source artifact's canonical schema."
  };
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-methods": "GET,OPTIONS" } });
    if (request.method !== "GET") return responseJson({ error: "method_not_allowed" }, 405);
    const url = new URL(request.url);
    const baseUrl = env.EVIDENCE_BASE_URL || DEFAULT_EVIDENCE_BASE_URL;
    if (url.pathname === "/" || url.pathname === "/health") {
      return responseJson({ status: "ok", service: "afterbell-public-verifier", deploymentMode: "CLOUDFLARE_EDGE_READ_ONLY", evidenceBaseUrl: baseUrl, artifacts: Object.keys(artifacts) });
    }
    if (url.pathname === "/verify") {
      const results = await Promise.all(Object.keys(artifacts).map((name) => verifyArtifact(name, baseUrl)));
      return responseJson({ status: results.every((item) => item.result === "PASS") ? "PASS" : "FAIL_CLOSED", checkedAt: new Date().toISOString(), results });
    }
    const match = url.pathname.match(/^\/verify\/([^/]+)$/);
    if (match) {
      const result = await verifyArtifact(match[1], baseUrl);
      return responseJson(result, result.result === "UNKNOWN_ARTIFACT" ? 404 : 200);
    }
    return responseJson({ error: "not_found" }, 404);
  }
};
