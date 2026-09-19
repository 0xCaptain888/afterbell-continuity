import type { IncomingMessage, ServerResponse } from "node:http";
import { handlePublicApi } from "../src/public-api.js";

const maxBodyBytes = 1_000_000;

async function readBody(request: IncomingMessage): Promise<unknown> {
  if (request.method === "GET" || request.method === "HEAD") return undefined;
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const value = Buffer.from(chunk);
    size += value.length;
    if (size > maxBodyBytes) throw new Error("request_body_too_large");
    chunks.push(value);
  }
  if (chunks.length === 0) return undefined;
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

function writeJson(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(JSON.stringify(body, (_, value) => typeof value === "bigint" ? value.toString() : value, 2));
}

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
    });
    return response.end();
  }
  try {
    const host = request.headers.host ?? "localhost";
    const url = new URL(request.url ?? "/api/health", `https://${host}`);
    const rewrittenPath = url.searchParams.get("path");
    const path = rewrittenPath ? `/api/${rewrittenPath.replace(/^\/+/, "")}` : url.pathname;
    const result = await handlePublicApi({ method: request.method ?? "GET", path, body: await readBody(request) });
    if (!result) return writeJson(response, 404, { error: "not_found" });
    return writeJson(response, result.status, result.body);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return writeJson(response, message === "request_body_too_large" ? 413 : 400, { error: message });
  }
}
