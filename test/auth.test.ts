import assert from "node:assert/strict";
import test from "node:test";
import { verifyBearerToken } from "../src/auth.js";

test("write API bearer token fails closed when configured", () => {
  assert.equal(verifyBearerToken(undefined, undefined), true);
  assert.equal(verifyBearerToken(undefined, "secret"), false);
  assert.equal(verifyBearerToken("Basic secret", "secret"), false);
  assert.equal(verifyBearerToken("Bearer wrong", "secret"), false);
  assert.equal(verifyBearerToken("Bearer secret", "secret"), true);
});
