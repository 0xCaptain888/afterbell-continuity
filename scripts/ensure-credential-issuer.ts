import { randomBytes } from "node:crypto";
import { chmod, readFile, writeFile } from "node:fs/promises";
import { privateKeyToAccount } from "viem/accounts";
import type { Hex } from "../src/types.js";

const envPath = ".env";
let existing = "";
try {
  existing = await readFile(envPath, "utf8");
} catch {
  // The issuer bootstrap is also allowed to create a new ignored .env file.
}

const configured = existing.match(/^CREDENTIAL_SIGNER_PRIVATE_KEY=(0x[0-9a-fA-F]{64})$/m)?.[1] as Hex | undefined;
let privateKey = configured;
let account;

if (privateKey) {
  account = privateKeyToAccount(privateKey);
} else {
  do {
    privateKey = `0x${randomBytes(32).toString("hex")}` as Hex;
    try {
      account = privateKeyToAccount(privateKey);
    } catch {
      account = undefined;
    }
  } while (!account);

  const normalized = existing.replace(/^CREDENTIAL_SIGNER_PRIVATE_KEY=.*(?:\r?\n|$)/gm, "").replace(/\s*$/, "");
  const next = `${normalized}${normalized ? "\n" : ""}CREDENTIAL_SIGNER_PRIVATE_KEY=${privateKey}\n`;
  await writeFile(envPath, next, { mode: 0o600 });
  await chmod(envPath, 0o600);
}

console.log(JSON.stringify({
  status: configured ? "ISSUER_ALREADY_CONFIGURED" : "ISSUER_CREATED",
  role: "AFTERBELL_OFFCHAIN_CREDENTIAL_ISSUER",
  address: account.address,
  privateKeyPrinted: false,
  envIgnored: true
}, null, 2));
