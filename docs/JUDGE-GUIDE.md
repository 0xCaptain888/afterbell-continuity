# Judge guide

## 90-second path

1. Open the public demo and click **Run Judge Demo**.
2. Observe a healthy stock exposure remain `PROTECTED`.
3. Inspect TSLA/NVDA live bidirectional quote cards: executable price equivalence is visible in basis points.
4. Observe the deliberate `RIGHTS UNKNOWN` result: authenticated disclosure links exist, but missing holder-right terms block automatic rescue.
5. Click **Verify evidence roots** and confirm all three independently downloaded artifacts return `VERIFIED` in the browser.
6. Run the deterministic demo and watch a premium/liquidity breach become `RESCUE_REQUIRED`.
7. See tampered calldata become `CHALLENGE`, then verify the short-lived EIP-712 credential returns `VALID`.

## Four-minute technical path

```bash
npm install
npm run check
npm run contracts:plan
npm run dev
```

Then show:

- `evidence/judge-run.json`
- `benchmark/results/latest.json`
- `evidence/watchtower-run.json`
- `evidence/live/rights-discovery.json`
- `evidence/live/quote-discovery.json`
- `evidence/live/economic-equivalence.json`
- `evidence/deployment/bsc-mainnet-plan.json`
- `openapi.yaml`
- the installable SDK package produced by `npm pack --dry-run --cache .runtime/npm-cache`

## Live mainnet path — pending external authorization

1. Save Binance Web3 credentials locally; run `npm run data:gate` and `npm run assets:rank`.
2. Run `npm run rights:discover`, `npm run quote:discover`, and `npm run equivalence:live`.
3. Review why live executable price equivalence still produces `UNKNOWN` rights equivalence and blocks auto-rescue.
4. Configure a public wallet address and run `npm run trade:gate`.
5. If the path is RFQ, authorize the typed data through the approved wallet. Never substitute a raw private key in source.
6. Deploy and verify contracts only after reviewing the bytecode hashes in the deployment plan.
7. Execute one low-value transaction under a strict mandate and publish transaction, receipt, Passport, Credential, and evidence roots.

## Truth labels

- `LIVE`: fetched from a real external service, no transaction claim implied.
- `MAINNET`: backed by a BSC mainnet transaction or deployment receipt.
- `SIMULATED`: deterministic fixture used to explain intended behavior.
- `ADVERSARIAL_TEST`: a deliberately malformed or unsafe scenario.
- `DESIGN`: implemented packaging or plan without an external deployment receipt.
- `UNAVAILABLE`: a required external credential, wallet, or service is absent.

The demo must never relabel a simulated stage as live, or a deployment plan as a deployment.
