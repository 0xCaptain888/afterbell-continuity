# AfterBell Watchtower service package

This directory isolates the minimal service boundary intended for Binance Agent Studio packaging.

- Endpoint: `POST /api/v1/agent/watchtower`
- Input: one `WatchedPosition`
- Output: one deterministic `WatchtowerEvent`
- No LLM can override policy checks.
- No trade, signature, or wallet broadcast occurs inside this endpoint.
- Current deployment status: `DESIGN` until a real Agent Studio URL and invocation receipt exist.

Before publishing, capture the service URL, exact pricing, request/response receipts, and the platform deployment identifier in `evidence/live/`.
