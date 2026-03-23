// ===============================================
// FACE-LOCK APP — SYSTEM LOCK + HTTPS VERSION
// ===============================================
const API = "";

document.addEventListener("DOMContentLoaded", () => {

    const categoryContainer = document.getElementById("categoryContainer");
    const searchInput = document.getElementById("searchInput");
    const status = document.getElementById("status");

    let apps = [];
    let lockedApps = [];
    let settings = {};

    // ===============================================
    // Render List (NOW SUPPORTS FILTERING)
    // ===============================================
    function renderApps(list = lockedApps) {
        categoryContainer.innerHTML = "";

        if (list.length === 0) {
            status.innerText = "No locked apps.";
            return;
        }

        status.innerText = "";

        const groups = {};
        list.forEach(a => {
            const cat = a.category || "Other";
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(a);
        });

        Object.keys(groups).forEach(cat => {
            const title = document.createElement("div");
            title.className = "category-title";
            title.innerText = cat;
            categoryContainer.appendChild(title);

            groups[cat].forEach(a => {
                const card = document.createElement("div");
                card.className = "app-card locked-glow";

                const icon = (a.icon && a.icon.trim() !== "" && a.icon !== "null")
                    ? a.icon
                    : "/static/app_icons/generic.png";
                card.innerHTML = `
                    <div class="app-left">
                        <img class="app-icon-img" src="${icon}" loading="lazy">
                        <div class="app-name">${a.name}</div>
                    </div>
                    <div class="app-right">
                        <div class="lock-status-icon">🔒</div>
                    </div>
                `;

                categoryContainer.appendChild(card);
            });
        });
    }

    // ===============================================
    // Load From Backend
    // ===============================================
    async function load() {
        status.innerText = "Loading…";

        try {
            const appsRes = await fetch("/api/list-installed-apps").then(r => r.json());
            const lockedRes = await fetch("/api/get_locked_apps").then(r => r.json());

            if (appsRes.status === "ok") apps = appsRes.apps;

            if (lockedRes.status === "ok") {
                const lockedIds = lockedRes.data.locked || [];
                settings = lockedRes.data.settings || {};

                lockedApps = apps.filter(a =>
                    lockedIds.includes(a.id || a.name)
                );
            }

            renderApps();
            status.innerText = lockedApps.length ? "" : "No locked apps.";

        } catch (e) {
            console.error(e);
            status.innerText = "Error loading apps";
        }
    }

    // ===============================================
    // SEARCH (FIXED ✅)
    // ===============================================
    if (searchInput) {
        searchInput.addEventListener("input", () => {
            const q = searchInput.value.toLowerCase();

            const filtered = lockedApps.filter(a =>
                (a.name || "").toLowerCase().includes(q)
            );

            renderApps(filtered);
        });
    }

    load();
});