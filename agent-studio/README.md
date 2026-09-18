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
- Current deployment status: `DESIGN / UNPUBLISHED` until a real Agent Studio URL and invocation receipt exist.

Run `npm run agent-studio:package` before publishing. After publication, capture the service URL, exact pricing, request/response receipts, and platform deployment identifier in `evidence/live/`. Do not relabel the service as deployed before those records exist.
