# Security model

## Trust boundaries

- Binance Web3 API responses are authenticated transport inputs, not unquestionable truth.
- Issuer documents are versioned evidence, not live guarantees.
- LLM output is untrusted until parsed and checked by deterministic policy.
- The web interface cannot authorize a trade by itself.
- The credential signer is trusted only for a short validity window.
- The independent verifier must recompute hashes from source evidence.

## Fail-closed rules

- Missing ratio, reference price, rights evidence, attestation age, or quote causes `BLOCKED` or `UNKNOWN`.
- A stale credential is invalid even if its signature is valid.
- An API timeout cannot reuse an old value beyond its explicit TTL.
- Mainnet write operations require a simulation and an approved wallet policy.
- A changed recipient, calldata, minimum output, or chain invalidates the commitment.

## Red-team cases

| Attack | Expected behavior |
|---|---|
| Quote substitution | `BLOCKED` before signing |
| Stale reference | `CAUTION` or `BLOCKED` |
| Tampered calldata | `CHALLENGE` after replay |
| Expired credential | Guarded Vault rejects deposit |
| Untrusted signer | Guarded Vault rejects deposit |
| Non-equivalent wrapper | Automatic migration prohibited |
| Duplicate intent | Escrow/runner rejects second execution |
| Excessive allowance | Simulation policy rejects write |
| RPC outage | No new transaction is generated |
| LLM prompt injection | Structured policy validator rejects unsupported fields |

## Mainnet controls

- Use a dedicated low-value wallet.
- Apply strict token and contract allowlists.
- Keep daily limits below the funded balance.
- Never expose API or wallet secrets in browser code.
- Verify deployed bytecode and contract source.
- Require explicit human approval for the first mainnet rescue.
- Keep the API on loopback for local judging. A non-loopback bind is rejected unless `AFTERBELL_API_TOKEN` is configured.
- Protect Watchtower mutation, Agent invocation, and credential-signing endpoints with the bearer token in hosted environments.
