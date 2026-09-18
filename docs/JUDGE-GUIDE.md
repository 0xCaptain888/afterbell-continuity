# Judge guide

## 90-second path

1. Open the public demo and click **Run Judge Demo**.
2. Observe a healthy stock exposure remain `PROTECTED`.
3. Inspect TSLA/NVDA live bidirectional quote cards: executable price equivalence is visible in basis points.
4. Observe the deliberate `RIGHTS UNKNOWN` result: authenticated disclosure links exist, but missing holder-right terms block automatic rescue.
5. Inspect the live Passport and EIP-712 Credential, including the deliberately disclosed quote-timing challenge.
6. Inspect the standalone Guarded Consumer: it permits read-only monitoring but blocks automated rescue and deposits.
7. Click **Verify evidence roots** and confirm all nine independently downloaded artifacts return `VERIFIED` in the browser, including the source-verified contract deployment and paid Agent delivery.
8. Run the deterministic demo and watch a premium/liquidity breach become `RESCUE_REQUIRED`, then see tampered calldata become `CHALLENGE`.

## Four-minute technical path

```bash
npm install
npm run check
npm run contracts:plan
npm run contracts:browser:prepare
npm run dev
```

Then show:

- `evidence/judge-run.json`
- `benchmark/results/latest.json`
- `evidence/watchtower-run.json`
- `evidence/live/rights-discovery.json`
- `evidence/live/quote-discovery.json`
- `evidence/live/economic-equivalence.json`
- `evidence/live/mainnet-stock-swap.json`
- `evidence/live/mainnet-credential.json`
- `evidence/live/mainnet-passport.json`
- `evidence/live/guarded-consumer-admission.json`
- `evidence/live/agent-studio-paid-delivery.json`
- `evidence/deployment/bsc-mainnet.json`
- `evidence/deployment/bsc-mainnet-plan.json`
- `openapi.yaml`
- the installable SDK package produced by `npm pack --dry-run --cache .runtime/npm-cache`

## Live mainnet path — execution and source-verified deployment complete

1. Save Binance Web3 credentials locally; run `npm run data:gate` and `npm run assets:rank`.
2. Run `npm run rights:discover`, `npm run quote:discover`, and `npm run equivalence:live`.
3. Review why live executable price equivalence still produces `UNKNOWN` rights equivalence and blocks auto-rescue.
4. Configure a public wallet address and run `npm run trade:gate`.
5. Review the already published low-value transaction, receipt, Passport, Credential, and consumer-admission evidence roots.
6. Run `npm run consumer:verify` and confirm unsafe automation fails closed outside the AfterBell UI.
7. Inspect the three deployment receipts and independently generated [`bsc-mainnet.json`](../evidence/deployment/bsc-mainnet.json).
8. Open the Registry, Vault, and Bond `#code` pages on BscScan and confirm matching bytecode, compiler `0.8.30`, optimizer runs `200`, MIT License, and exact constructor arguments.
9. Inspect the current Registry-bound Credential and its deployment evidence parent; compare it with the preserved historical zero-address artifact under `evidence/history/`.
10. Open the [public Agent Card](https://bnbagent-api.bnbchain.world/v1/rt/01M2T4KMDTJCBQ25HAMPZ9JZ9D/.well-known/agent-card.json), then inspect `evidence/live/agent-studio-deployment.json`, `evidence/live/agent-studio-public-negotiate.json`, and `evidence/live/agent-studio-paid-delivery.json`.
11. Confirm the managed trial reports `running (ready)`, ERC-8004 Agent ID `2447`, fixed `0.01 U` pricing, and a provider signature recovered to `0x83B2…d123`.
12. In the paid-delivery artifact, confirm the independent buyer `0x2CB7…1Afa`, Job `1254`, all six successful chain receipts, the content-addressed deliverable, twelve passing policy checks, and `PROTECTED`. The status must remain `SUBMITTED` until buyer approval is legally available after the 24-hour dispute window.
13. Run `npm run bnb-agent:test` and `npm run bnb-agent:build`; confirm eight Agent tests and the TypeScript build pass without an LLM in the pricing or delivery path.
14. Run `npm run submission:audit` and confirm the repository, mainnet, integration, official-agent, paid-delivery, truth-label, and secret-scan checks pass.

## Truth labels

- `LIVE`: fetched from a real external service, no transaction claim implied.
- `MAINNET`: backed by a BSC mainnet transaction or deployment receipt.
- `SIMULATED`: deterministic fixture used to explain intended behavior.
- `ADVERSARIAL_TEST`: a deliberately malformed or unsafe scenario.
- `DESIGN`: implemented packaging or plan without an external deployment receipt.
- `DEPLOYED_TESTNET_TRIAL`: verified temporary BNB Agent Studio runtime on BSC Testnet; not a mainnet or paid-settlement claim.
- `PAID_DELIVERY_SUBMITTED_AWAITING_SETTLEMENT`: an independent buyer funded the job and the Agent submitted its deliverable on-chain; payment release is not claimed until buyer approval has its own receipt.
- `UNAVAILABLE`: a required external credential, wallet, or service is absent.

The demo must never relabel a simulated stage as live, or a deployment plan as a deployment.
