console.log("select_apps.js loaded");

// auto-load on page start
window.onload = () => detectOSAndLoad();
document.getElementById("goBackBtn").onclick = () => {
    window.history.back();
};

async function detectOSAndLoad() {
    const plat = navigator.platform.toLowerCase();
    console.log("Detected platform:", plat);
    loadApps();
}

async function loadApps() {
    try {
        const res = await fetch("/api/list-installed-apps");
        const data = await res.json();

        if (data.status !== "ok") {
            appsGrid.innerHTML = `<div class="error">Error: ${data.msg}</div>`;
            return;
        }

        renderApps(data.apps);

    } catch (e) {
        appsGrid.innerHTML = `<div class="error">Fetch error: ${e}</div>`;
    }
}

function renderApps(apps) {
    const grid = document.getElementById("appsGrid");
    grid.innerHTML = "";

    apps.forEach(appName => {
        // appName is a string (example: "firefox")

        const div = document.createElement("div");
        div.className = "app-item";

        div.innerHTML = `
            <img src="/static/app_icons/generic.png" class="app-icon">
            <div class="app-name">${appName}</div>
        `;

        div.onclick = () => selectApp(appName);

        grid.appendChild(div);
    });
}

function selectApp(appName) {
    console.log("Selected:", appName);
    alert("Selected: " + appName);
}
