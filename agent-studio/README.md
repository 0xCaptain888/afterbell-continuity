# AfterBell Watchtower service package

This directory isolates the minimal service boundary intended for Binance Agent Studio packaging.

- Endpoint: `POST /api/v1/agent/watchtower`
- Input: one `WatchedPosition`
- Output: one deterministic `WatchtowerEvent`
- No LLM can override policy checks.
- No trade, signature, or wallet broadcast occurs inside this endpoint.
- Proposed price: `0.01 USDT` per deterministic inspection.
- Portable endpoint-shaped fixtures: `examples/protected-request.json`, `examples/protected-response.json`, `examples/rescue-request.json`, and `examples/rescue-response.json`.
- Package evidence: `evidence/agent-studio-package.json`.
- Current package status: `READY_TO_PUBLISH`.
- Current deployment status: `DEPLOYED_TESTNET_TRIAL / RUNNING_READY`. The public Agent Card, OAuth-protected A2A endpoint, ERC-8004 identity, and signed negotiation receipt are recorded under `evidence/live/`.

Run `npm run bnb-agent:public:verify`, `npm run bnb-agent:readiness:record`, and `npm run agent-studio:package` to refresh the deployment evidence. The public smoke proves reachability and signing, not a funded ERC-8183 delivery or B402 settlement.
