import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { buildEconomicFingerprint, compareEconomicEquivalence } from "./equivalence.js";
import { evaluateContinuity } from "./policy.js";
import { buildPassport } from "./verifier.js";
import { sampleEconomic, sampleExecution, sampleMandate, sampleRights, sampleSnapshot } from "./sample.js";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const siteRoot = join(projectRoot, "site");
const port = Number(process.env.PORT ?? 4173);

const mime: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function json(response: import("node:http").ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(value, (_, item) => typeof item === "bigint" ? item.toString() : item, 2));
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
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
    return json(response, 200, {
      runId: `judge-${Date.now()}`,
      status: "COMPLETE",
      modes: ["SIMULATED", "ADVERSARIAL_TEST"],
      stages: [
        { id: "live-baseline", label: "Baseline continuity check", mode: "SIMULATED", result: safe.state, details: safe },
        { id: "premium-rescue", label: "Premium and liquidity violation", mode: "ADVERSARIAL_TEST", result: rescue.state, details: rescue },
        { id: "equivalence", label: "Economic equivalence", mode: "SIMULATED", result: equivalent.classification, details: equivalent },
        { id: "tamper", label: "Tampered calldata", mode: "ADVERSARIAL_TEST", result: tampered.verification.result, details: tampered }
      ]
    });
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

server.listen(port, "127.0.0.1", () => {
  console.log(`AfterBell Continuity running at http://127.0.0.1:${port}`);
});
