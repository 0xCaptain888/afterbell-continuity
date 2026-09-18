# AfterBell Watchtower — BNB Agent Studio seller

A BNB Chain seller agent workspace scaffolded by the official `bag` CLI and specialized for deterministic tokenized-stock continuity inspections.

- `app/agent/` — the valuable Agent + SOLE on-chain signer (TypeScript, `src/`).
- `.studio/` — secrets (encrypted keystore + .env.local); NEVER commit it.
- `bag dev` — run the agent locally; `bag doctor` — readiness checks.
- `bag deploy --provider bnb` — deploy to the BNB Chain managed platform (48h testnet trial). The self-rendered `agentcore/` descriptor also permits a later explicit AWS choice.

The paid product accepts one `WatchedPosition` JSON document and returns an `afterbell-watchtower-result/1` decision. It does not call an LLM, possess the buyer wallet, sign a rescue, or broadcast a transaction. ERC-8183/X402 signing remains inside the official fixed commerce handlers.

Current status: source-complete and awaiting an independent throwaway BSC testnet wallet, platform login, deploy-readiness pass, and first deployment receipt.

In Claude Code / Cursor, type `/bnbagent-studio` — the skill drives every step.
