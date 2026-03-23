// mobile_index.js — Enhanced Cyber Mode with Stats and Features
console.log("🚀 Cyber Lock Enhanced v2.0 loaded");

// ---------- Global Variables ----------
let activityLog = [];
let currentUser = null;

// ---------- Boot Sequence ----------
(function boot(){
  const bootScreen = document.getElementById("bootScreen");
  const bootBar = document.getElementById("bootBar");
  if(!bootScreen) return;

  let p = 0;
  const steps = [
    "Checking camera",
    "Loading face model",
    "Initializing locked apps",
    "Securing local storage",
    "Loading user data",
    "Ready"
  ];

  const tick = setInterval(()=>{
    p += Math.floor(Math.random()*12) + 6;
    if(p > 100) p = 100;
    bootBar.style.width = p + "%";

    const sub = document.querySelector(".boot-sub");
    if(sub) sub.textContent = steps[Math.floor(p / (100 / steps.length))] || "Ready";

    if(p >= 100){
      clearInterval(tick);
      setTimeout(()=> {
        bootScreen.style.transition = "opacity 500ms ease, transform 600ms ease";
        bootScreen.style.opacity = 0;
        bootScreen.style.transform = "translateY(-14px) scale(0.996)";
        setTimeout(()=> bootScreen.remove(), 700);
      }, 400);
    }
  }, 160);
})();

// ---------- Background Matrix Effect ----------
(function bg() {
  const canvas = document.getElementById("bgCanvas");
  if(!canvas) return;
  const ctx = canvas.getContext("2d");
  function resize(){
    canvas.width = innerWidth;
    canvas.height = innerHeight;
  }
  addEventListener("resize", resize);
  resize();

  const cols = Math.floor(canvas.width / 18);
  const drops = new Array(cols).fill(0).map(()=>Math.random()*canvas.height);

  function frame(){
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.fillRect(0,0,canvas.width,canvas.height);

    const g = ctx.createLinearGradient(0,0,canvas.width,canvas.height);
    g.addColorStop(0, "rgba(0,230,255,0.03)");
    g.addColorStop(0.5, "rgba(0,255,120,0.02)");
    g.addColorStop(1, "rgba(255,43,43,0.03)");
    ctx.fillStyle = g;
    ctx.fillRect(0,0,canvas.width,canvas.height);

    ctx.font = "12px monospace";
    for(let i=0;i<cols;i++){
      const x = i * 18;
      drops[i] += Math.random()*8;
      if(drops[i] > canvas.height) drops[i] = Math.random()*40;
      ctx.fillStyle = i%3===0 ? "rgba(0,230,255,0.12)" : "rgba(255,43,43,0.08)";
      ctx.fillText(Math.random()>0.5 ? "1" : "0", x, drops[i]);
    }

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();

// ---------- DOM Elements ----------
const enrollBtn = document.getElementById("enrollBtn");
const unlockBtn = document.getElementById("unlockBtn");
const bootAgainBtn = document.getElementById("bootAgainBtn");
const activityLogEl = document.getElementById("activityLog");
const userNameEl = document.getElementById("userName");
const userEmailEl = document.getElementById("userEmail");
const camStatus = document.getElementById("camStatus");
const modelStatus = document.getElementById("modelStatus");
const createPinBtn = document.getElementById("createPinBtn");
const themeToggle = document.getElementById("themeToggle");
const refreshStatsBtn = document.getElementById("refreshStatsBtn");

// ---------- Helper Functions ----------
function pushActivity(text, type = "info") {
  const timestamp = new Date().toLocaleTimeString();
  const activity = { timestamp, text, type };
  activityLog.unshift(activity);
  
  // Keep only last 20 activities
  if (activityLog.length > 20) activityLog.pop();
  
  // Update UI
  if (activityLogEl) {
    if (activityLogEl.firstChild && activityLogEl.firstChild.textContent === "No recent activity") {
      activityLogEl.innerHTML = "";
    }
    
    const el = document.createElement("div");
    el.className = "act";
    el.style.cssText = `
      padding: 8px;
      border-left: 3px solid ${type === 'error' ? '#ff4444' : '#ff2b2b'};
      margin-bottom: 5px;
      font-size: 11px;
      animation: fadeIn 0.3s ease;
    `;
    el.innerHTML = `<span style="color: #00e6ff;">[${timestamp}]</span> ${text}`;
    activityLogEl.prepend(el);
  }
  
  console.log(`[${timestamp}] ${text}`);
}

function showError(message) {
  pushActivity(`❌ ${message}`, "error");
  const statusDiv = document.getElementById("unlockMsg") || document.createElement("div");
  if (statusDiv.tagName === "DIV") {
    statusDiv.style.color = "#ff4444";
    statusDiv.textContent = message;
    setTimeout(() => {
      if (statusDiv.textContent === message) statusDiv.textContent = "";
    }, 3000);
  }
}

function showSuccess(message) {
  pushActivity(`✅ ${message}`, "success");
}

// ---------- Load Statistics ----------
async function loadStatistics() {
  try {
    const res = await fetch("/api/list_users");
    const data = await res.json();
    
    if (data.status === "ok") {
      const users = data.users || [];
      const totalUsers = users.length;
      const faceEnrolled = users.filter(u => u.face_enrolled).length;
      
      if (totalUsersEl) totalUsersEl.textContent = totalUsers;
      if (faceEnrolledEl) faceEnrolledEl.textContent = faceEnrolled;
      
      // Update face status indicator
      if (faceStatus) {
        if (faceEnrolled > 0) {
          faceStatus.className = "dot ok";
          faceDataStatus.textContent = `${faceEnrolled} user(s) enrolled`;
        } else {
          faceStatus.className = "dot warn";
          faceDataStatus.textContent = "No face data";
        }
      }
      
      // Update last access (from localStorage)
      const lastAccess = localStorage.getItem("lastAccess");
      if (lastAccess && lastAccessEl) {
        const date = new Date(parseInt(lastAccess));
        lastAccessEl.textContent = date.toLocaleTimeString();
      } else if (lastAccessEl) {
        lastAccessEl.textContent = "First visit";
      }
    }
  } catch (error) {
    console.error("Error loading stats:", error);
  }
}

// ---------- Load User Info ----------
// Update the loadUserInfo function to use the new elements
async function loadUserInfo() {
  try {
    const storedUser = localStorage.getItem("currentUser");
    const storedEmail = localStorage.getItem("userEmail");
    
    // Update user name in multiple places
    if (storedUser && userNameEl) {
      userNameEl.textContent = storedUser;
      
      // Update the new user name line
      const userNameLine = document.getElementById("userNameLine");
      if (userNameLine) userNameLine.textContent = storedUser;
      
      // Update avatar
      const userAvatarLarge = document.getElementById("userAvatarLarge");
      if (userAvatarLarge) {
        userAvatarLarge.style.display = "flex";
        userAvatarLarge.textContent = storedUser.charAt(0).toUpperCase();
      }
    }
    
    // Update email line
    if (storedEmail && userEmailEl) {
      userEmailEl.textContent = storedEmail;
      
      const userEmailLine = document.getElementById("userEmailLine");
      if (userEmailLine) userEmailLine.textContent = storedEmail;
    }
    
    // Rest of the function remains the same...
  } catch (error) {
    console.error("Error loading user info:", error);
  }
}

// ---------- Navigation Handlers ----------
enrollBtn?.addEventListener("click", () => {
  pushActivity("Navigate: Enroll Flow");
  setTimeout(()=> location.href = "/mobile/enroll", 180);
});

unlockBtn?.addEventListener("click", () => {
  pushActivity("Navigate: Unlock Flow");
  setTimeout(()=> location.href = "/mobile/unlock", 180);
});

bootAgainBtn?.addEventListener("click", () => {
  pushActivity("Rebooting system...");
  setTimeout(()=> location.reload(), 200);
});

refreshStatsBtn?.addEventListener("click", async () => {
  pushActivity("Refreshing statistics...");
  await loadStatistics();
  showSuccess("Statistics refreshed");
});

clearActivityBtn?.addEventListener("click", () => {
  activityLog = [];
  if (activityLogEl) {
    activityLogEl.innerHTML = '<div class="act">No recent activity</div>';
  }
  pushActivity("Activity log cleared");
});

// ---------- Theme Toggle ----------
let themeMode = 0;
themeToggle?.addEventListener("click", ()=>{
  themeMode = (themeMode + 1) % 3;
  if(themeMode === 0){
    document.documentElement.style.setProperty("--accent-cyan", "#00e6ff");
    document.documentElement.style.setProperty("--accent-red", "#ff2b2b");
    pushActivity("Theme: Hybrid (default)");
  } else if(themeMode === 1){
    document.documentElement.style.setProperty("--accent-cyan", "#5af0b0");
    document.documentElement.style.setProperty("--accent-red", "#ff7b7b");
    pushActivity("Theme: Blue Hologram");
  } else {
    document.documentElement.style.setProperty("--accent-cyan", "#7dff8a");
    document.documentElement.style.setProperty("--accent-red", "#ff2b2b");
    pushActivity("Theme: Green Matrix");
  }
});

// ---------- Status Update ----------
(async function statusUpdate(){
  camStatus && (camStatus.textContent = "✅ Available");
  modelStatus && (modelStatus.textContent = "✅ Loaded");
  pushActivity("System ready");
  
  // Check if user has face enrolled
  const storedUser = localStorage.getItem("currentUser");
  if (storedUser) {
    try {
      const res = await fetch("/api/list_users");
      const data = await res.json();
      const user = data.users?.find(u => u.username === storedUser);
      if (user && user.face_enrolled) {
        pushActivity(`Welcome back ${storedUser}! Face data found.`);
      } else if (user) {
        pushActivity(`Welcome ${storedUser}! Please enroll your face.`);
      }
    } catch(e) {}
  }
})();

// ---------- PIN Existence Check ----------
async function checkPinExistsAndUpdateUI() {
  try {
    const response = await fetch("/api/pin_exists");
    const data = await response.json();
    
    if (createPinBtn) {
      if (data.exists) {
        createPinBtn.style.display = "none";
        pushActivity("PIN already set");
      } else {
        createPinBtn.style.display = "block";
        pushActivity("No PIN found. Please create one.");
      }
    }
    return data.exists;
  } catch (error) {
    console.error("Error checking PIN:", error);
    if (createPinBtn) createPinBtn.style.display = "block";
    return false;
  }
}

// ---------- Create PIN Button ----------
createPinBtn?.addEventListener("click", () => {
  pushActivity("Navigate: Create PIN");
  window.location.href = "/create_pin";
});

// ---------- Reset PIN Popup ----------
const resetPinPopup = document.getElementById("resetPinPopup");
const resetSaveBtn = document.getElementById("resetSaveBtn");
const resetPin = document.getElementById("resetPin");
const resetPin2 = document.getElementById("resetPin2");
const resetError = document.getElementById("resetError");

window.openResetPassword = function() {
  if (resetPinPopup) resetPinPopup.classList.remove("hidden");
}

if (resetSaveBtn) {
  resetSaveBtn.onclick = async () => {
    let p1 = resetPin?.value;
    let p2 = resetPin2?.value;

    if (p1 !== p2) {
      if (resetError) resetError.classList.remove("hidden");
      return;
    }

    if (!p1 || p1.length !== 4 || !/^\d{4}$/.test(p1)) {
      showError("PIN must be exactly 4 digits");
      return;
    }

    try {
      await fetch("/api/reset_main_pin", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ pin: p1 })
      });

      showSuccess("PIN reset successfully!");
      if (resetPinPopup) resetPinPopup.classList.add("hidden");
      setTimeout(() => location.reload(), 1500);
    } catch (error) {
      showError("Failed to reset PIN");
    }
  };
}

// ---------- Create PIN Popup ----------
const createPinPopup = document.getElementById("createPinPopup");
const newPin = document.getElementById("newPin");
const confirmPin = document.getElementById("confirmPin");
const pinError = document.getElementById("pinError");
const savePinBtn = document.getElementById("savePinBtn");

// Restrict PIN inputs to 4 digits
[newPin, confirmPin, resetPin, resetPin2].forEach(input => {
  if (input) {
    input.addEventListener("input", () => {
      input.value = input.value.replace(/\D/g, "");
      if (input.value.length > 4) input.value = input.value.slice(0, 4);
    });
  }
});

// Initialize
document.addEventListener("DOMContentLoaded", async () => {
  const pinExists = await checkPinExistsAndUpdateUI();
  
  if (createPinPopup) {
    if (!pinExists) {
      createPinPopup.classList.remove("hidden");
      pushActivity("First time setup - Create your PIN");
    } else {
      createPinPopup.classList.add("hidden");
    }
  }
  
  if (savePinBtn) {
    savePinBtn.onclick = async () => {
      let p1 = newPin?.value;
      let p2 = confirmPin?.value;

      if (p1 !== p2) {
        if (pinError) pinError.classList.remove("hidden");
        return;
      }

      if (!p1 || p1.length !== 4 || !/^\d{4}$/.test(p1)) {
        showError("PIN must be exactly 4 digits");
        return;
      }

      try {
        const response = await fetch("/api/create_pin", {
          method: "POST",
          headers: {"Content-Type":"application/json"},
          body: JSON.stringify({ pin: p1 })
        });
        
        const data = await response.json();
        
        if (response.ok) {
          showSuccess("PIN created successfully!");
          if (createPinPopup) createPinPopup.classList.add("hidden");
          if (createPinBtn) createPinBtn.style.display = "none";
          pushActivity("PIN created successfully");
          setTimeout(() => location.reload(), 1000);
        } else {
          showError(data.msg || "Failed to create PIN");
        }
      } catch (error) {
        showError("Failed to create PIN");
      }
    };
  }
  
  // Load all data
  await loadStatistics();
  await loadUserInfo();
  
  // Store access time
  localStorage.setItem("lastAccess", Date.now().toString());
  pushActivity("Dashboard loaded");
});

// ---------- Keyboard Shortcuts ----------
addEventListener("keydown", (e)=>{
  if(e.key === "e") enrollBtn?.click();
  if(e.key === "u") unlockBtn?.click();
  if(e.key === "r") window.openResetPassword?.();
  if(e.key === "s") refreshStatsBtn?.click();
});

// ---------- Neon Ring Pulse ----------
(function ringPulse(){
  const ring = document.getElementById("neonRing");
  if(!ring) return;
  setInterval(()=> ring.animate([{ transform:"scale(1)" }, { transform:"scale(1.04)" }, { transform:"scale(1)" }], { duration: 1400 }), 1600);
})();

// ---------- App Open Handler ----------
async function openApp(appid, appname, icon) {
  const res = await fetch("/api/is_app_locked", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ appid })
  }).then(r => r.json());

  if (res.locked === true) {
    window.location.href = `/mobile/open-app?name=${encodeURIComponent(appname)}&id=${encodeURIComponent(appid)}&icon=${encodeURIComponent(icon)}`;
    return;
  }

  launchAppNormally(appname);
}

function launchAppNormally(appname) {
  pushActivity(`Launching app: ${appname}`);
  alert(`Opening app: ${appname}`);
}

window.openApp = openApp;
window.launchAppNormally = launchAppNormally;