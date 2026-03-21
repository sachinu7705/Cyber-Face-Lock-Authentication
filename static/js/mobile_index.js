// mobile_index.js — INSANE CYBER MODE behavior
console.log("mobile_index.js loaded");

// ---------- simple boot sequence ----------
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
    "Ready"
  ];

  const tick = setInterval(()=>{
    p += Math.floor(Math.random()*12) + 6;
    if(p > 100) p = 100;
    bootBar.style.width = p + "%";

    // occasionally update subtitle
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

// ---------- background energy (matrix + glow) ----------
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

    // red/blue gradient glow
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

// ---------- quick DOM helpers ----------
const q = sel => document.querySelector(sel);
const qAll = sel => Array.from(document.querySelectorAll(sel));

// ---------- elements ----------
const enrollBtn = document.getElementById("enrollBtn");
const unlockBtn = document.getElementById("unlockBtn");
const lockedAppsBtn = document.getElementById("lockedAppsBtn");
const selectAppsBtn = document.getElementById("selectAppsBtn");
const changePinBtn = document.getElementById("changePinBtn");
const resetPinBtn = document.getElementById("resetPinBtn");
const openMenuBtn = document.getElementById("openMenuBtn");
const bootAgainBtn = document.getElementById("bootAgainBtn");
const activityLog = document.getElementById("activityLog");
const userNameEl = document.getElementById("userName");
const camStatus = document.getElementById("camStatus");
const modelStatus = document.getElementById("modelStatus");

// fallback checks
if(!enrollBtn || !unlockBtn) {
  console.warn("core buttons missing — are you on index page?");
}

// ---------- record activity ----------
function pushActivity(text){
  const el = document.createElement("div"); el.className = "act"; el.textContent = `${new Date().toLocaleTimeString()} — ${text}`;
  if(activityLog.firstChild && activityLog.firstChild.textContent === "No recent activity") activityLog.innerHTML = "";
  activityLog.prepend(el);
}

// ---------- navigation actions (uses your existing endpoints) ----------
enrollBtn && enrollBtn.addEventListener("click", ()=> {
  pushActivity("Navigate: Enroll Flow");
  // small burst animation
  enrollBtn.animate([{ transform: "scale(1)" }, { transform:"scale(0.96)" }, { transform:"scale(1)" }], { duration: 380 });
  setTimeout(()=> location.href = "/mobile/enroll", 260);
});

unlockBtn && unlockBtn.addEventListener("click", ()=> {
  pushActivity("Navigate: Unlock Flow");
  unlockBtn.animate([{ transform: "scale(1)" }, { transform:"scale(0.98)" }, { transform:"scale(1)" }], { duration: 280 });
  setTimeout(()=> location.href = "/mobile/unlock", 180);
});



bootAgainBtn && bootAgainBtn.addEventListener("click", ()=> {
  // simply re-run the small boot animation by creating overlay again
  const existing = document.querySelector(".boot-screen");
  if(existing) existing.remove();
  location.reload();
});

// ---------- theme toggle (cycles colors) ----------
const themeToggle = document.getElementById("themeToggle");
let themeMode = 0;
themeToggle && themeToggle.addEventListener("click", ()=>{
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

// ---------- status updater (mock: uses local resources) ----------
(function statusMock(){
  camStatus && (camStatus.textContent = "Available");
  modelStatus && (modelStatus.textContent = "OK");
  pushActivity("System ready");
})();

// ---------- accessibility: keyboard shortcuts ----------
addEventListener("keydown", (e)=>{
  if(e.key === "e") enrollBtn && enrollBtn.click();
  if(e.key === "u") unlockBtn && unlockBtn.click();
  if(e.key === "l") lockedAppsBtn && lockedAppsBtn.click();
});

// ---------- small UX polish: neon ring pulse ----------
(function ringPulse(){
  const ring = document.getElementById("neonRing");
  if(!ring) return;
  setInterval(()=> ring.animate([{ transform:"scale(1)" }, { transform:"scale(1.04)" }, { transform:"scale(1)" }], { duration: 1400 }), 1600);
})();

// ---------- load user name from config if exists ----------
(function loadUser(){
  try {
    const u = localStorage.getItem("cyber_user") || "Guest";
    userNameEl.textContent = u;
  } catch(e){}
})();

// ---------- network ping to server (keeps alive) ----------
(function ping(){
  setInterval(()=>{
    fetch("/api/get_apps/default").catch(()=>{/* ignore */});
  }, 30_000);
})();


document.addEventListener("DOMContentLoaded", async () => {
  
  const exists = await fetch("/api/pin_exists").then(r=>r.json());
  fetch("/api/pin_exists")
  .then(res => res.json())
  .then(data => {
      const createBtn = document.getElementById("createPinBtn");

      if (data.exists) {
          // ❌ Hide create button
          createBtn.style.display = "none";
      } else {
          // ✅ Show create button
          createBtn.style.display = "block";
      }
  });
  // Show create password popup if no PIN exists
  if (!exists.exists) {
      document.getElementById("createPinPopup").classList.remove("hidden");
  }

  // SAVE NEW PIN
  document.getElementById("savePinBtn").onclick = async () => {
      let p1 = newPin.value;
      let p2 = confirmPin.value;

      if (p1 !== p2) {
          pinError.classList.remove("hidden");
          return;
      }

      await fetch("/api/create_pin", {
          method: "POST",
          headers: {"Content-Type":"application/json"},
          body: JSON.stringify({ pin: p1 })
      });

      location.reload();
  };
  document.getElementById("createPinBtn")?.addEventListener("click", () => {
      window.location.href = "/create_pin"; 
  }); 
  // RESET PIN FROM HOME PAGE BUTTON
  window.openResetPassword = function() {
      document.getElementById("resetPinPopup").classList.remove("hidden");
  }

  resetSaveBtn.onclick = async () => {
      let p1 = resetPin.value;
      let p2 = resetPin2.value;

      if (p1 !== p2) {
          resetError.classList.remove("hidden");
          return;
      }

      await fetch("/api/reset_main_pin", {
          method: "POST",
          headers: {"Content-Type":"application/json"},
          body: JSON.stringify({ pin: p1 })
      });

      alert("Password Reset Successfully!");
      location.reload();
  };

});
// =========================================================
// FINAL APP OPEN HANDLER (LOCK CHECK + REDIRECT TO FACE)
// =========================================================

// This function will be used by your app tiles/buttons
// Example: <div onclick="openApp('chrome','Chrome','icon.png')">

async function openApp(appid, appname, icon) {

    // 1) Ask backend if app is locked
    const res = await fetch("/api/is_app_locked", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ appid })
    }).then(r => r.json());

    // 2) If locked → go to face unlock
    if (res.locked === true) {
        window.location.href =
            `/mobile/open-app?name=${encodeURIComponent(appname)}`
            + `&id=${encodeURIComponent(appid)}`
            + `&icon=${encodeURIComponent(icon)}`;
        return;
    }

    // 3) Otherwise open normally
    launchAppNormally(appname);
}


// =========================================================
// Default normal launcher (you can update as you like)
// =========================================================
function launchAppNormally(appname) {
    alert("Opening app normally: " + appname);
    // Here you can launch Linux apps using backend if needed
}
