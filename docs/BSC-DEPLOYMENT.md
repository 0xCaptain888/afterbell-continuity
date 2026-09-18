# Safe BSC mainnet deployment

This runbook deploys the three AfterBell contracts through OKX Wallet without placing a private key in the repository, terminal history, or browser page. It is intentionally split into preparation, wallet confirmations, independent RPC verification, source verification, and Credential reissuance.

Current mainnet result: all three contracts were deployed on September 18, 2026, independently verified through BNB Chain RPC, and source-verified through BscScan Standard JSON Input. The remaining issuance step creates a fresh Registry-bound Credential while preserving the original zero-address artifacts under `evidence/history/`.

## Truth boundary

- Preparing or opening the console does not deploy anything.
- Gas estimation does not deploy anything.
- Each of the three contract creations requires its own OKX Wallet confirmation and consumes BNB.
- The repository must continue to say `NOT_DEPLOYED` until successful receipts exist.
- A successful receipt is not source verification. Until BscScan verifies the Standard JSON input, deployment status remains `MAINNET_DEPLOYED_UNVERIFIED`.

## 1. Prepare the audited bundle

```bash
npm run contracts:browser:prepare
```

This recompiles Solidity with the pinned compiler and creates the Git-ignored local console at `.runtime/deployment/index.html`. It also refreshes `evidence/deployment/bscscan-standard-input.json` for source verification.

The bundle fixes:

- chain ID `56` (`0x38`);
- expected deployment wallet `0x101fd328a0b2fd9e853909651dab1c0b55947c03`;
- the public Credential issuer used by the `ContinuityRegistry` constructor;
- compiler version and optimizer settings;
- creation and runtime bytecode commitments;
- immutable Registry references used by the Vault and Bond contracts.

## 2. Serve locally

From the repository root:

```bash
python3 -m http.server 43120 --directory .runtime/deployment
```

Open `http://127.0.0.1:43120/` in the browser that contains OKX Wallet. Do not host this deployment console publicly.

## 3. Estimate before each confirmation

1. Connect OKX Wallet.
2. Confirm the selected account exactly matches the expected deployer.
3. Confirm the network is BNB Smart Chain mainnet.
4. Click **Estimate next deployment**.
5. Review the estimate and the displayed 20% Gas-limit buffer.
6. Stop if the contract name, constructor, bytecode commitment, account, chain, or cost differs from the audited bundle.
7. Check the acknowledgement and deploy only after explicit approval.

The order is fixed:

1. `ContinuityRegistry(credentialIssuer)`
2. `GuardedStockVault(registryAddress)`
3. `ExecutionBondEscrow(registryAddress)`

The console waits for each receipt, compares deployed runtime bytecode, checks Registry ownership and trusted issuer state, and checks the Vault/Bond Registry pointers before enabling the next step.

## 4. Save and verify the receipt bundle

After all three contracts pass the browser checks, download `afterbell-bsc-deployment-result.json` and place it at:

```text
.runtime/deployment/browser-result.json
```

Then run:

```bash
npm run contracts:browser:verify
```

The independent verifier reads BNB Chain RPC data and fails closed unless all of the following match:

- three unique successful contract-creation transactions;
- expected deployment wallet;
- exact creation bytecode and constructor input;
- receipt block number and Gas used;
- compiler runtime bytecode with immutable Registry addresses patched in;
- Registry owner and trusted Credential issuer;
- Vault and Bond Registry pointers.

Successful RPC verification writes `evidence/deployment/bsc-mainnet.json` with status `MAINNET_DEPLOYED_UNVERIFIED`.

## 5. Verify sources on BscScan

Use BscScan's Standard JSON Input verification flow with:

- compiler: `0.8.30+commit.73712a01`;
- EVM version: compiler default;
- optimization: enabled;
- optimizer runs: `200`;
- input: `evidence/deployment/bscscan-standard-input.json`.

Verify each of the three addresses and record the public verification URLs in the deployment evidence. Only then may the repository label the contracts `MAINNET_DEPLOYED_VERIFIED`.

Recorded source pages:

- `ContinuityRegistry`: https://bscscan.com/address/0xCb158746e0855ECeC2703CE20EC3aA780c0C823A#code
- `GuardedStockVault`: https://bscscan.com/address/0x8f996AFcb61eaa3FCc6BCe21B691240e6eACE1bD#code
- `ExecutionBondEscrow`: https://bscscan.com/address/0x52B6FF2243c3366E14aC13C6490A48580dE12029#code

## 6. Reissue the Credential

The currently published Credential deliberately uses the zero verifying-contract address because no Registry deployment had been proven when it was issued. After the Registry is deployed and source-verified:

1. set the actual Registry address in the Credential publishing flow;
2. issue a fresh short-lived EIP-712 Credential;
3. regenerate the Passport and Guarded Consumer admission;
4. republish public evidence;
5. rerun `npm run check`;
6. commit the deployment evidence and updated status.

Never rewrite the old evidence to pretend it was Registry-bound before deployment.

With the source-verified deployment evidence present, run the single local finalization command:

```bash
npm run mainnet:finalize
```

This command requires the existing Git-ignored `CREDENTIAL_SIGNER_PRIVATE_KEY`. It never prints the key, archives the historical zero-address artifacts, issues the Registry-bound Credential, regenerates the Passport and Guarded Consumer admission, refreshes the public site bundle, and runs the independent public-artifact verifier.
