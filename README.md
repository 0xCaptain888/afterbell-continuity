# AfterBell Continuity

[![Live Demo](https://img.shields.io/badge/Live_Demo-Open-8fffc1?style=for-the-badge)](https://0xcaptain888.github.io/afterbell-continuity/)
[![CI](https://github.com/0xCaptain888/afterbell-continuity/actions/workflows/ci.yml/badge.svg)](https://github.com/0xCaptain888/afterbell-continuity/actions/workflows/ci.yml)
[![Pages](https://github.com/0xCaptain888/afterbell-continuity/actions/workflows/pages.yml/badge.svg)](https://github.com/0xCaptain888/afterbell-continuity/actions/workflows/pages.yml)

> **Own the exposure. Preserve the rights. Verify every rescue.**

AfterBell Continuity is the economic-equivalence, rights-continuity, and verifiable-rescue layer for tokenized stocks on BNB Chain.

## Demo

- Local control center: `npm run dev` → `http://127.0.0.1:4173`
- One-click evidence run: `npm run judge`
- Full verification: `npm run check`
- Public demo: **https://0xcaptain888.github.io/afterbell-continuity/**
- Browser verifier: open **Live proof → Verify evidence roots** to recompute seven canonical SHA-256 commitments without a wallet
- BSC mainnet evidence: [verified 10 USDT → TSLAB transaction](https://bscscan.com/tx/0xb4f2bd0cd1383ec16ca72d61fe353ed81eb8f2843f038f5e11bf7ecd22ef431c)
- Public continuity artifacts: [`LIVE` EIP-712 Credential](./evidence/live/mainnet-credential.json) and [`CHALLENGED` Passport](./evidence/live/mainnet-passport.json)

The current `v0.1.0` baseline combines clearly labelled `SIMULATED` / `ADVERSARIAL_TEST` scenarios, authenticated `LIVE` BNB Chain evidence, and one user-confirmed BSC mainnet stock-token swap. It does **not** claim Agentic Wallet custody, Agent Studio deployment, verified protocol-contract deployment, or automated rescue settlement.

## Why this exists

Tokenized shares of the same company can differ in share ratio, reference basis, backing, dividend treatment, corporate-action handling, redemption, liquidity, and jurisdictional restrictions. A trading agent that compares ticker symbols or nominal token prices can manufacture false arbitrage or migrate a user into a materially different instrument.

AfterBell treats the user's economic exposure and rights as the primary object:

```text
observe the position
→ normalize economic exposure
→ fingerprint rights and backing
→ apply the owner's continuity mandate
→ prepare a bounded rescue
→ simulate before signing
→ execute on BSC mainnet
→ independently verify the outcome
→ issue a short-lived credential and passport
```

## What is implemented

- Economic fingerprint generation
- Cross-wrapper equivalence classification
- Versioned rights fingerprint
- Deterministic continuity mandate engine
- Fail-closed missing-evidence behavior
- Policy-bound rescue-plan model
- EIP-712 continuity credential signing and verification
- Independent execution verifier
- Continuity passport generation
- Binance Web3 RWA API signed client
- Live inventory parser and deterministic candidate ranking
- Live underlying-profile, market-status, and disclosure discovery
- Conservative rights assessment that refuses to infer backing, dividends, splits, voting, or redemption
- Bidirectional USDT → stock → USDT quote discovery and per-share executable-price normalization
- Live economic-equivalence report that separates price equivalence from rights equivalence
- Quote → swap-build → Transaction API simulation gate with RFQ handling
- Hash-linked evidence artifacts and tamper verification
- Independent in-browser verifier for rights, quote, equivalence, mainnet execution, Credential, and Passport roots
- A short-lived EIP-712 Credential signed by a dedicated non-custodial AfterBell issuer and bound to the live rights, equivalence, and mainnet-swap evidence roots
- A public Continuity Passport that passes simulation, binding, slippage, and transaction checks while honestly challenging unprovable quote-submission freshness
- A standalone Guarded Consumer that owns its issuer trust list, recomputes the Credential/Passport admission decision, and exposes `ALLOW_AUTOMATION`, `REQUIRE_MANUAL_REVIEW`, or `DENY`
- OKX Wallet EIP-1193 connection with funded-address enforcement, exact 10 USDT approval, post-broadcast calldata verification, on-chain allowance re-read, and emergency revoke
- Publishable TypeScript SDK with structured errors and timeouts
- Persistent Watchtower task journal and Agent service endpoint
- Reproducible Judge Run
- Responsive control-center demo
- `ContinuityRegistry`, `GuardedStockVault`, and `ExecutionBondEscrow` contracts
- Solidity compilation in CI
- Initial threat model, DX log, API specification, and prior-work disclosure
- A concise [`Judge guide`](./docs/JUDGE-GUIDE.md) with 90-second and four-minute paths

## Current status

| Capability | Status | Evidence |
|---|---|---|
| Core continuity engine | `IMPLEMENTED` | 27 TypeScript tests |
| EIP-712 credential | `IMPLEMENTED` | Credential tests |
| Independent verifier | `IMPLEMENTED` | PASS and CHALLENGE tests |
| Contracts | `IMPLEMENTED / UNDEPLOYED` | Solidity compilation |
| UI and Judge Run | `IMPLEMENTED` | Local/static demo |
| TypeScript SDK | `IMPLEMENTED` | package dry build and SDK tests |
| Persistent Watchtower tasks | `IMPLEMENTED` | JSONL journal and local API smoke test |
| Agent Studio service package | `DESIGN / UNPUBLISHED` | `agent-studio/` and local endpoint |
| Binance RWA inventory | `LIVE` | 488 parsed assets, 40 cross-wrapper pairs |
| Underlying + market profiles | `LIVE` | 4/4 TSLA/NVDA wrapper profiles |
| Rights-continuity evidence | `LIVE_PARTIAL / FAIL_CLOSED` | disclosures found; material holder rights remain `UNKNOWN` |
| Trading API round trips | `LIVE_PARTIAL` | 3/4 USDT → stock → USDT routes; TSLAon returned an explicit liquidity blocker |
| Executable price equivalence | `LIVE_PARTIAL` | NVDA buy/exit spread 0/1 bps; TSLA remains unproven while one wrapper has no executable quote |
| Automatic cross-wrapper rescue | `BLOCKED` | price similarity cannot substitute for complete rights evidence |
| Swap calldata build | `LIVE` | TSLAB route, LiquidMesh |
| Transaction API simulation | `LIVE_PASS` | exact 10 USDT allowance; simulation spends 10 USDT, receives TSLAB, and reduces allowance to zero |
| Funded OKX Wallet authorization | `LIVE` | connected, first anomalous approval revoked, exact 10 USDT allowance independently re-read on-chain |
| Agent Studio Watchtower | `NOT_STARTED` | — |
| BSC mainnet contracts | `NOT_DEPLOYED` | — |
| BSC mainnet stock trade | `LIVE_SUCCESS` | 10 USDT → 0.027163579421480873 TSLAB; calldata, receipt, slippage, Gas, and zero post-swap allowance independently verified |
| Live continuity credential | `LIVE / WATCH` | EIP-712 issuer signature valid at issuance; seven-day validity; incomplete shareholder-rights data remains explicit |
| Live continuity passport | `CHALLENGED` | 5/6 deterministic checks pass; quote submission time was not independently timestamped, so freshness is not inferred from block confirmation |
| Independent Guarded Consumer | `LIVE / REQUIRE_MANUAL_REVIEW` | Explicit issuer trust list; automated rescue and deposits blocked; read-only monitoring allowed |

## Quick start

Requirements:

- Node.js 20.18+
- npm 10+

```bash
npm install
npm run check
npm run dev
```

Open `http://127.0.0.1:4173`.

## Live RWA data gate

Create `.env` from `.env.example`, then configure approved Binance Web3 API credentials locally:

```bash
npm run credentials:binance
npm run data:gate
```

The credential command hides both inputs, writes the Git-ignored `.env` with `0600` permissions, and never prints the values.

If direct access to Binance is blocked, set `HTTPS_PROXY` and `HTTP_PROXY` in `.env`. The data and trading gates enable Node's environment-proxy support automatically.

Successful output is written to `evidence/live/rwa-inventory.json`. Secrets are never written to evidence or committed.

Then rank technically suitable demo assets and run the non-broadcast quote/simulation gate:

```bash
npm run assets:rank
npm run rights:discover
npm run quote:discover
npm run equivalence:live
npm run site:evidence
npm run trade:gate
npm run trade:prepare
npm run credentials:issuer
npm run passport:publish
npm run consumer:verify
```

`rights:discover` records authenticated profile, market-status, and disclosure coverage while keeping unreturned holder rights `UNKNOWN`. `quote:discover` probes both buy and exit routes for each wrapper without building or signing a transaction. `equivalence:live` combines inventory ratios, executable per-share prices, exit quotes, and rights evidence; it blocks automatic rescue when rights are incomplete. `trade:gate` never signs or broadcasts; it records either a simulated EVM transaction, an explicit RFQ-signature requirement, or a fail-closed blocker. `trade:prepare` additionally verifies the exact allowance, estimates BSC gas, calculates the minimum output under the configured slippage cap, and writes full short-lived calldata only to Git-ignored `.runtime/prepared-live-swap.json`. It still does not sign or broadcast.

## Latest authenticated evidence — September 18, 2026

| Underlying | Wrappers | Executable buy spread | Executable exit spread | Decision |
|---|---|---:|---:|---|
| TSLA | TSLAB / TSLAon | unavailable | unavailable | one wrapper lacked executable liquidity; equivalence unproven; auto-rescue blocked |
| NVDA | NVDAB / NVDAon | 0 bps | 1 bps | price-equivalent; rights `UNKNOWN`; auto-rescue blocked |

Three of four routes returned authenticated Trading API quotes for a 10 USDT probe and its immediate quoted exit. TSLAon returned an explicit insufficient-liquidity result, which remains visible instead of being replaced by fixture data. The funded public wallet produced real TSLAB calldata; after an anomalous oversized approval was detected and revoked, an exact 10 USDT allowance was independently confirmed on-chain. Transaction API simulation passed, then the user confirmed one bounded BSC mainnet swap. The verified receipt spent exactly 10 USDT, received 0.027163579421480873 TSLAB, stayed inside the 0.5% slippage boundary, consumed the allowance to zero, and paid 0.000030178641994006 BNB in Gas. See the [BscScan transaction](https://bscscan.com/tx/0xb4f2bd0cd1383ec16ca72d61fe353ed81eb8f2843f038f5e11bf7ecd22ef431c) and [`evidence/live/mainnet-stock-swap.json`](./evidence/live/mainnet-stock-swap.json).

The same evidence chain now feeds a public EIP-712 Credential and Continuity Passport. The Credential is signed by a dedicated AfterBell off-chain issuer—not the user's wallet—and is valid from September 18 through September 25, 2026. Its `WATCH / HIGH` semantics reflect incomplete machine-readable shareholder rights; the zero registry address explicitly avoids implying a deployed registry contract. The Passport passes simulation, simulation binding, calldata binding, slippage, and transaction-presence checks. It remains `CHALLENGED` only because the public record has a quote creation time and block confirmation time, but no independently timestamped broadcast event. The wallet UI enforced quote expiry, yet AfterBell refuses to convert that client-side fact into cryptographic timing proof.

The standalone Guarded Consumer consumes those public artifacts without trusting the AfterBell dashboard. It starts from its own [`trusted-issuers.json`](./site/trusted-issuers.json), recovers the signer, checks Credential validity and risk tier, recomputes the Passport, and verifies the Credential digest is bound to the execution. For the current live bundle it returns `REQUIRE_MANUAL_REVIEW`: read-only monitoring is allowed, while automated rescue and Guarded Vault deposits remain blocked. See [`guarded-consumer-admission.json`](./evidence/live/guarded-consumer-admission.json).

For any hosted API, configure `AFTERBELL_API_TOKEN` and send it as a bearer token. The server refuses a non-loopback bind without this protection.

## SDK

The repository is structured as an installable TypeScript package, not only a UI:

```ts
import { AfterBellClient } from "afterbell-continuity";

const afterbell = new AfterBellClient({ baseUrl: "https://example.com/api" });
const result = await afterbell.checkContinuity({
  snapshot,
  rights,
  mandate,
  positionUsd
});

const admission = await afterbell.admitConsumer({
  signedCredential,
  passport,
  trustedSigner,
  maximumRiskTier: 1
});

if (admission.result !== "ALLOW_AUTOMATION") {
  // Never request a wallet signature or Vault deposit.
}
```

Build and inspect the package without publishing it:

```bash
npm run build
npm pack --dry-run --cache .runtime/npm-cache
```

## Safe BSC deployment

Generate an auditable bytecode commitment without using a wallet:

```bash
npm run contracts:plan
```

The real deployment script is intentionally guarded. It refuses to run unless the RPC, deployer key, signer address, and exact `DEPLOY_CONFIRM=BSC_MAINNET` acknowledgement are all configured locally. A deployment receipt is still labelled unverified until BscScan verification succeeds.

## Safety invariants

1. No simulation means no signature.
2. An expired quote cannot be broadcast.
3. An expired credential cannot authorize a deposit.
4. Missing evidence never becomes `SAFE`.
5. Non-equivalent stock representations cannot auto-migrate.
6. A trade outside the mandate cannot request a signature.
7. Executed calldata must match the committed calldata hash.
8. A single intent cannot be executed twice.
9. Verifier failure must fail closed.
10. An LLM cannot override deterministic policy.

## Architecture

```text
Binance RWA / Market / Trading / Transaction APIs
                         │
                         ▼
         Economic Equivalence + Rights Engine
                         │
                         ▼
               Continuity Mandate Engine
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
          BLOCKED             Rescue Planner
                                      │
                                      ▼
                           Agentic Wallet Policy
                                      │
                                      ▼
                              BSC Mainnet Trade
                                      │
                                      ▼
                              Open Verifier
                                      │
                         ┌────────────┴───────────┐
                         ▼                        ▼
              Continuity Passport     Continuity Credential
                                                  │
                                                  ▼
                                      Consumer Admission Policy
                                                  │
                                                  ▼
                                      Guarded Wallet / Vault
```

## Repository layout

```text
contracts/   BSC contracts
src/         core engine, API client, server, verifier
scripts/     judge, live gates, asset ranking, deployment safety
agent-studio/ service packaging boundary and honest deployment status
site/        judge-facing control center
test/        deterministic and adversarial tests
benchmark/   reproducible baseline-vs-AfterBell scenarios
evidence/    public evidence artifacts
docs/        architecture, security, DX, development plan
```

## Public API surface

Planned stable endpoints are documented in [`openapi.yaml`](./openapi.yaml):

```text
POST /v1/continuity/check
POST /v1/rescue/plan
POST /v1/credentials/issue
POST /v1/credentials/verify
GET  /v1/passports/{id}
POST /v1/passports/verify
POST /v1/consumers/admit
GET  /v1/watch/tasks
POST /v1/watch/tasks
POST /v1/watch/tasks/{id}/inspect
POST /v1/agent/watchtower
```

## Mainnet definition of done

- [x] Select genuinely quoted BSC stock-token pairs (TSLA and NVDA across bStock/Ondo)
- [x] Record live RWA, underlying, market-status, and disclosure evidence; unresolved rights remain explicit
- [x] Obtain real bidirectional quote and exit-liquidity measurements
- [x] Simulate with Transaction API
- [ ] Enforce Agentic Wallet limits
- [ ] Deploy and verify contracts on BscScan
- [x] Execute one small BSC mainnet stock transaction
- [x] Re-verify calldata, output, slippage, and receipt independently
- [x] Publish transaction link and evidence root
- [x] Publish Passport and Credential
- [x] Integrate one independent Guarded Wallet / Vault consumer policy

## Prior work

This is a new hackathon repository and product. General policy-gating, canonical hashing, evidence-receipt, and bond ideas were explored in earlier projects owned by the same builder. AfterBell's tokenized-stock equivalence engine, rights-continuity model, mandate schema, credential, Guarded Vault, and benchmark are new work for this event. See [`docs/PRIOR_WORK.md`](./docs/PRIOR_WORK.md).

## Disclaimer

AfterBell is experimental software for a hackathon. It is not a broker, custodian, investment adviser, insurer, or legal determination of shareholder rights. A credential reports evidence and deterministic policy results; it does not guarantee issuer solvency, market liquidity, regulatory eligibility, or investment performance.
