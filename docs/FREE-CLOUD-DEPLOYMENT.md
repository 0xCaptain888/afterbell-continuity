# Free public-cloud deployment

AfterBell separates judge-facing availability from signing authority:

```text
GitHub Pages                 Vercel Hobby                    Cloudflare Workers
UI + published evidence  →  deterministic public API   →   independent edge verifier
no server secrets            no signing or persistence       no secrets or transaction authority
```

## Live Vercel API

- Production URL: `https://afterbell-continuity-api.vercel.app`
- Health: `GET /api/health`
- Judge Run: `GET /api/v1/demo/judge`
- Stateless Watchtower: `POST /api/v1/agent/watchtower`
- Continuity check: `POST /api/v1/continuity/check`
- Rescue plan: `POST /api/v1/rescue/plan`
- Credential verification: `POST /api/v1/credentials/verify`
- Passport verification: `POST /api/v1/passports/verify`
- Guarded consumer admission: `POST /api/v1/consumers/admit`

The production deployment deliberately returns `501 capability_disabled_on_public_serverless_runtime` for credential issuance and persistent Watchtower tasks. It never receives a wallet private key, signer key, Binance API credentials, or Agent Studio keystore.

The upload boundary is enforced by `.vercelignore`; `.env`, `.studio`, evidence caches, contract artifacts, and the BNB Agent workspace are excluded. Vercel Authentication is limited to preview deployments, so the production alias is publicly accessible to judges.

Deploy from an authenticated workstation:

```bash
npx --yes vercel@latest deploy --prod --yes \
  --scope 0xcaptain888s-projects \
  --project afterbell-continuity-api
```

## Cloudflare edge verifier

The Worker lives in `cloudflare-worker/` and exposes:

- Production URL: `https://afterbell-public-verifier.fluoridated-rhinoceros.workers.dev`

- `GET /health`
- `GET /verify`
- `GET /verify/live-evidence`
- `GET /verify/mainnet-stock-swap`
- `GET /verify/paid-agent-delivery`
- `GET /verify/submission-readiness`

It fetches the GitHub Pages artifacts independently, calculates a raw transport SHA-256 digest, and applies explicit semantic checks. It does not replace AfterBell's canonical evidence-root schema and says so in every response.

The production Worker was claimed into the project owner's Cloudflare account through Cloudflare's temporary-preview handoff. No broad account OAuth grant or Cloudflare API token was supplied to the deployment operator. Public verification on September 19, 2026 returned `PASS` for all four critical artifacts.

Deploy without granting broad account OAuth permissions:

```bash
cd cloudflare-worker
npx --yes wrangler@latest deploy --temporary
```

Wrangler returns a temporary Worker URL and a claim link. Open the claim link within 60 minutes and move the Worker into the project owner's Cloudflare account. For later automated updates, create a narrowly scoped token for this Worker instead of granting Wrangler unrelated KV, D1, AI, email, certificate, or account-wide permissions.

## Availability and truth boundaries

- GitHub Pages remains the canonical UI and evidence publisher.
- Vercel is the live public API and reproducible Judge Run.
- Cloudflare is an independent public evidence observer.
- BNB Agent Studio remains the evidence source for the completed ERC-8183 paid delivery.
- The managed BNB trial may expire without deleting the GitHub, Vercel, Cloudflare, BSC mainnet, BSC testnet, ERC-8004, or saved evidence records.
- No public-cloud deployment is described as AgentCore unless it is actually deployed through the official AgentCore provider flow.
