const judgeButton = document.querySelector("#judgeButton");
const judgePanel = document.querySelector("#judgePanel");
const stageList = document.querySelector("#stageList");
const runState = document.querySelector("#runState");
const connectButton = document.querySelector("#connectButton");

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
