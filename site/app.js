const judgeButton = document.querySelector("#judgeButton");
const judgePanel = document.querySelector("#judgePanel");
const stageList = document.querySelector("#stageList");
const runState = document.querySelector("#runState");
const connectButton = document.querySelector("#connectButton");
const walletConnectButton = document.querySelector("#walletConnectButton");
const approveButton = document.querySelector("#approveButton");
const revokeButton = document.querySelector("#revokeButton");
const walletState = document.querySelector("#walletState");
const walletHelp = document.querySelector("#walletHelp");
const approvalToken = document.querySelector("#approvalToken");
const approvalSpender = document.querySelector("#approvalSpender");
const liveDataStatus = document.querySelector("#liveDataStatus");
const simulationStatus = document.querySelector("#simulationStatus");
const simulationDot = document.querySelector("#simulationDot");
const executionStatus = document.querySelector("#executionStatus");
const executionDot = document.querySelector("#executionDot");
const deploymentStatus = document.querySelector("#deploymentStatus");
const deploymentDot = document.querySelector("#deploymentDot");
const passportStatus = document.querySelector("#passportStatus");
const passportDot = document.querySelector("#passportDot");
const passportBadge = document.querySelector("#passportBadge");
const passportSummary = document.querySelector("#passportSummary");
const passportId = document.querySelector("#passportId");
const passportChecks = document.querySelector("#passportChecks");
const credentialBadge = document.querySelector("#credentialBadge");
const credentialSummary = document.querySelector("#credentialSummary");
const credentialSigner = document.querySelector("#credentialSigner");
const credentialExpiry = document.querySelector("#credentialExpiry");
const consumerBadge = document.querySelector("#consumerBadge");
const consumerSummary = document.querySelector("#consumerSummary");
const consumerRescue = document.querySelector("#consumerRescue");
const consumerDeposit = document.querySelector("#consumerDeposit");
const consumerMonitoring = document.querySelector("#consumerMonitoring");
const rightsDataStatus = document.querySelector("#rightsDataStatus");
const liveProofGrid = document.querySelector("#liveProofGrid");
const verifyEvidenceButton = document.querySelector("#verifyEvidenceButton");
const verifyEvidenceState = document.querySelector("#verifyEvidenceState");
const verificationList = document.querySelector("#verificationList");

const number = (value, digits = 2) => Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "—";
const shortAddress = (value) => typeof value === "string" && value.length > 12 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
let walletProvider;
let connectedWallet;
let authorization;
let executionComplete = false;
const EXACT_ALLOWANCE = 10_000_000_000_000_000_000n;

function setWalletState(message, kind = "") {
  if (!walletState) return;
  walletState.textContent = message;
  walletState.className = `wallet-state ${kind}`.trim();
}

function getWalletProvider() {
  return walletProvider ?? window.okxwallet?.ethereum ?? window.okxwallet ?? window.ethereum;
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function encodeAddress(value) {
  return String(value).slice(2).toLowerCase().padStart(64, "0");
}

function approvalCalldata(amount) {
  return `0x095ea7b3${encodeAddress(authorization.spender)}${BigInt(amount).toString(16).padStart(64, "0")}`;
}

function allowanceCalldata(owner) {
  return `0xdd62ed3e${encodeAddress(owner)}${encodeAddress(authorization.spender)}`;
}

async function readOnchainAllowance() {
  const raw = await walletProvider.request({
    method: "eth_call",
    params: [{ to: authorization.token.address, data: allowanceCalldata(connectedWallet) }, "latest"]
  });
  return BigInt(raw);
}

function formatTokenAmount(value) {
  const whole = value / 10n ** 18n;
  const fraction = (value % 10n ** 18n).toString().padStart(18, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : String(whole);
}

async function verifyAllowanceOnchain() {
  const allowance = await readOnchainAllowance();
  revokeButton.hidden = allowance === 0n;
  if (allowance === 0n) {
    approveButton.disabled = executionComplete;
    approveButton.textContent = executionComplete ? "Live execution complete · allowance 0" : "Approve exactly 10 USDT";
    setWalletState(`VERIFIED · ${shortAddress(connectedWallet)} · allowance is 0`, "ok");
    return allowance;
  }
  if (allowance === EXACT_ALLOWANCE) {
    approveButton.disabled = true;
    approveButton.textContent = "10 USDT allowance verified";
    setWalletState(`VERIFIED ONCHAIN · exact 10 USDT allowance · ${shortAddress(connectedWallet)}`, "ok");
    return allowance;
  }
  approveButton.disabled = true;
  approveButton.textContent = "Unsafe allowance blocked";
  revokeButton.hidden = false;
  setWalletState(`BLOCKED · unexpected allowance ${formatTokenAmount(allowance)} USDT · revoke before continuing`, "bad");
  return allowance;
}

async function loadAuthorization() {
  const response = await fetch("./wallet-authorization.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`Authorization template HTTP ${response.status}`);
  const data = await response.json();
  const encodedSpender = String(data.spender).slice(2).toLowerCase().padStart(64, "0");
  const encodedAmount = BigInt(data.amount).toString(16).padStart(64, "0");
  const expectedCalldata = `0x095ea7b3${encodedSpender}${encodedAmount}`;
  if (data.amount !== "10000000000000000000" || String(data.calldata).toLowerCase() !== expectedCalldata) {
    throw new Error("Bounded approval template failed validation");
  }
  authorization = data;
  approvalToken.textContent = shortAddress(data.token.address);
  approvalSpender.textContent = shortAddress(data.spender);
  return data;
}

async function ensureBnbChain(provider) {
  const currentChain = await provider.request({ method: "eth_chainId" });
  if (String(currentChain).toLowerCase() === authorization.chainId) return;
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: authorization.chainId }] });
  } catch (error) {
    if (Number(error?.code) !== 4902) throw error;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId: authorization.chainId,
        chainName: authorization.chainName,
        nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
        rpcUrls: ["https://bsc-dataseed.bnbchain.org"],
        blockExplorerUrls: ["https://bscscan.com"]
      }]
    });
  }
}

async function connectWallet() {
  if (!authorization) await loadAuthorization();
  walletProvider = getWalletProvider();
  if (!walletProvider?.request) {
    setWalletState("OKX Wallet provider not detected", "bad");
    walletHelp.textContent = "Install the OKX Wallet Chrome extension, or open this URL inside the OKX Wallet DApp browser.";
    return;
  }
  walletConnectButton.disabled = true;
  connectButton.disabled = true;
  setWalletState("Waiting for wallet connection…");
  try {
    const accounts = await walletProvider.request({ method: "eth_requestAccounts" });
    const account = Array.isArray(accounts) ? accounts[0] : undefined;
    if (!account) throw new Error("No wallet account returned");
    if (account.toLowerCase() !== authorization.expectedWallet.toLowerCase()) {
      connectedWallet = undefined;
      approveButton.disabled = true;
      throw new Error(`Wrong account: ${shortAddress(account)}. Switch to the funded wallet.`);
    }
    await ensureBnbChain(walletProvider);
    connectedWallet = account;
    connectButton.textContent = shortAddress(account);
    walletConnectButton.textContent = "Wallet verified";
    setWalletState(`CONNECTED · ${shortAddress(account)} · checking onchain allowance…`);
    await verifyAllowanceOnchain();
    walletHelp.textContent = "After every approval, AfterBell reads the actual transaction and current allowance from chain. Wallet success text alone is never trusted.";
  } catch (error) {
    setWalletState(error?.message ?? String(error), "bad");
  } finally {
    walletConnectButton.disabled = false;
    connectButton.disabled = false;
  }
}

async function requestBoundedApproval() {
  if (executionComplete) {
    setWalletState("No new approval requested · the published live execution is complete and its allowance is zero", "ok");
    return;
  }
  if (!walletProvider || !connectedWallet || !authorization) {
    setWalletState("Connect and verify the funded wallet first", "bad");
    return;
  }
  approveButton.disabled = true;
  setWalletState("Wallet confirmation required · verify 10 USDT and the spender");
  try {
    await ensureBnbChain(walletProvider);
    const intendedCalldata = approvalCalldata(EXACT_ALLOWANCE);
    if (intendedCalldata !== authorization.calldata.toLowerCase()) throw new Error("Approval calldata no longer matches the audited template");
    const transactionHash = await walletProvider.request({
      method: "eth_sendTransaction",
      params: [{
        from: connectedWallet,
        to: authorization.token.address,
        value: "0x0",
        data: intendedCalldata
      }]
    });
    setWalletState(`BROADCAST · ${shortAddress(transactionHash)} · verifying actual calldata…`);
    let transaction;
    for (let attempt = 0; attempt < 10 && !transaction; attempt += 1) {
      transaction = await walletProvider.request({ method: "eth_getTransactionByHash", params: [transactionHash] });
      if (!transaction) await delay(1_000);
    }
    const actualInput = String(transaction?.input ?? transaction?.data ?? "").toLowerCase();
    if (actualInput !== intendedCalldata) {
      await verifyAllowanceOnchain();
      throw new Error("Wallet broadcast calldata differs from the audited 10 USDT template. Revoke immediately.");
    }
    for (let attempt = 0; attempt < 20; attempt += 1) {
      if (await readOnchainAllowance() !== 0n) break;
      await delay(1_000);
    }
    await verifyAllowanceOnchain();
    walletHelp.innerHTML = `Approval broadcast and calldata matched. No swap was executed. <a href="https://bscscan.com/tx/${transactionHash}" target="_blank" rel="noreferrer">Open BscScan ↗</a>`;
  } catch (error) {
    setWalletState(error?.message ?? String(error), "bad");
    try {
      const allowance = await readOnchainAllowance();
      revokeButton.hidden = allowance === 0n;
      approveButton.disabled = allowance !== 0n;
    } catch {
      approveButton.disabled = true;
    }
  }
}

async function requestRevoke() {
  if (!walletProvider || !connectedWallet || !authorization) {
    setWalletState("Connect and verify the funded wallet first", "bad");
    return;
  }
  revokeButton.disabled = true;
  setWalletState("Wallet confirmation required · revoke allowance to zero");
  try {
    await ensureBnbChain(walletProvider);
    const transactionHash = await walletProvider.request({
      method: "eth_sendTransaction",
      params: [{
        from: connectedWallet,
        to: authorization.token.address,
        value: "0x0",
        data: approvalCalldata(0n)
      }]
    });
    setWalletState(`REVOKE BROADCAST · ${shortAddress(transactionHash)} · waiting for chain state`);
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await delay(1_000);
      if (await readOnchainAllowance() === 0n) break;
    }
    const allowance = await verifyAllowanceOnchain();
    if (allowance !== 0n) throw new Error(`Revoke not confirmed; allowance remains ${formatTokenAmount(allowance)} USDT`);
    walletHelp.innerHTML = `Allowance is now zero. <a href="https://bscscan.com/tx/${transactionHash}" target="_blank" rel="noreferrer">Open revoke on BscScan ↗</a>`;
  } catch (error) {
    setWalletState(error?.message ?? String(error), "bad");
  } finally {
    revokeButton.disabled = false;
  }
}

function renderLiveProof(featured = []) {
  if (!liveProofGrid) return;
  liveProofGrid.innerHTML = "";
  for (const asset of featured) {
    const card = document.createElement("article");
    card.className = "proof-card";
    const routes = Array.isArray(asset.routes) ? asset.routes : [];
    const routeRows = routes.map((route) => `
      <div class="route-row">
        <div><b>${route.tokenSymbol}</b><small>${String(route.platformId).toUpperCase()}</small></div>
        <span>$${number(route.buyPricePerShareUsd)} buy</span>
        <span>$${number(route.sellPricePerShareUsd)} exit</span>
        <span>${number(route.roundTripCostBps, 0)} bps RT</span>
      </div>`).join("");
    card.innerHTML = `
      <div class="proof-head">
        <div><span class="muted">Underlying</span><h3>${asset.underlyingTicker}</h3></div>
        <span class="status review">RIGHTS ${asset.classification ?? "UNKNOWN"}</span>
      </div>
      <div class="spread-grid">
        <div><span>Executable buy spread</span><b>${number(asset.executableBuySpreadBps, 0)} bps</b></div>
        <div><span>Executable exit spread</span><b>${number(asset.executableSellSpreadBps, 0)} bps</b></div>
      </div>
      <div class="route-list">${routeRows}</div>
      <div class="proof-decision"><span>Price result</span><b>${asset.economicPriceResult === "EXECUTABLE_PRICE_EQUIVALENT" ? "Equivalent ≤ 50 bps" : "Unproven"}</b></div>
      <div class="proof-decision blocked"><span>Automatic rescue</span><b>${asset.automaticRescueAllowed ? "Allowed" : "Blocked · missing rights"}</b></div>`;
    liveProofGrid.append(card);
  }
}

function stableJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return `0x${[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

async function verifyPublishedArtifact(path, artifactType, label, format = "flat") {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`${label}: HTTP ${response.status}`);
  const artifact = await response.json();
  let header;
  if (format === "wrapped") {
    const parentHashes = Array.isArray(artifact.parentHashes) ? artifact.parentHashes : [];
    const payloadHash = await sha256Hex(stableJson(artifact.payload));
    header = {
      schema: "afterbell-evidence/1",
      artifactType,
      mode: artifact.mode,
      observedAt: artifact.observedAt,
      source: artifact.source,
      parentHashes,
      payloadHash
    };
  } else {
    const { evidenceRoot: _root, parentHashes: storedParents, ...payload } = artifact;
    const parentHashes = artifactType === "LIVE_ECONOMIC_EQUIVALENCE" && Array.isArray(storedParents) ? storedParents : [];
    const payloadHash = await sha256Hex(stableJson(payload));
    header = {
      schema: "afterbell-evidence/1",
      artifactType,
      mode: payload.mode,
      observedAt: payload.observedAt,
      source: payload.source,
      parentHashes,
      payloadHash
    };
  }
  const computedRoot = await sha256Hex(stableJson(header));
  return { label, verified: computedRoot === artifact.evidenceRoot, computedRoot, publishedRoot: artifact.evidenceRoot };
}

function renderVerificationResult(result) {
  const row = document.createElement("article");
  row.className = `verification-row ${result.verified ? "verified" : "failed"}`;
  const title = document.createElement("div");
  const name = document.createElement("b");
  name.textContent = result.label;
  const root = document.createElement("small");
  root.textContent = result.publishedRoot;
  title.append(name, root);
  const status = document.createElement("span");
  status.textContent = result.verified ? "VERIFIED" : "MISMATCH";
  row.append(title, status);
  verificationList.append(row);
}

verifyEvidenceButton?.addEventListener("click", async () => {
  verifyEvidenceButton.disabled = true;
  verifyEvidenceState.textContent = "Downloading and hashing…";
  verificationList.innerHTML = "";
  try {
    const results = await Promise.all([
      verifyPublishedArtifact("./evidence/rights-discovery.json", "RIGHTS_DISCOVERY", "Rights discovery"),
      verifyPublishedArtifact("./evidence/quote-discovery.json", "ROUND_TRIP_QUOTE_DISCOVERY", "Round-trip quotes"),
      verifyPublishedArtifact("./evidence/economic-equivalence.json", "LIVE_ECONOMIC_EQUIVALENCE", "Economic equivalence"),
      verifyPublishedArtifact("./evidence/mainnet-stock-swap.json", "MAINNET_STOCK_SWAP", "Mainnet execution"),
      verifyPublishedArtifact("./evidence/bsc-mainnet.json", "BSC_MAINNET_DEPLOYMENT", "Verified contract deployment"),
      verifyPublishedArtifact("./evidence/mainnet-credential.json", "LIVE_CONTINUITY_CREDENTIAL", "EIP-712 credential", "wrapped"),
      verifyPublishedArtifact("./evidence/mainnet-passport.json", "LIVE_CONTINUITY_PASSPORT", "Continuity Passport", "wrapped"),
      verifyPublishedArtifact("./evidence/guarded-consumer-admission.json", "LIVE_GUARDED_CONSUMER_ADMISSION", "Guarded consumer", "wrapped"),
      verifyPublishedArtifact("./evidence/agent-studio-paid-delivery.json", "BNB_AGENT_ERC8183_PAID_DELIVERY", "Paid Agent delivery", "wrapped")
    ]);
    results.forEach(renderVerificationResult);
    const verified = results.every((result) => result.verified);
    verifyEvidenceState.textContent = verified ? "9/9 VERIFIED · canonical roots match" : "FAILED · published evidence mismatch";
    verifyEvidenceState.className = `verify-state ${verified ? "ok" : "bad"}`;
  } catch (error) {
    verifyEvidenceState.textContent = `FAILED · ${error instanceof Error ? error.message : String(error)}`;
    verifyEvidenceState.className = "verify-state bad";
  } finally {
    verifyEvidenceButton.disabled = false;
  }
});

fetch("./live-evidence.json", { cache: "no-store" })
  .then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  })
  .then((evidence) => {
    if (liveDataStatus) {
      liveDataStatus.textContent = evidence.inventory?.status === "LIVE_DATA_GATE_PASSED"
        ? `LIVE · ${evidence.inventory.parsedAssetCount} assets · ${evidence.inventory.continuityPairCount} pairs · ${evidence.quotes?.roundTripRoutes ?? 0}/${evidence.quotes?.requestedWrappers ?? 0} bidirectional routes`
        : "UNAVAILABLE · no authenticated inventory evidence";
    }
    if (rightsDataStatus) {
      rightsDataStatus.textContent = evidence.rights?.status === "LIVE_PARTIAL_RIGHTS_EVIDENCE"
        ? `LIVE PARTIAL · ${evidence.rights.availableAssets}/${evidence.rights.requestedAssets} profiles · unknown terms block auto-rescue`
        : "UNAVAILABLE · rights evidence missing";
    }
    if (simulationStatus) {
      simulationStatus.textContent = evidence.simulation?.status === "SIMULATION_BLOCKED"
        ? `LIVE BLOCKED · ${evidence.simulation.failReason ?? "policy or execution failure"}`
        : `${evidence.simulation?.status ?? "UNAVAILABLE"}`;
      if (simulationDot && evidence.simulation?.status === "LIVE_QUOTE_AND_SIMULATION_PASSED") {
        simulationDot.classList.remove("waiting");
        simulationDot.classList.add("live");
      }
    }
    if (executionStatus) {
      const execution = evidence.mainnetExecution;
      const transactionHash = String(execution?.transactionHash ?? "");
      const explorerUrl = String(execution?.explorerUrl ?? "");
      const verified = execution?.status === "SUCCESS"
        && /^0x[0-9a-f]{64}$/i.test(transactionHash)
        && /^https:\/\/bscscan\.com\/tx\/0x[0-9a-f]{64}$/i.test(explorerUrl);
      if (verified) {
        executionComplete = true;
        approveButton.disabled = true;
        approveButton.textContent = "Live execution complete · allowance 0";
        const spent = execution.input?.amountUsdt ?? "?";
        const received = execution.output?.amountTslab ?? "?";
        executionStatus.innerHTML = `LIVE SUCCESS · ${spent} USDT → ${received} TSLAB · <a href="${explorerUrl}" target="_blank" rel="noreferrer">BscScan ↗</a>`;
        executionDot?.classList.remove("waiting");
        executionDot?.classList.add("live");
      } else {
        executionStatus.textContent = "NOT EXECUTED · no verified mainnet receipt";
      }
    }
    if (deploymentStatus) {
      const deployment = evidence.deployment;
      const sourceContracts = Array.isArray(deployment?.sourceVerification?.contracts) ? deployment.sourceVerification.contracts : [];
      const verified = deployment?.status === "MAINNET_DEPLOYED_VERIFIED" && sourceContracts.length === 3;
      if (verified) {
        deploymentStatus.innerHTML = `MAINNET VERIFIED · Registry ${shortAddress(deployment.registryAddress)} · <a href="${sourceContracts[0].sourceUrl}" target="_blank" rel="noreferrer">BscScan sources ↗</a>`;
        deploymentDot?.classList.remove("waiting");
        deploymentDot?.classList.add("live");
      } else {
        deploymentStatus.textContent = "UNVERIFIED · deployment or published sources missing";
      }
    }
    const passport = evidence.continuityPassport;
    const credential = evidence.continuityCredential;
    const passedChecks = Array.isArray(passport?.resultSummary?.passedChecks) ? passport.resultSummary.passedChecks : [];
    const challengedChecks = Array.isArray(passport?.resultSummary?.challengedChecks) ? passport.resultSummary.challengedChecks : [];
    if (passport?.passportId && credential?.digest) {
      passportStatus.textContent = `${passport.result} · ${passedChecks.length}/${passedChecks.length + challengedChecks.length} deterministic checks passed · auto-rescue blocked`;
      passportDot?.classList.remove("waiting");
      passportDot?.classList.add("live");
      passportBadge.textContent = passport.result;
      passportSummary.textContent = passport.timingDisclosure?.limitation ?? "Public Passport loaded.";
      passportId.textContent = shortAddress(passport.passportId);
      passportId.title = passport.passportId;
      passportChecks.textContent = `${passedChecks.length} PASS · ${challengedChecks.length} CHALLENGE`;
      const expiresAt = Date.parse(credential.validUntil);
      const credentialCurrent = Number.isFinite(expiresAt) && expiresAt > Date.now();
      credentialBadge.textContent = credentialCurrent ? "VALID · WATCH" : "EXPIRED · HISTORICAL";
      credentialSummary.textContent = credential.registryStatus === "MAINNET_DEPLOYED_VERIFIED"
        ? "Issuer signature is Registry-bound and valid at issuance; status remains WATCH because machine-readable shareholder rights are incomplete."
        : "Issuer signature is valid at issuance; status is WATCH because machine-readable shareholder rights remain incomplete.";
      credentialSigner.textContent = shortAddress(credential.signer);
      credentialSigner.title = credential.signer;
      credentialExpiry.textContent = Number.isFinite(expiresAt) ? new Date(expiresAt).toLocaleString() : "—";
    } else if (passportStatus) {
      passportStatus.textContent = "UNAVAILABLE · public Passport or Credential missing";
    }
    const consumer = evidence.guardedConsumer;
    if (consumer?.result && consumer?.permissions) {
      consumerBadge.textContent = consumer.result.replaceAll("_", " ");
      consumerSummary.textContent = consumer.truthNotice ?? "Standalone consumer admission loaded.";
      consumerRescue.textContent = consumer.permissions.allowAutomatedRescue ? "ALLOWED" : "BLOCKED";
      consumerDeposit.textContent = consumer.permissions.allowGuardedDeposit ? "ALLOWED" : "BLOCKED";
      consumerMonitoring.textContent = consumer.permissions.allowReadOnlyMonitoring ? "ALLOWED" : "BLOCKED";
    } else {
      consumerBadge.textContent = "UNAVAILABLE";
      consumerSummary.textContent = "Standalone consumer artifact is unavailable.";
    }
    renderLiveProof(evidence.featured);
  })
  .catch(() => {
    if (liveDataStatus) liveDataStatus.textContent = "UNAVAILABLE · public evidence summary missing";
    if (simulationStatus) simulationStatus.textContent = "UNAVAILABLE · simulation evidence missing";
    if (rightsDataStatus) rightsDataStatus.textContent = "UNAVAILABLE · rights evidence missing";
    if (executionStatus) executionStatus.textContent = "UNAVAILABLE · execution evidence missing";
    if (deploymentStatus) deploymentStatus.textContent = "UNAVAILABLE · deployment evidence missing";
    if (passportStatus) passportStatus.textContent = "UNAVAILABLE · Passport evidence missing";
    if (liveProofGrid) liveProofGrid.textContent = "Public evidence summary unavailable.";
  });

connectButton?.addEventListener("click", () => document.querySelector("#wallet-auth")?.scrollIntoView({ behavior: "smooth", block: "center" }));
walletConnectButton?.addEventListener("click", connectWallet);
approveButton?.addEventListener("click", requestBoundedApproval);
revokeButton?.addEventListener("click", requestRevoke);
loadAuthorization().catch((error) => setWalletState(error?.message ?? String(error), "bad"));

window.addEventListener("eip6963:announceProvider", (event) => {
  if (event?.detail?.info?.name === "OKX Wallet") walletProvider = event.detail.provider;
});
window.dispatchEvent(new Event("eip6963:requestProvider"));

judgeButton.addEventListener("click", async () => {
  judgePanel.hidden = false;
  judgePanel.scrollIntoView({ behavior: "smooth", block: "start" });
  runState.textContent = "Running";
  stageList.innerHTML = "";
  try {
    let response = await fetch("/api/v1/demo/judge", { cache: "no-store" });
    if (!response.ok) response = await fetch("./demo-data.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const run = await response.json();
    run.stages.forEach((stage, index) => {
      const row = document.createElement("article");
      row.className = "stage";
      const isCaution = ["BLOCKED", "CHALLENGE", "RESCUE_REQUIRED"].includes(stage.result);
      row.innerHTML = `
        <span class="stage-index">${String(index + 1).padStart(2, "0")}</span>
        <div><h3>${stage.label}</h3><p>${stage.mode}</p></div>
        <span class="stage-result ${isCaution ? "bad" : ""}">${stage.result}</span>`;
      stageList.append(row);
    });
    runState.textContent = "Complete";
  } catch (error) {
    runState.textContent = "Failed";
    stageList.innerHTML = `<article class="stage"><span class="stage-index">!</span><div><h3>Judge run unavailable</h3><p>${String(error)}</p></div><span class="stage-result bad">ERROR</span></article>`;
  }
});
