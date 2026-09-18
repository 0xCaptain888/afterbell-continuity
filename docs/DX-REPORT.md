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

### 2026-09-18 — first live RWA and Trading API evidence

- Direct access to `web3.binance.com` timed out from the local network, while the configured HTTP proxy reached the service successfully. Node fetch required explicit environment-proxy activation.
- RWA data authentication passed with approximately 1.8 seconds end-to-end latency for the parallel platform and inventory calls.
- Live inventory exposed 488 currently parseable BSC records and 40 cross-platform same-underlying pairs in the fetched response.
- A 1 USDT quote probe produced executable bStock routes but Ondo returned business code `40375`, documenting a 5 USD minimum order. An exact 5 USDT boundary probe still returned the same code, so the final discovery probe uses 10 USDT and documents the boundary/rounding ambiguity.
- One route returned HTTP 429 and two returned transient fetch failures; quote discovery now throttles requests and retries only network/429 failures, never deterministic business errors.
- At 10 USDT, TSLA and NVDA returned live LiquidMesh quotes for both bStock and Ondo wrappers, with all four routes succeeding on the first attempt.
- The TSLAB swap builder returned real calldata for a funded public OKX Wallet address. Transaction API simulation correctly failed with `BEP20: transfer amount exceeds allowance`, demonstrating a fail-closed authorization boundary without signing or broadcasting.
- The first browser-wallet approval unexpectedly landed with a much larger allowance than the audited 10 USDT template. An independent RPC read detected the mismatch, OKX Wallet classified the authorization as risky, and the allowance was revoked before any swap. The user then established an exact 10 USDT allowance; independent RPC and OKX approval reads agreed, and Transaction API simulation passed with a 10 USDT debit, TSLAB credit, and post-swap allowance of zero. AfterBell now re-reads the broadcast transaction calldata and live allowance instead of trusting a wallet success message.
- A user-confirmed BNB Chain mainnet swap then spent exactly 10 USDT and delivered 0.027163579421480873 TSLAB. Independent RPC verification matched the prepared calldata byte-for-byte, confirmed the successful receipt and minimum-output bound, measured a 2 bps shortfall versus the quoted output, recorded 0.000030178641994006 BNB Gas, and verified that the allowance was consumed to zero.
- The underlying-profile and underlying-market endpoints returned authenticated data for TSLAB, TSLAon, NVDAB, and NVDAon. Ondo included linked daily and monthly attestation disclosures; bStock advertised collateral-report support without a URL in the observed payloads.
- None of the four responses exposed machine-readable token-holder dividend treatment, split handling, voting rights, or redemption terms. AfterBell deliberately records these as `UNKNOWN`; underlying equity dividend fields are not repurposed as token-holder rights.
- In the latest 10 USDT probe, three of four routes returned immediate stock-to-USDT exit quotes. NVDA's normalized cross-wrapper executable buy/exit spreads were 0/1 bps; TSLA remained unproven because TSLAon returned an explicit insufficient-liquidity response. The evidence pipeline preserves this market-state change rather than substituting stale success data.
- The live equivalence report therefore records executable price equivalence but an overall `UNKNOWN` classification and blocks automatic wrapper rescue. This is expected fail-closed behavior, not a failed demo.

### API observations

| Question | Status |
|---|---|
| Are RWA platform/list endpoints reachable with current credentials? | Yes; authenticated inventory passed |
| Do current platform enums include xStocks? | Pending; public schema currently documents `ondo` and `bstock` |
| Which BSC stock assets have executable quotes? | Verified for TSLAB, TSLAon, NVDAB, and NVDAon at the tested size |
| What is the smallest mainnet trade size? | A 10 USDT probe worked; 1 USDT and exact 5 USDT Ondo probes returned minimum-order code `40375` |
| Does Transaction API accurately report stock-token balance changes? | Pending |
| Are attestation publication timestamps machine-readable? | Not in the observed profile payload; URLs encode report dates but AfterBell does not infer timestamps from filenames |

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
