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
- Submission readiness: `npm run submission:audit`
- Public demo: **https://0xcaptain888.github.io/afterbell-continuity/**
- Browser verifier: open **Live proof → Verify evidence roots** to recompute nine canonical SHA-256 commitments without a wallet
- BSC mainnet evidence: [verified 10 USDT → TSLAB transaction](https://bscscan.com/tx/0xb4f2bd0cd1383ec16ca72d61fe353ed81eb8f2843f038f5e11bf7ecd22ef431c)
- Source-verified contracts: [Registry](https://bscscan.com/address/0xCb158746e0855ECeC2703CE20EC3aA780c0C823A#code) · [Guarded Vault](https://bscscan.com/address/0x8f996AFcb61eaa3FCc6BCe21B691240e6eACE1bD#code) · [Bond Escrow](https://bscscan.com/address/0x52B6FF2243c3366E14aC13C6490A48580dE12029#code)
- Deployment evidence: [`MAINNET_DEPLOYED_VERIFIED`](./evidence/deployment/bsc-mainnet.json)
- Public continuity artifacts: [`LIVE` EIP-712 Credential](./evidence/live/mainnet-credential.json) and [`CHALLENGED` Passport](./evidence/live/mainnet-passport.json)
- Machine-readable readiness: [`TECHNICALLY_READY`](./evidence/submission-readiness.json)
- Official BNB Agent Studio package: [`DEPLOYED_TESTNET_TRIAL / RUNNING_READY`](./evidence/agent-studio-package.json)
- Public Agent Card: [AfterBell Watchtower on BNB Agent Studio](https://bnbagent-api.bnbchain.world/v1/rt/01M2T4KMDTJCBQ25HAMPZ9JZ9D/.well-known/agent-card.json)
- Managed deployment evidence: [`DEPLOYED_TESTNET_TRIAL`](./evidence/live/agent-studio-deployment.json) — Agent `01M2…Z9D`, Deployment `01M2…JRNX`, ERC-8004 ID `2447`
- Authenticated public quote: [`PUBLIC_NEGOTIATION_VERIFIED`](./evidence/live/agent-studio-public-negotiate.json) — OAuth A2A call, `0.01 U`, signature recovered to the deployed testnet wallet
- Independent paid delivery: [`PAID_DELIVERY_SUBMITTED_AWAITING_SETTLEMENT`](./evidence/live/agent-studio-paid-delivery.json) — buyer `0x2CB7…1Afa`, Job `1254`, `0.01 U`, content-addressed `PROTECTED` result; buyer approval becomes eligible September 19, 2026 at 20:07:31 Beijing time

The current `v0.1.0` baseline combines clearly labelled `SIMULATED` / `ADVERSARIAL_TEST` scenarios, authenticated `LIVE` BNB Chain evidence, one user-confirmed BSC mainnet stock-token swap, three source-verified mainnet contracts, a Registry-bound Credential, a live BSC Testnet BNB Agent Studio trial, and one independently funded ERC-8183 delivery. It does **not** claim Agentic Wallet custody, final ERC-8183 buyer settlement, B402 settlement, or automated rescue settlement. The historical zero-address Credential remains preserved beside its active Registry-bound successor.

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
- Official BNB Agent Studio seller workspace with A2A + X402 faces, ERC-8183 + B402 rails, fixed pricing, and deterministic non-LLM delivery
- Managed BNB Agent Studio trial runtime with ERC-8004 identity, OAuth-protected public A2A access, and independently verified provider signature
- Independent-buyer ERC-8183 lifecycle through quote, create, register, budget, `0.01 U` funding, notify, deterministic delivery, content-addressed result, and on-chain submission; final approval remains subject to the canonical dispute window
- Reproducible Judge Run
- Responsive control-center demo
- `ContinuityRegistry`, `GuardedStockVault`, and `ExecutionBondEscrow` contracts
- BSC mainnet deployment with exact constructor-calldata, runtime-bytecode, relationship, owner, issuer-trust, and BscScan source verification
- Solidity compilation in CI
- Initial threat model, DX log, API specification, and prior-work disclosure
- A concise [`Judge guide`](./docs/JUDGE-GUIDE.md) with 90-second and four-minute paths
- A machine-verifiable [`Submission readiness`](./evidence/submission-readiness.json) artifact with fourteen fail-closed checks
- A timestamped [`four-minute demo script`](./docs/VIDEO-SCRIPT.md) aligned to the public proof path

## Current status

| Capability | Status | Evidence |
|---|---|---|
| Core continuity engine | `IMPLEMENTED` | 27 TypeScript tests |
| EIP-712 credential | `IMPLEMENTED` | Credential tests |
| Independent verifier | `IMPLEMENTED` | PASS and CHALLENGE tests |
| Contracts | `MAINNET_DEPLOYED_VERIFIED` | Three successful receipts, independent RPC verification, BscScan Standard JSON source verification |
| UI and Judge Run | `IMPLEMENTED` | Local/static demo |
| TypeScript SDK | `IMPLEMENTED` | package dry build and SDK tests |
| Persistent Watchtower tasks | `IMPLEMENTED` | JSONL journal and local API smoke test |
| BNB Agent Studio service package | `DEPLOYED_TESTNET_TRIAL / RUNNING_READY` | official `bag` scaffold, A2A/X402, ERC-8183/B402, fixed 0.01 pricing, 8/8 deterministic tests, public OAuth quote |
| Binance RWA inventory | `LIVE` | 488 parsed assets, 40 cross-wrapper pairs |
| Underlying + market profiles | `LIVE` | 4/4 TSLA/NVDA wrapper profiles |
| Rights-continuity evidence | `LIVE_PARTIAL / FAIL_CLOSED` | disclosures found; material holder rights remain `UNKNOWN` |
| Trading API round trips | `LIVE_PARTIAL` | 3/4 USDT → stock → USDT routes; TSLAon returned an explicit liquidity blocker |
| Executable price equivalence | `LIVE_PARTIAL` | NVDA buy/exit spread 0/1 bps; TSLA remains unproven while one wrapper has no executable quote |
| Automatic cross-wrapper rescue | `BLOCKED` | price similarity cannot substitute for complete rights evidence |
| Swap calldata build | `LIVE` | TSLAB route, LiquidMesh |
| Transaction API simulation | `LIVE_PASS` | exact 10 USDT allowance; simulation spends 10 USDT, receives TSLAB, and reduces allowance to zero |
| Funded OKX Wallet authorization | `LIVE` | connected, first anomalous approval revoked, exact 10 USDT allowance independently re-read on-chain |
| BNB Agent Studio Watchtower | `PAID_DELIVERY_SUBMITTED_AWAITING_SETTLEMENT` | runtime `running (ready)`, ERC-8004 ID `2447`; independent buyer funded Job `1254` with `0.01 U`, Agent submitted `PROTECTED`; buyer approval is eligible after the 24-hour dispute window, while B402 remains dormant |
| BSC mainnet contracts | `MAINNET_DEPLOYED_VERIFIED` | Registry `0xCb1587…C823A`, Vault `0x8f996A…CE1bD`, Bond `0x52B6FF…12029` |
| BSC mainnet stock trade | `LIVE_SUCCESS` | 10 USDT → 0.027163579421480873 TSLAB; calldata, receipt, slippage, Gas, and zero post-swap allowance independently verified |
| Live continuity credential | `LIVE / WATCH / REGISTRY_BOUND` | Issuer-signed Credential binds the deployed Registry and deployment evidence root; historical zero-address artifact preserved |
| Live continuity passport | `CHALLENGED` | 5/6 deterministic checks pass; quote submission time was not independently timestamped, so freshness is not inferred from block confirmation |
| Independent Guarded Consumer | `LIVE / REQUIRE_MANUAL_REVIEW` | Explicit issuer trust list; automated rescue and deposits blocked; read-only monitoring allowed |
| Submission readiness | `TECHNICALLY_READY` | 14/14 repository, mainnet, integration, paid-agent, truth-label, and public-secret checks pass |

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

The same evidence chain feeds a public EIP-712 Credential and Continuity Passport. The Credential is signed by a dedicated AfterBell off-chain issuer—not the user's wallet—and its `WATCH / HIGH` semantics reflect incomplete machine-readable shareholder rights. The originally published zero-address Credential remains available as historical evidence; its active successor is bound to the deployed Registry and the publisher refuses future issuance unless it can verify the deployment evidence root, trusted issuer, real Registry address, and all three source-verification records. The Passport passes simulation, simulation binding, calldata binding, slippage, and transaction-presence checks. It remains `CHALLENGED` only because the public record has a quote creation time and block confirmation time, but no independently timestamped broadcast event. The wallet UI enforced quote expiry, yet AfterBell refuses to convert that client-side fact into cryptographic timing proof.

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
npm run contracts:browser:prepare
```

The generated plan reads the public live Credential and commits its exact issuer address as the `ContinuityRegistry` constructor argument. `contracts:browser:prepare` builds a Git-ignored, localhost-only OKX Wallet console that pins chain `56`, the expected deployer, constructor values, compiler settings, and bytecode hashes. It adds a 20% buffer to the RPC Gas estimate, requires three separate confirmations, verifies runtime bytecode and contract relationships after every receipt, and exports a receipt bundle.

Place the downloaded receipt at `.runtime/deployment/browser-result.json`, then independently verify receipts, exact creation calldata, runtime code, owner, issuer trust, and Registry pointers:

```bash
npm run contracts:browser:verify
```

All three contracts are now `MAINNET_DEPLOYED_VERIFIED` and link to matching Standard JSON sources on BscScan. `npm run passport:publish` now fails closed unless it can bind a fresh Credential to the verified Registry and archive the historical zero-address evidence first. See the complete [`BSC deployment runbook`](./docs/BSC-DEPLOYMENT.md).

The final local signing and publication pipeline is intentionally one explicit command:

```bash
npm run mainnet:finalize
```

It uses the Git-ignored dedicated Credential issuer already stored in `.env`, never prints the key, archives the zero-address artifacts, issues the Registry-bound Credential, recomputes the Passport and Guarded Consumer decision, refreshes the public evidence bundle, and verifies every canonical root.

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
bnb-agent/   official BNB Agent Studio A2A/X402 seller workspace
site/        judge-facing control center
test/        deterministic and adversarial tests
benchmark/   reproducible baseline-vs-AfterBell scenarios
evidence/    public evidence artifacts
docs/        architecture, security, DX, development plan
```

## Public API surface

The implemented integration endpoints are documented in [`openapi.yaml`](./openapi.yaml):

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
- [x] Enforce exact browser-wallet spending limits and zero post-swap allowance (no Agentic Wallet custody claim)
- [x] Deploy and verify contracts on BscScan
- [x] Execute one small BSC mainnet stock transaction
- [x] Re-verify calldata, output, slippage, and receipt independently
- [x] Publish transaction link and evidence root
- [x] Publish Passport and Credential
- [x] Integrate one independent Guarded Wallet / Vault consumer policy

## Prior work

This is a new hackathon repository and product. General policy-gating, canonical hashing, evidence-receipt, and bond ideas were explored in earlier projects owned by the same builder. AfterBell's tokenized-stock equivalence engine, rights-continuity model, mandate schema, credential, Guarded Vault, and benchmark are new work for this event. See [`docs/PRIOR_WORK.md`](./docs/PRIOR_WORK.md).

## Disclaimer

AfterBell is experimental software for a hackathon. It is not a broker, custodian, investment adviser, insurer, or legal determination of shareholder rights. A credential reports evidence and deterministic policy results; it does not guarantee issuer solvency, market liquidity, regulatory eligibility, or investment performance.
