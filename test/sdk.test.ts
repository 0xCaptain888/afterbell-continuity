import assert from "node:assert/strict";
import test from "node:test";
import { AfterBellApiError, AfterBellClient } from "../src/sdk.js";

test("SDK normalizes base URL and posts JSON", async () => {
  let url = "";
  let body = "";
  const client = new AfterBellClient({
    baseUrl: "https://afterbell.example/api/",
    fetch: async (input, init) => {
      url = String(input);
      body = String(init?.body);
      return new Response(JSON.stringify({ decision: { state: "PROTECTED" } }), { status: 200 });
    }
  });
  const result = await client.checkContinuity({ snapshot: {} as never, rights: {} as never, mandate: {} as never, positionUsd: 10 });
  assert.equal(url, "https://afterbell.example/api/v1/continuity/check");
  assert.equal(JSON.parse(body).positionUsd, 10);
  assert.equal(result.decision.state, "PROTECTED");
});

test("SDK exposes structured API failures", async () => {
  const client = new AfterBellClient({
    baseUrl: "https://afterbell.example/api",
    fetch: async () => new Response(JSON.stringify({ error: "blocked" }), { status: 422 })
  });
  await assert.rejects(() => client.health(), (error) => error instanceof AfterBellApiError && error.status === 422);
});
