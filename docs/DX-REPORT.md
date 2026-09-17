# Developer Experience Report — live working log

This document is intentionally incomplete. It will be updated from real implementation evidence rather than written retroactively.

## Session log

### 2026-09-17 — repository and baseline

- Created a fresh repository and prior-work disclosure.
- Implemented deterministic equivalence, rights, mandate, credential, rescue and verifier modules.
- Added a signed Binance Web3 RWA API client using `X-OC-TIMESTAMP`, `X-OC-APIKEY`, `X-OC-SIGN`, the mandatory `/build` signature prefix, and raw URL encoding.
- Corrected the first draft after checking the live September 17 documentation: the authoritative RWA paths are `/api/v1/dex/market/rwa/*`, not legacy wallet-direct paths. This correction is retained as real DX evidence.
- Added a credential-safe data gate that refuses to run without local secrets.
- Added a reproducible simulated Judge Run and explicit truth labels.
- Added three BSC contracts and a local Solidity compilation step.
- Added exact request-signature unit tests, including the mandatory `/build` prefix and body binding.
- Added explicit handling for Trading API `200 OK` business errors, RFQ swap paths, quote expiry, and Transaction API simulation failure reasons.
- Added a credential-free deployment plan that commits bytecode hashes while refusing to imply deployment.
- Added a persistent Watchtower task journal and local Agent service boundary; Binance Agent Studio deployment remains explicitly pending.

### API observations to verify with live credentials

| Question | Status |
|---|---|
| Are RWA platform/list endpoints reachable with current credentials? | Pending |
| Do current platform enums include xStocks? | Pending; public schema currently documents `ondo` and `bstock` |
| Which BSC stock assets have executable quotes? | Pending |
| What is the smallest mainnet trade size? | Pending |
| Does Transaction API accurately report stock-token balance changes? | Pending |
| Are attestation publication timestamps machine-readable? | Pending |

## Required final sections

- Setup time to first successful API call
- Authentication pitfalls
- Endpoint latency and error distribution
- RWA schema gaps
- Trading and Transaction API accuracy
- Agentic Wallet authorization and policy experience
- Agent Studio deployment and billing experience
- Workarounds with exact documentation references
- Specific recommended API changes
