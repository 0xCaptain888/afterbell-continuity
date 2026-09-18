# Judge guide

## 90-second path

1. Open the public demo and click **Run Judge Demo**.
2. Observe a healthy stock exposure remain `PROTECTED`.
3. Inspect TSLA/NVDA live bidirectional quote cards: executable price equivalence is visible in basis points.
4. Observe the deliberate `RIGHTS UNKNOWN` result: authenticated disclosure links exist, but missing holder-right terms block automatic rescue.
5. Inspect the live Passport and EIP-712 Credential, including the deliberately disclosed quote-timing challenge.
6. Inspect the standalone Guarded Consumer: it permits read-only monitoring but blocks automated rescue and deposits.
7. Click **Verify evidence roots** and confirm all seven independently downloaded artifacts return `VERIFIED` in the browser.
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
- `evidence/deployment/bsc-mainnet-plan.json`
- `openapi.yaml`
- the installable SDK package produced by `npm pack --dry-run --cache .runtime/npm-cache`

## Live mainnet path — completed execution, deployment still pending

1. Save Binance Web3 credentials locally; run `npm run data:gate` and `npm run assets:rank`.
2. Run `npm run rights:discover`, `npm run quote:discover`, and `npm run equivalence:live`.
3. Review why live executable price equivalence still produces `UNKNOWN` rights equivalence and blocks auto-rescue.
4. Configure a public wallet address and run `npm run trade:gate`.
5. Review the already published low-value transaction, receipt, Passport, Credential, and consumer-admission evidence roots.
6. Run `npm run consumer:verify` and confirm unsafe automation fails closed outside the AfterBell UI.
7. Review the auditable browser bundle and [`BSC deployment runbook`](./BSC-DEPLOYMENT.md). Preparing or estimating it sends no transaction.
8. If deployment is explicitly approved, require three separate wallet confirmations, download the receipt bundle, run `npm run contracts:browser:verify`, and verify all three sources on BscScan.
9. Reissue the Credential with the deployed Registry as `verifyingContract`; never rewrite the historical zero-address Credential.

## Truth labels

- `LIVE`: fetched from a real external service, no transaction claim implied.
- `MAINNET`: backed by a BSC mainnet transaction or deployment receipt.
- `SIMULATED`: deterministic fixture used to explain intended behavior.
- `ADVERSARIAL_TEST`: a deliberately malformed or unsafe scenario.
- `DESIGN`: implemented packaging or plan without an external deployment receipt.
- `UNAVAILABLE`: a required external credential, wallet, or service is absent.

The demo must never relabel a simulated stage as live, or a deployment plan as a deployment.
