/* mobile_apps.js — simple list + cyber neon + openApp integration */

const APPS_API = "/api/list-installed-apps";
const LOCKS_API = "/api/get_locked_apps";
const IS_LOCKED_API = "/api/is_app_locked";
const LAUNCH_API = "/api/launch_app"; // optional backend launcher (may not exist)

async function fetchJson(url, opts) {
  try {
    const r = await fetch(url, opts);
    return await r.json();
  } catch (e) {
    return null;
  }
}


function makeAppCard(app, lockedSet) {
  const id = app.name; // use name as the stable id returned by backend
  const card = document.createElement("button");
  card.className = "app-card";
  card.dataset.id = id;

  const locked = lockedSet && lockedSet.has(id);

  card.innerHTML = `
    <div class="left">
      <img class="app-icon" src="${app.icon || '/static/app_icons/generic.png'}" alt="${app.name}">
      <div class="meta">
        <div class="app-name">${app.name}</div>
        <div class="app-sub muted">${app.id || ""}</div>
      </div>
    </div>
    <div class="right">
      ${locked ? '<span class="lock-badge">🔒</span>' : ''}
    </div>
  `;

  card.onclick = () => openApp(id, app.name, app.icon);
  return card;
}

async function loadApps() {
  const status = document.getElementById("appsStatus");
  status.textContent = "Loading apps…";

  const appsRes = await fetchJson(APPS_API);
  const locksRes = await fetchJson(LOCKS_API);

  if (!appsRes || appsRes.status !== "ok") {
    status.textContent = "Failed to load apps from backend.";
    return;
  }

  const apps = appsRes.apps || [];
  const lockedList = (locksRes && locksRes.data && locksRes.data.locked) || [];
  const lockedSet = new Set(lockedList);

  const container = document.getElementById("appsContainer");
  container.innerHTML = "";

  if (apps.length === 0) {
    status.textContent = "No apps found on this machine.";
    return;
  }

  // render simple list (readable + neon)
  apps.forEach(app => {
    const card = makeAppCard(app, lockedSet);
    container.appendChild(card);
  });

  status.textContent = `${apps.length} apps`;
}

async function openApp(appid, appname, icon) {
  const res = await fetchJson(IS_LOCKED_API, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ appid })
  });

  const isLocked = res && res.locked === true;

  if (isLocked) {
    // Show the popup instead of redirecting
    startFaceScan(appid, appname);
  } else {
    launchRequest(appid, appname);
  }
}
async function startFaceScan(appid, appname) {
  const overlay = document.getElementById("faceScanOverlay");
  const video = document.getElementById("webcam");
  const status = document.getElementById("scanStatus");
  const canvas = document.getElementById("overlay");
  const modal = document.querySelector(".face-modal");
  const cameraContainer = document.querySelector(".camera-container");
  
  // 1. Reset UI from any previous failed attempts
  const oldFallback = document.getElementById("fallbackOptions");
  if(oldFallback) oldFallback.remove();
  
  cameraContainer.style.display = "block";
  overlay.style.display = "flex";
  status.innerHTML = "Initializing camera...";

  let stream = null; // Declare outside try to ensure click handlers can access it

  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;

    // Wait for camera stabilization
    setTimeout(async () => {
      status.textContent = "Scanning face...";
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = canvas.toDataURL('image/jpeg');

      const verifyRes = await fetchJson("/api/verify-face", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ image: imageData, appid: appid })
      });

      // Stop camera immediately after capture to save resources
      if (stream) stream.getTracks().forEach(track => track.stop());

      if (verifyRes && verifyRes.status === "success") {
        status.textContent = "Access Granted!";
        setTimeout(() => {
          overlay.style.display = "none";
          launchRequest(appid, appname);
        }, 1000);
      } else {
        // FAIL STATE - Hide camera and show PIN/Rescan options
        status.innerHTML = `<span style="color: #ff0055;">ACCESS DENIED</span>`;
        cameraContainer.style.display = "none";

        const fallbackDiv = document.createElement("div");
        fallbackDiv.id = "fallbackOptions";
        fallbackDiv.innerHTML = `
          <button id="btnRescan" class="refresh-btn">RESCAN FACE</button>
          <div style="color: #444; font-size: 0.7rem; margin: 10px 0;">OR</div>
          // Clean placeholder and add autofocus
          <input type="password" id="pinInput" placeholder="ENTER PIN" maxlength="4" class="search-input" autofocus>
          <button id="btnVerifyPin" class="refresh-btn" style="border: 1px solid #f2ea02; color: #f2ea02; background: none;">UNLOCK</button>
          <button id="btnCancel" class="cancel-link" style="margin-top: 20px; color: #ff0055; background: none; border: none; cursor: pointer; text-decoration: underline; display: block; width: 100%;">CANCEL AND CLOSE</button>
        `;
        modal.appendChild(fallbackDiv);

        // --- BUTTON LOGIC ---

        // Rescan: Remove fallback UI and restart function
        document.getElementById("btnRescan").onclick = () => {
          fallbackDiv.remove();
          startFaceScan(appid, appname);
        };

        // PIN: Get value and call verify function
        document.getElementById("btnVerifyPin").onclick = () => {
          const pinValue = document.getElementById("pinInput").value;
          verifyPin(appid, appname, pinValue);
        };

        // Cancel: Close everything and ensure camera is off
        document.getElementById("btnCancel").onclick = () => {
          overlay.style.display = "none";
          if (stream) stream.getTracks().forEach(track => track.stop());
        };
      }
    }, 1500);

  } catch (err) {
    console.error("Camera Error:", err);
    status.textContent = "Camera Error: " + err.message;
    // Add a cancel button even on hard error so user isn't stuck
    const errBtn = document.createElement("button");
    errBtn.className = "cancel-link";
    errBtn.innerText = "CLOSE";
    errBtn.onclick = () => overlay.style.display = "none";
    modal.appendChild(errBtn);
  }
}

async function verifyPin(appid, appname, pin) {
  if (!pin) {
    alert("Please enter a PIN.");
    return;
  }

  const res = await fetchJson("/api/verify-pin", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ pin, appid })
  });

  if (res && res.status === "success") {
    document.getElementById("faceScanOverlay").style.display = "none";
    launchRequest(appid, appname);
  } else {
    alert("Incorrect PIN. Please try again.");
    document.getElementById("pinInput").value = ""; // Clear input on fail
  }
}



async function launchRequest(appid, appname) {
  const launchRes = await fetchJson(LAUNCH_API, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ app: appid })
  });

  if (launchRes && launchRes.status === "ok") {
    document.getElementById("appsStatus").textContent = `Launched ${appname}`;
  } else {
    alert(`Launched: ${appname}`);
  }
}

// search + refresh wiring
document.addEventListener("DOMContentLoaded", () => {
  const search = document.getElementById("appsSearch");
  const refresh = document.getElementById("refreshApps");

  loadApps();

  refresh.onclick = () => loadApps();

  search.addEventListener("input", () => {
    const q = search.value.toLowerCase();
    const cards = Array.from(document.querySelectorAll(".app-card"));
    cards.forEach(c => {
      const name = c.querySelector(".app-name").textContent.toLowerCase();
      c.style.display = name.includes(q) ? "" : "none";
    });
  });
});
const closeBtn = document.getElementById("closeScan");
if (closeBtn) {
  closeBtn.onclick = () => {
    const overlay = document.getElementById("faceScanOverlay");
    const video = document.getElementById("webcam");
    
    // Stop camera if it's running
    if (video.srcObject) {
      video.srcObject.getTracks().forEach(track => track.stop());
    }
    overlay.style.display = "none";
  };
} 
// export so other scripts can call it if needed
window.openApp = openApp;
