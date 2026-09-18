const judgeButton = document.querySelector("#judgeButton");
const judgePanel = document.querySelector("#judgePanel");
const stageList = document.querySelector("#stageList");
const runState = document.querySelector("#runState");
const connectButton = document.querySelector("#connectButton");
const walletConnectButton = document.querySelector("#walletConnectButton");
const approveButton = document.querySelector("#approveButton");
const walletState = document.querySelector("#walletState");
const walletHelp = document.querySelector("#walletHelp");
const approvalToken = document.querySelector("#approvalToken");
const approvalSpender = document.querySelector("#approvalSpender");
const liveDataStatus = document.querySelector("#liveDataStatus");
const simulationStatus = document.querySelector("#simulationStatus");
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

function setWalletState(message, kind = "") {
  if (!walletState) return;
  walletState.textContent = message;
  walletState.className = `wallet-state ${kind}`.trim();
}

function getWalletProvider() {
  return walletProvider ?? window.okxwallet?.ethereum ?? window.okxwallet ?? window.ethereum;
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
    approveButton.disabled = false;
    setWalletState(`VERIFIED · ${shortAddress(account)} · BNB Chain`, "ok");
    walletHelp.textContent = "The next button requests one bounded USDT approval. The wallet popup remains the final authority.";
  } catch (error) {
    setWalletState(error?.message ?? String(error), "bad");
  } finally {
    walletConnectButton.disabled = false;
    connectButton.disabled = false;
  }
}

async function requestBoundedApproval() {
  if (!walletProvider || !connectedWallet || !authorization) {
    setWalletState("Connect and verify the funded wallet first", "bad");
    return;
  }
  approveButton.disabled = true;
  setWalletState("Wallet confirmation required · verify 10 USDT and the spender");
  try {
    await ensureBnbChain(walletProvider);
    const transactionHash = await walletProvider.request({
      method: "eth_sendTransaction",
      params: [{
        from: connectedWallet,
        to: authorization.token.address,
        value: "0x0",
        data: authorization.calldata
      }]
    });
    setWalletState(`BROADCAST · ${shortAddress(transactionHash)} · approval only`, "ok");
    walletHelp.innerHTML = `Approval broadcast. No swap was executed. <a href="https://bscscan.com/tx/${transactionHash}" target="_blank" rel="noreferrer">Open BscScan ↗</a>`;
    approveButton.textContent = "Approval broadcast";
  } catch (error) {
    setWalletState(error?.message ?? String(error), "bad");
    approveButton.disabled = false;
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

async function verifyPublishedArtifact(path, artifactType, label) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`${label}: HTTP ${response.status}`);
  const artifact = await response.json();
  const { evidenceRoot, parentHashes: storedParents, ...payload } = artifact;
  const parentHashes = artifactType === "LIVE_ECONOMIC_EQUIVALENCE" && Array.isArray(storedParents) ? storedParents : [];
  const payloadHash = await sha256Hex(stableJson(payload));
  const header = {
    schema: "afterbell-evidence/1",
    artifactType,
    mode: payload.mode,
    observedAt: payload.observedAt,
    source: payload.source,
    parentHashes,
    payloadHash
  };
  const computedRoot = await sha256Hex(stableJson(header));
  return { label, verified: computedRoot === evidenceRoot, computedRoot, publishedRoot: evidenceRoot };
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
      verifyPublishedArtifact("./evidence/economic-equivalence.json", "LIVE_ECONOMIC_EQUIVALENCE", "Economic equivalence")
    ]);
    results.forEach(renderVerificationResult);
    const verified = results.every((result) => result.verified);
    verifyEvidenceState.textContent = verified ? "3/3 VERIFIED · canonical roots match" : "FAILED · published evidence mismatch";
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
    }
    renderLiveProof(evidence.featured);
  })
  .catch(() => {
    if (liveDataStatus) liveDataStatus.textContent = "UNAVAILABLE · public evidence summary missing";
    if (simulationStatus) simulationStatus.textContent = "UNAVAILABLE · simulation evidence missing";
    if (rightsDataStatus) rightsDataStatus.textContent = "UNAVAILABLE · rights evidence missing";
    if (liveProofGrid) liveProofGrid.textContent = "Public evidence summary unavailable.";
  });

connectButton?.addEventListener("click", () => document.querySelector("#wallet-auth")?.scrollIntoView({ behavior: "smooth", block: "center" }));
walletConnectButton?.addEventListener("click", connectWallet);
approveButton?.addEventListener("click", requestBoundedApproval);
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
