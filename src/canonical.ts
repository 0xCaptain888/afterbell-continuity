import { createHash } from "node:crypto";
import type { Hex } from "./types.js";

export function stableJson(value: unknown): string {
  if (typeof value === "bigint") return JSON.stringify(value.toString());
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`)
    .join(",")}}`;
}

export function sha256(value: unknown): Hex {
  return `0x${createHash("sha256").update(typeof value === "string" ? value : stableJson(value)).digest("hex")}`;
}

export function ageSeconds(iso: string | undefined, nowSeconds: number): number | undefined {
  if (!iso) return undefined;
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.max(0, nowSeconds - Math.floor(parsed / 1000));
}

export function basisPointsDelta(actual: number, reference: number): number {
  if (!Number.isFinite(actual) || !Number.isFinite(reference) || reference <= 0) return Number.POSITIVE_INFINITY;
  return Math.round(((actual - reference) / reference) * 10_000);
}

export function absoluteSlippageBps(expected: string, realized: string): number {
  const expectedValue = Number(expected);
  const realizedValue = Number(realized);
  if (!Number.isFinite(expectedValue) || expectedValue <= 0 || !Number.isFinite(realizedValue)) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.round(Math.abs(expectedValue - realizedValue) / expectedValue * 10_000);
}
