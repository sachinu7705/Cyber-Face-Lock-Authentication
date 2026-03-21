console.log("🚀 mobile_locked_apps.js loaded");

let currentUser = "default";
document.getElementById("goBackBtn").onclick = () => {
    window.history.back();
};

// Load locked apps
async function loadLockedApps() {
    const res = await fetch(`/api/get_apps/${currentUser}`);
    const data = await res.json();

    const list = document.getElementById("appsList");
    list.innerHTML = "";

    (data.apps || []).forEach(name => {
        addAppToUI(name, "/static/app_icons/generic.png");
    });
}

// Load installed apps for picker
async function loadInstalledApps() {
    console.log("Fetching installed apps…");

    const res = await fetch("/api/list_installed_apps");
    const data = await res.json();

    console.log("API Response:", data);

    const picker = document.getElementById("pickerList");
    picker.innerHTML = "";

    if (data.status !== "ok") {
        picker.innerHTML = `<div class="error">${data.msg}</div>`;
        return;
    }

    data.apps.forEach(name => {
        const div = document.createElement("div");
        div.className = "picker-item";

        div.innerHTML = `
            <img src="/static/app_icons/generic.png" class="picker-icon">
            <span class="picker-text">${name}</span>
        `;

        div.onclick = () => {
            addAppToUI(name, "/static/app_icons/generic.png");
            saveAppsToServer();
            closePicker();
        };

        picker.appendChild(div);
    });
}

// Add an app card
function addAppToUI(name, icon) {
    const list = document.getElementById("appsList");

    const card = document.createElement("div");
    card.className = "app-card";

    card.innerHTML = `
        <div class="card-left">
            <img src="${icon}" class="app-card-icon">
            <span class="label">${name}</span>
        </div>
        <button class="delBtn">REMOVE</button>
    `;

    card.querySelector(".delBtn").onclick = () => {
        card.remove();
        saveAppsToServer();
    };

    list.appendChild(card);
}

// Save apps for user
function saveAppsToServer() {
    const apps = [...document.querySelectorAll(".app-card .label")]
        .map(x => x.innerText.trim());

    const fd = new FormData();
    fd.append("user", currentUser);
    apps.forEach(a => fd.append("apps[]", a));

    fetch("/api/set_apps", { method: "POST", body: fd });
}

// Picker controls
document.getElementById("openPicker").onclick = () => {
    loadInstalledApps();
    document.getElementById("appPicker").classList.remove("hidden");
};
document.querySelector(".picker-close").onclick = closePicker;

function closePicker() {
    document.getElementById("appPicker").classList.add("hidden");
}

// Init
window.onload = () => {
    loadLockedApps();
};

