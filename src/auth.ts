import { timingSafeEqual } from "node:crypto";

export function verifyBearerToken(authorization: string | undefined, expectedToken: string | undefined): boolean {
  if (!expectedToken) return true;
  if (!authorization?.startsWith("Bearer ")) return false;
  const received = Buffer.from(authorization.slice(7));
  const expected = Buffer.from(expectedToken);
  return received.length === expected.length && timingSafeEqual(received, expected);
}
