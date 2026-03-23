document.addEventListener("DOMContentLoaded", () => {

  const appsGrid = document.getElementById("appsGrid");
  const searchInput = document.getElementById("searchInput");
  const status = document.getElementById("status");
  const saveBtn = document.getElementById("saveSelectionBtn");
  const selectAllBtn = document.getElementById("selectAllBtn");
  const clearAllBtn = document.getElementById("clearAllBtn");

  const savePopup = document.getElementById("savePopup");
  const savePopupOk = document.getElementById("savePopupOk");

  let apps = [];
  let lockedSet = new Set();
  let settings = {};

  // ============================================
  // Render list - No Edit Button
  // ============================================
  function renderList(list) {
    appsGrid.innerHTML = "";

    list.forEach(a => {
      const appId = a.name; 
      const selected = lockedSet.has(appId) ? "selected" : "";

      const card = document.createElement("div");
      card.className = `app-card ${selected}`;
      card.dataset.id = appId;

      card.innerHTML = `
        <div class="app-left">
            <img src="${a.icon}" class="app-icon">
            <div class="app-name">${a.name}</div>
        </div>
        <div class="app-right">
            <div class="lock-indicator"></div>
        </div>
      `;

      // Single Tap Toggle
      card.onclick = () => {
        if (lockedSet.has(appId)) {
          lockedSet.delete(appId);
          delete settings[appId];
          card.classList.remove("selected");
        } else {
          lockedSet.add(appId);
          // Set default security: Both PIN and Face enabled
          settings[appId] = { pin: true, face: true };
          card.classList.add("selected");
        }
      };

      appsGrid.appendChild(card);
    });
  }

  // ============================================
  // Load apps + locked list
  // ============================================
  async function load() {
    status.innerText = "Loading…";

    const appsRes = await fetch("/api/list-installed-apps").then(r => r.json());
    const lockRes = await fetch("/api/get_locked_apps").then(r => r.json());

    if (appsRes.status === "ok") apps = appsRes.apps;

    if (lockRes.status === "ok") {
      lockedSet = new Set(lockRes.data.locked || []);
      settings = lockRes.data.settings || {};
    }

    renderList(apps);
    status.innerText = "";
  }

  // SEARCH
  searchInput.addEventListener("input", () => {
    const q = searchInput.value.toLowerCase();
    renderList(apps.filter(a => a.name.toLowerCase().includes(q)));
  });

  // SAVE
  saveBtn.onclick = async () => {
    status.innerText = "Saving…";

    await fetch("/api/save_locked_apps", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ 
        locked: [...lockedSet],
        settings: settings 
      })
    });

    savePopup.classList.remove("hidden");
    status.innerText = "";
  };

  savePopupOk.onclick = () => savePopup.classList.add("hidden");

  // SELECT ALL
  selectAllBtn.onclick = () => {
    apps.forEach(a => {
        lockedSet.add(a.name);
        settings[a.name] = { pin: true, face: true };
    });
    renderList(apps);
  };

  // CLEAR ALL
  clearAllBtn.onclick = () => {
    lockedSet.clear();
    settings = {};
    renderList(apps);
  };

  load();
});