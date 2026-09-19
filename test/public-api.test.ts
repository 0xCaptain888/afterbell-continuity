import assert from "node:assert/strict";
import test from "node:test";
import { handlePublicApi } from "../src/public-api.js";
import { sampleMandate, sampleRights, sampleSnapshot } from "../src/sample.js";

test("public serverless health advertises a read-only boundary", async () => {
  const result = await handlePublicApi({ method: "GET", path: "/api/health" });
  assert.equal(result?.status, 200);
  const body = result?.body as { deploymentMode: string; disabledCapabilities: string[] };
  assert.equal(body.deploymentMode, "SERVERLESS_READ_ONLY");
  assert.ok(body.disabledCapabilities.includes("wallet-signing"));
});

test("public serverless Judge Run is reproducible and non-custodial", async () => {
  const result = await handlePublicApi({ method: "GET", path: "/api/v1/demo/judge" });
  assert.equal(result?.status, 200);
  const body = result?.body as { status: string; stages: unknown[]; truthNotice: string };
  assert.equal(body.status, "COMPLETE");
  assert.equal(body.stages.length, 6);
  assert.match(body.truthNotice, /No wallet signature/);
});

test("public watchtower evaluates stale evidence fail-closed without persisting or signing", async () => {
  const result = await handlePublicApi({
    method: "POST",
    path: "/api/v1/agent/watchtower",
    body: {
      positionId: "public-test",
      wallet: "0x1111111111111111111111111111111111111111",
      amount: 1,
      positionUsd: 21.34,
      snapshot: sampleSnapshot,
      rights: sampleRights,
      mandate: sampleMandate
    }
  });
  assert.equal(result?.status, 200);
  const body = result?.body as { deploymentMode: string; event: { state: string } };
  assert.equal(body.deploymentMode, "SERVERLESS_STATELESS");
  assert.equal(body.event.state, "RESCUE_REQUIRED");
});

test("serverless runtime refuses signing and persistent task capabilities", async () => {
  const signing = await handlePublicApi({ method: "POST", path: "/api/v1/credentials/issue", body: {} });
  const tasks = await handlePublicApi({ method: "POST", path: "/api/v1/watch/tasks", body: {} });
  assert.equal(signing?.status, 501);
  assert.equal(tasks?.status, 501);
});
