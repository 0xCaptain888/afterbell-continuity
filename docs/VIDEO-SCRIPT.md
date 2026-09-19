# Four-minute demo script

Target length: **3:45–3:55**. Record at 1440p or 1080p, browser zoom 100%, notifications disabled. Use a calm human voice and pause after every proof claim.

## 0:00–0:20 — The problem

**Screen:** Demo hero and live NVDA posture.

**Narration:**

> Tokenized stocks create a new failure mode. Two tokens may share the same ticker and price, while representing different backing, shareholder rights, redemption paths, or exit liquidity. AfterBell is the continuity layer that prevents an agent from silently changing what the user actually owns.

## 0:20–0:48 — The product thesis

**Screen:** Scroll from the hero to “Price matches. Rights still matter.”

**Narration:**

> AfterBell normalizes economic exposure, fingerprints the available rights evidence, applies the wallet owner's mandate, and only prepares a rescue when both price and rights remain compatible. If evidence is missing, it fails closed. Price similarity alone never becomes permission.

## 0:48–1:20 — Real market evidence

**Screen:** Show the TSLA and NVDA cards. Pause on the live spreads and `RIGHTS UNKNOWN` labels.

**Narration:**

> These are authenticated BNB Chain RWA and Trading API results. AfterBell found live bidirectional routes for three of four wrappers. NVDA prices are economically close, but machine-readable dividend, split, voting, backing, and redemption terms are incomplete. The correct decision is watch-only and manual review—not a fake green check.

## 1:20–1:50 — Real bounded execution

**Screen:** Show the BSC execution readiness item, BscScan transaction link, and zero-allowance wallet panel.

**Narration:**

> The project includes one user-confirmed BSC mainnet execution: exactly ten USDT into TSLAB. AfterBell independently verified the sender, target, calldata, exact input, minimum output, receipt, Gas, and realized slippage. The temporary token allowance returned to zero. The demo can re-read that safety boundary directly from chain.

## 1:50–2:20 — Deployed protocol contracts

**Screen:** Open the source-verified contract item and briefly show the Registry BscScan source page, then return.

**Narration:**

> Three protocol contracts are deployed on BNB Chain: the Continuity Registry, Guarded Stock Vault, and Execution Bond Escrow. Their receipts, constructor calldata, runtime bytecode, ownership, Registry pointers, trusted issuer, and published Solidity sources all match independently.

## 2:20–2:52 — Credential, Passport, and independent consumer

**Screen:** Show Credential, Passport, and Guarded Consumer cards.

**Narration:**

> The Registry-bound EIP-712 Credential describes the bounded evidence set. The Passport proves simulation, calldata binding, slippage, and transaction presence. It deliberately challenges quote freshness because chain confirmation cannot prove the exact broadcast time. An independent consumer therefore permits monitoring but blocks automated rescue and deposits. This is fail-closed composability.

## 2:52–3:17 — Browser verification

**Screen:** Click **Verify evidence roots** and wait for `9/9 VERIFIED`.

**Narration:**

> A judge does not need to trust this dashboard. This browser downloads nine public artifacts and recomputes their canonical SHA-256 roots locally, including a real independent-buyer Agent delivery. The full verifier also recovers the EIP-712 signer, checks the Registry binding, and recomputes the consumer decision.

## 3:17–3:40 — One-click adversarial demo

**Screen:** Click **Run Judge Demo**. Show `PROTECTED`, `RESCUE_REQUIRED`, and tampered calldata `CHALLENGE`.

**Narration:**

> The deterministic Judge Run shows the control loop: a healthy exposure remains protected, a premium and liquidity breach requires rescue, and modified calldata is challenged. An LLM cannot override these policy checks.

## 3:40–3:55 — Close

**Screen:** Return to hero, then briefly show `TECHNICALLY READY · 11/11` and the SDK section.

**Narration:**

> AfterBell is not another stock trading interface. It is the verification and continuity primitive that wallets, agents, and DeFi protocols can integrate before they automate tokenized-stock risk.

## Recording checklist

- Do not show `.env`, terminal history, wallet balances, email, API credentials, or private browser tabs.
- Keep the wallet disconnected unless demonstrating the read-only allowance check.
- Never describe the challenged Passport as failed; say that it honestly exposes an unprovable timing property.
- Show the verified BSC Testnet managed-trial deployment, Agent/Deployment IDs, ERC-8004 ID, public Agent Card, signed quote, and Job `1265` settlement receipt. Say “independent buyer funded, Agent delivered, buyer approved after the canonical 900-second dispute window”; do not claim B402 settlement.
- End on the public Demo URL and GitHub repository for at least three seconds.
