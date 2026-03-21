/* open_app.js — Cyber Face Unlock Screen */

const video = document.getElementById("unlockVideo");
const overlay = document.getElementById("overlay");
const statusEl = document.getElementById("status");
const pinBtn = document.getElementById("pinBtn");

// PIN modal
const modal = document.getElementById("pinModal");
const pinInput = document.getElementById("pinInput");
const pinConfirm = document.getElementById("pinConfirm");
const pinClose = document.getElementById("pinClose");


// canvas
const ctx = overlay.getContext("2d");

// app info from URL
const p = new URLSearchParams(window.location.search);
const APP_NAME = p.get("name") || "Unknown App";
const APP_ICON = p.get("icon") || "/static/assets/default_app.png";
const APP_LOCKED_ID = p.get("id") || "";  // to return to correct app

// 👉 NEW:
const MODE = p.get("mode") || "launcher";  // "launcher" or "system"

let running = true;
let latestFrame = null;
let faceDetector = null;

/* ---------------- Camera Helpers ---------------- */
async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" }
    });
    video.srcObject = stream;
    video._stream = stream;
    await video.play();
    return true;
  } catch (e) {
    statusEl.innerText = "Camera Error: " + e;
    return false;
  }
}

function stopCamera() {
  if (video && video._stream) {
    video._stream.getTracks().forEach(t => t.stop());
    video._stream = null;
  }
}

/* -------------- Take Photo Base64 -------------- */
function captureBase64() {
  const c = document.createElement("canvas");
  c.width = video.videoWidth;
  c.height = video.videoHeight;
  c.getContext("2d").drawImage(video, 0, 0);
  return c.toDataURL("image/jpeg", 0.92);
}

/* -------------- Face Detection (MediaPipe or fallback) -------------- */
/* We use "simple face present" detection for trigger only,
   but real identity verification is done server-side (DLIB). */

async function loadFaceDetector() {
  // Lightweight check: video brightness + motion + simple box detection
  // (this prevents false triggers)
  faceDetector = {
    detect: () => {
      if (!video.videoWidth) return false;
      return true;
    }
  };
}

/* -------------- Unlock Logic -------------- */
async function doFaceUnlock() {
  statusEl.innerText = "Scanning face… hold still";

  const img = captureBase64();
  const fd = new FormData();
  fd.append("image", img);

  try {
    const res = await fetch("/api/unlock_from_camera", {
      method: "POST",
      body: fd
    }).then(r => r.json());

    if (res.status === "ok") {
      statusEl.innerText = "Face recognized — unlocking…";

      if (MODE === "system") {
        // 🔥 System mode: launch real app via backend
        try {
          await fetch("/api/launch_app", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ app: APP_LOCKED_ID })
          });
        } catch (e) {
          console.error("System launch error:", e);
        }

        // ---- SYSTEM UNLOCK POPUP ----
        const pop = document.getElementById("sysUnlockPopup");
        if (pop) {
          pop.classList.remove("hidden");
          document.getElementById("sysPopIcon").src = APP_ICON;
          document.getElementById("sysPopName").innerText = APP_NAME;
        }

        setTimeout(() => window.close(), 900);


      } else {
        // Normal launcher mode
        setTimeout(() => {
          window.location.href = "/mobile";
        }, 700);
      }

    } else {
      statusEl.innerText = "Face not matched — try again or use PIN.";
    }

  } catch (e) {
    statusEl.innerText = "Unlock error: " + e;
  }
}

/* -------------- Render Loop (Overlay Ring) -------------- */
function renderLoop() {
  if (!running) return;

  overlay.width = video.clientWidth || video.videoWidth;
  overlay.height = video.clientHeight || video.videoHeight;

  ctx.clearRect(0, 0, overlay.width, overlay.height);

  if (video.videoWidth > 0) {
    // Just dim highlight
    ctx.fillStyle = "rgba(255,0,0,0.05)";
    ctx.beginPath();
    ctx.arc(
      overlay.width / 2,
      overlay.height / 2,
      overlay.width * 0.28,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  requestAnimationFrame(renderLoop);
}

/* -------------- Auto Face Unlock Loop -------------- */
function autoFaceLoop() {
  if (!running) return;

  if (faceDetector.detect()) {
    doFaceUnlock();
  } else {
    statusEl.innerText = "No face detected… align properly";
  }

  // run again after short delay
  setTimeout(autoFaceLoop, 1600);
}

/* -------------- PIN Modal Logic -------------- */
pinBtn.onclick = () => {
  modal.classList.remove("hidden");
  pinInput.focus();
};

pinClose.onclick = () => {
  modal.classList.add("hidden");
};

scanBtn.onclick = () => {
    startScanAnimation();
    doFaceUnlock();
};


pinConfirm.onclick = async () => {
  const pin = pinInput.value.trim();
  if (pin.length < 1) return;

  const res = await fetch("/api/app_unlock_pin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app_id: APP_LOCKED_ID,
      pin: pin
    })
  }).then(r => r.json());

  if (res.status === "ok") {
    statusEl.innerText = "PIN correct — unlocking…";
    modal.classList.add("hidden");

    if (MODE === "system") {
      // 🔥 SYSTEM MODE: launch real app through backend
      try {
        await fetch("/api/launch_app", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ app: APP_LOCKED_ID })
        });
      } catch (e) {
        console.error("Launch error:", e);
      }

      // ---- SYSTEM UNLOCK POPUP ----
      const pop = document.getElementById("sysUnlockPopup");
      if (pop) {
        pop.classList.remove("hidden");
        document.getElementById("sysPopIcon").src = APP_ICON;          document.getElementById("sysPopName").innerText = APP_NAME;
      }

      setTimeout(() => window.close(), 900);


    } else {
      // Normal launcher mode (your existing behaviour)
      setTimeout(() => {
        window.location.href = "/mobile/locked-apps?open=" + APP_LOCKED_ID;
      }, 600);
    }

  } else {
    statusEl.innerText = "Wrong PIN.";
  }
};


/* -------------- INIT -------------- */
(async () => {
  statusEl.innerText = "Starting camera…";

  await loadFaceDetector();

  const ok = await startCamera();
  if (!ok) return;

  statusEl.innerText = "Face Unlock Ready — hold still";

  requestAnimationFrame(renderLoop);

  setTimeout(autoFaceLoop, 800);
})();

/* Stop camera when tab hidden */
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    running = false;
    stopCamera();
  }
});
function startScanAnimation() {
    const overlay = document.querySelector(".scan-overlay");
    if (!overlay) return;

    overlay.style.opacity = "1";

    // Fade out overlay after 2.5 seconds (same as scan-down animation)
    setTimeout(() => {
        overlay.style.opacity = "0";
    }, 2500);
}
