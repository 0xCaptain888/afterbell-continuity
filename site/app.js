const judgeButton = document.querySelector("#judgeButton");
const judgePanel = document.querySelector("#judgePanel");
const stageList = document.querySelector("#stageList");
const runState = document.querySelector("#runState");
const connectButton = document.querySelector("#connectButton");
const liveDataStatus = document.querySelector("#liveDataStatus");
const simulationStatus = document.querySelector("#simulationStatus");
const rightsDataStatus = document.querySelector("#rightsDataStatus");
const liveProofGrid = document.querySelector("#liveProofGrid");
const verifyEvidenceButton = document.querySelector("#verifyEvidenceButton");
const verifyEvidenceState = document.querySelector("#verifyEvidenceState");
const verificationList = document.querySelector("#verificationList");

const number = (value, digits = 2) => Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "—";

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

connectButton.addEventListener("click", () => {
  connectButton.textContent = "Wallet setup pending";
  connectButton.title = "Agentic Wallet connection will become LIVE after approved credentials are configured.";
});

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
