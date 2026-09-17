# AfterBell Continuity

> **Own the exposure. Preserve the rights. Verify every rescue.**

AfterBell Continuity is the economic-equivalence, rights-continuity, and verifiable-rescue layer for tokenized stocks on BNB Chain.

## Demo

- Local control center: `npm run dev` → `http://127.0.0.1:4173`
- One-click evidence run: `npm run judge`
- Full verification: `npm run check`
- Public demo: **not deployed yet**
- BSC mainnet evidence: **not created yet**

The current `v0.1.0` baseline uses clearly labelled `SIMULATED` and `ADVERSARIAL_TEST` evidence. It does **not** claim a live stock trade, Agentic Wallet authorization, Agent Studio deployment, or BSC mainnet settlement.

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
- Reproducible Judge Run
- Responsive control-center demo
- `ContinuityRegistry`, `GuardedStockVault`, and `ExecutionBondEscrow` contracts
- Solidity compilation in CI
- Initial threat model, DX log, API specification, and prior-work disclosure

## Current status

| Capability | Status | Evidence |
|---|---|---|
| Core continuity engine | `IMPLEMENTED` | TypeScript tests |
| EIP-712 credential | `IMPLEMENTED` | Credential tests |
| Independent verifier | `IMPLEMENTED` | PASS and CHALLENGE tests |
| Contracts | `IMPLEMENTED / UNDEPLOYED` | Solidity compilation |
| UI and Judge Run | `IMPLEMENTED` | Local/static demo |
| Binance RWA inventory | `BLOCKED_BY_CREDENTIALS` | `npm run data:gate` |
| Trading API quote | `NOT_STARTED` | — |
| Transaction API simulation | `NOT_STARTED` | — |
| Agentic Wallet authorization | `NOT_STARTED` | — |
| Agent Studio Watchtower | `NOT_STARTED` | — |
| BSC mainnet contracts | `NOT_DEPLOYED` | — |
| BSC mainnet stock trade | `NOT_EXECUTED` | — |

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
cp .env.example .env
npm run data:gate
```

Successful output is written to `evidence/live/rwa-inventory.json`. Secrets are never written to evidence or committed.

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
                                      Guarded Wallet / Vault
```

## Repository layout

```text
contracts/   BSC contracts
src/         core engine, API client, server, verifier
scripts/     judge, data gate, contract compiler
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
```

## Mainnet definition of done

- [ ] Select a genuinely tradable BSC stock token
- [ ] Record live RWA and issuer evidence
- [ ] Obtain a real quote and exit-liquidity measurement
- [ ] Simulate with Transaction API
- [ ] Enforce Agentic Wallet limits
- [ ] Deploy and verify contracts on BscScan
- [ ] Execute one small BSC mainnet stock transaction
- [ ] Re-verify calldata, output, slippage, and receipt independently
- [ ] Publish Passport, Credential, transaction link, and evidence root
- [ ] Integrate one independent demo wallet or Guarded Vault consumer

## Prior work

This is a new hackathon repository and product. General policy-gating, canonical hashing, evidence-receipt, and bond ideas were explored in earlier projects owned by the same builder. AfterBell's tokenized-stock equivalence engine, rights-continuity model, mandate schema, credential, Guarded Vault, and benchmark are new work for this event. See [`docs/PRIOR_WORK.md`](./docs/PRIOR_WORK.md).

## Disclaimer

AfterBell is experimental software for a hackathon. It is not a broker, custodian, investment adviser, insurer, or legal determination of shareholder rights. A credential reports evidence and deterministic policy results; it does not guarantee issuer solvency, market liquidity, regulatory eligibility, or investment performance.
