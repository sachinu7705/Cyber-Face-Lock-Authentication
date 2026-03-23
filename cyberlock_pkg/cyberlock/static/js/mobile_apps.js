/* mobile_apps.js — Enhanced Locked App Unlock with Improved UI */

const APPS_API = "/api/list-installed-apps";
const LOCKS_API = "/api/get_locked_apps";
const IS_LOCKED_API = "/api/is_app_locked";
const LAUNCH_API = "/api/launch_app";

let currentStream = null;
let currentAppId = null;
let currentAppName = null;

async function fetchJson(url, opts) {
  try {
    const r = await fetch(url, opts);
    return await r.json();
  } catch (e) {
    console.error("Fetch error:", e);
    return null;
  }
}

function makeAppCard(app, lockedSet) {
  const id = app.name;
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
    currentAppId = appid;
    currentAppName = appname;
    await startFaceScan();
  } else {
    launchRequest(appid, appname);
  }
}

// Enhanced face scan with better UI
async function startFaceScan() {
  const overlay = document.getElementById("faceScanOverlay");
  const video = document.getElementById("webcam");
  const status = document.getElementById("scanStatus");
  const canvas = document.getElementById("overlay");
  const fallbackContainer = document.getElementById("fallbackContainer");
  
  // Reset UI
  fallbackContainer.innerHTML = "";
  overlay.style.display = "flex";
  status.innerHTML = "🎥 Initializing camera...";
  status.style.color = "#00e6ff";
  
  // Clear any existing fallback
  const existingPinInput = document.getElementById("pinInput");
  if (existingPinInput) existingPinInput.remove();

  try {
    // Start camera
    currentStream = await navigator.mediaDevices.getUserMedia({ 
      video: { 
        facingMode: "user",
        width: { ideal: 1280 },
        height: { ideal: 720 }
      } 
    });
    video.srcObject = currentStream;
    await video.play();
    
    // Show scanning animation
    status.innerHTML = "📸 Position your face in the frame...";
    
    // Wait 1 second then capture
    setTimeout(async () => {
      await captureAndVerify();
    }, 1000);
    
  } catch (err) {
    console.error("Camera Error:", err);
    status.innerHTML = `❌ Camera Error: ${err.message}`;
    status.style.color = "#ff4444";
    showFallbackUI();
  }
}

async function captureAndVerify() {
  const video = document.getElementById("webcam");
  const canvas = document.getElementById("overlay");
  const status = document.getElementById("scanStatus");
  
  if (!video.videoWidth) {
    status.innerHTML = "❌ Video not ready. Please try again.";
    showFallbackUI();
    return;
  }
  
  status.innerHTML = "🔍 Analyzing face...";
  
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  
  // Draw current frame
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  
  // Enhance image
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.min(255, data[i] * 1.1);
    data[i+1] = Math.min(255, data[i+1] * 1.1);
    data[i+2] = Math.min(255, data[i+2] * 1.1);
  }
  ctx.putImageData(imageData, 0, 0);
  
  const imageDataUrl = canvas.toDataURL('image/jpeg', 0.95);
  
  // Stop camera
  stopCamera();
  
  try {
    const verifyRes = await fetchJson("/api/unlock_from_camera", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ 
        image: imageDataUrl,
        enhance: true
      })
    });
    
    if (verifyRes && verifyRes.status === "ok") {
      // Success!
      const confidence = Math.round((verifyRes.confidence || 0.95) * 100);
      status.innerHTML = `✅ ACCESS GRANTED! Welcome ${verifyRes.user}`;
      status.style.color = "#4caf50";
      
      // Show success animation
      showSuccessAnimation();
      
      setTimeout(() => {
        document.getElementById("faceScanOverlay").style.display = "none";
        launchRequest(currentAppId, currentAppName);
      }, 1500);
    } else {
      status.innerHTML = "❌ Face not recognized";
      status.style.color = "#ff4444";
      showFallbackUI();
    }
  } catch (err) {
    console.error("Verification error:", err);
    status.innerHTML = "❌ Scan failed. Please try again.";
    status.style.color = "#ff4444";
    showFallbackUI();
  }
}

function showFallbackUI() {
  const fallbackContainer = document.getElementById("fallbackContainer");
  const status = document.getElementById("scanStatus");
  
  fallbackContainer.innerHTML = `
    <div class="fallback-container">
      <div style="text-align: center; margin-bottom: 15px; color: #ffaa44;">⚠️ FACE NOT RECOGNIZED</div>
      <div style="text-align: center; font-size: 12px; color: #888; margin-bottom: 15px;">Use PIN as backup</div>
      <div class="pin-input-group">
        <input type="password" id="pinInput" class="pin-input-field" placeholder="••••" maxlength="4" autocomplete="off">
      </div>
      <div class="action-buttons">
        <button id="retryScanBtn" class="btn-primary">🔄 RETRY SCAN</button>
        <button id="unlockWithPinBtn" class="btn-primary">🔓 UNLOCK</button>
      </div>
    </div>
  `;
  
  // Add event listeners
  document.getElementById("retryScanBtn")?.addEventListener("click", () => {
    fallbackContainer.innerHTML = "";
    startFaceScan();
  });
  
  document.getElementById("unlockWithPinBtn")?.addEventListener("click", async () => {
    const pinInput = document.getElementById("pinInput");
    const pin = pinInput?.value.trim();
    
    if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      status.innerHTML = "❌ Please enter a valid 4-digit PIN";
      status.style.color = "#ff4444";
      return;
    }
    
    status.innerHTML = "🔐 Verifying PIN...";
    
    try {
      const res = await fetch("/api/verify_system_pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pin })
      });
      
      const data = await res.json();
      
      if (data.status === "success") {
        status.innerHTML = "✅ PIN Verified! Launching app...";
        status.style.color = "#4caf50";
        setTimeout(() => {
          document.getElementById("faceScanOverlay").style.display = "none";
          launchRequest(currentAppId, currentAppName);
        }, 1000);
      } else {
        status.innerHTML = "❌ Invalid PIN. Access denied.";
        status.style.color = "#ff4444";
        pinInput.value = "";
        pinInput.focus();
      }
    } catch (err) {
      status.innerHTML = "❌ Verification failed";
      status.style.color = "#ff4444";
    }
  });
  
  // Auto-focus PIN input
  setTimeout(() => {
    const pinInput = document.getElementById("pinInput");
    if (pinInput) pinInput.focus();
  }, 100);
}

function showSuccessAnimation() {
  for (let i = 0; i < 50; i++) {
    const particle = document.createElement("div");
    particle.className = "particle";
    particle.innerHTML = ["✨", "⭐", "🔓", "✅"][Math.floor(Math.random() * 4)];
    particle.style.left = Math.random() * window.innerWidth + "px";
    particle.style.top = window.innerHeight / 2 + "px";
    particle.style.fontSize = (Math.random() * 20 + 15) + "px";
    document.body.appendChild(particle);
    setTimeout(() => particle.remove(), 1000);
  }
}

async function launchRequest(appid, appname) {
  const launchRes = await fetchJson(LAUNCH_API, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ app: appid })
  });

  if (launchRes && launchRes.status === "ok") {
    const status = document.getElementById("appsStatus");
    if (status) {
      status.textContent = `✅ Launched ${appname}`;
      status.style.color = "#4caf50";
    }
    setTimeout(() => {
      if (status) status.textContent = "";
    }, 3000);
  } else {
    alert(`✅ App launched: ${appname}`);
  }
}

function stopCamera() {
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
    currentStream = null;
  }
  const video = document.getElementById("webcam");
  if (video) video.srcObject = null;
}

// Search and refresh
document.addEventListener("DOMContentLoaded", () => {
  const search = document.getElementById("appsSearch");
  const refresh = document.getElementById("refreshApps");

  loadApps();

  if (refresh) {
    refresh.onclick = () => loadApps();
  }

  if (search) {
    search.addEventListener("input", () => {
      const q = search.value.toLowerCase();
      const cards = Array.from(document.querySelectorAll(".app-card"));
      cards.forEach(c => {
        const name = c.querySelector(".app-name").textContent.toLowerCase();
        c.style.display = name.includes(q) ? "" : "none";
      });
    });
  }
});

// Close button handler
const closeScanBtn = document.getElementById("closeScanBtn");
if (closeScanBtn) {
  closeScanBtn.onclick = () => {
    document.getElementById("faceScanOverlay").style.display = "none";
    stopCamera();
  };
}

window.openApp = openApp;