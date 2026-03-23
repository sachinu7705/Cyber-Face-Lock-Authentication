console.log("mobile_unlock.js loaded");

// ---------------------------------------------------------------------
// ELEMENTS FROM HTML
// ---------------------------------------------------------------------
const video = document.getElementById("unlockVideo");
const pinInput = document.getElementById("unlockPin");
const statusBox = document.getElementById("unlockMsg");
const hudCanvas = document.getElementById("hudCanvas");

const btnStart = document.getElementById("startUnlockCam");
const btnCapture = document.getElementById("captureUnlockBtn");
const btnStop = document.getElementById("stopUnlockCam");

const holo = document.getElementById("holo");
const holoText = document.getElementById("holoText");

let stream = null;

// ---------------------------------------------------------------------
// RESTRICT PIN INPUT TO ONLY 4 DIGITS
// ---------------------------------------------------------------------
if (pinInput) {
    // Restrict input to only digits
    pinInput.addEventListener("input", (e) => {
        // Remove any non-digit characters
        e.target.value = e.target.value.replace(/\D/g, "");
        
        // Limit to 4 digits
        if (e.target.value.length > 4) {
            e.target.value = e.target.value.slice(0, 4);
        }
        
        // Visual feedback when 4 digits entered
        if (e.target.value.length === 4) {
            pinInput.style.borderColor = "#4caf50";
            pinInput.style.boxShadow = "0 0 10px rgba(76, 175, 80, 0.3)";
        } else {
            pinInput.style.borderColor = "";
            pinInput.style.boxShadow = "";
        }
    });
    
    // Auto-submit when 4 digits are entered
    pinInput.addEventListener("keyup", (e) => {
        if (pinInput.value.length === 4 && (e.key !== "Backspace" && e.key !== "Delete")) {
            tryPIN();
        }
    });
}

// ---------------------------------------------------------------------
// START CAMERA
// ---------------------------------------------------------------------
btnStart.onclick = async () => {
    if (stream) {
        console.log("Camera already active.");
        statusBox.textContent = "Camera already active.";
        return;
    }

    try {
        statusBox.textContent = "Requesting camera access...";
        
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }
        });
        
        video.srcObject = stream;

        try {
            await video.play();
            statusBox.textContent = "Camera active. Click 'Retina Scan' to unlock.";
            drawHUD();
        } catch (playError) {
            console.warn("Play interrupted:", playError);
            statusBox.textContent = "Camera ready, but video may need manual play.";
        }
    } 
    catch (e) {
        statusBox.textContent = "Camera access denied. Use PIN instead.";
        console.error("Camera failed:", e);
    }
};

// ---------------------------------------------------------------------
// DRAW HUD OVERLAY
// ---------------------------------------------------------------------
function drawHUD() {
    if (!hudCanvas || !video) return;
    
    const updateHUD = () => {
        if (!hudCanvas || !video) return;
        
        hudCanvas.width = video.clientWidth || video.videoWidth || 640;
        hudCanvas.height = video.clientHeight || video.videoHeight || 480;
        
        const ctx = hudCanvas.getContext('2d');
        if (!ctx) return;
        
        ctx.clearRect(0, 0, hudCanvas.width, hudCanvas.height);
        
        // Draw scanning ring
        const centerX = hudCanvas.width / 2;
        const centerY = hudCanvas.height / 2;
        const radius = Math.min(hudCanvas.width, hudCanvas.height) * 0.35;
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.strokeStyle = '#ff2b2b';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw inner ring
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius - 10, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 43, 43, 0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        // Draw crosshair
        ctx.beginPath();
        ctx.moveTo(centerX - 20, centerY);
        ctx.lineTo(centerX - 5, centerY);
        ctx.moveTo(centerX + 5, centerY);
        ctx.lineTo(centerX + 20, centerY);
        ctx.moveTo(centerX, centerY - 20);
        ctx.lineTo(centerX, centerY - 5);
        ctx.moveTo(centerX, centerY + 5);
        ctx.lineTo(centerX, centerY + 20);
        ctx.stroke();
        
        // Draw scanning animation
        const time = Date.now() / 1000;
        const scanAngle = (time % 2) * Math.PI;
        const scanX = centerX + Math.cos(scanAngle) * radius;
        const scanY = centerY + Math.sin(scanAngle) * radius;
        
        ctx.beginPath();
        ctx.arc(scanX, scanY, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#ff2b2b';
        ctx.fill();
        
        requestAnimationFrame(updateHUD);
    };
    
    updateHUD();
}

// ---------------------------------------------------------------------
// STOP CAMERA
// ---------------------------------------------------------------------
btnStop.onclick = () => {
    if (stream) {
        stream.getTracks().forEach(t => t.stop());
        stream = null;
        video.srcObject = null;
        statusBox.textContent = "Camera stopped.";
        
        if (hudCanvas) {
            const ctx = hudCanvas.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, hudCanvas.width, hudCanvas.height);
        }
    }
};

// ---------------------------------------------------------------------
// CAPTURE & SEND TO SERVER FOR FACE UNLOCK
// ---------------------------------------------------------------------
btnCapture.onclick = async () => {
    if (!stream) {
        statusBox.textContent = "Camera not started. Click 'Start Camera' first.";
        return;
    }
    
    if (!video.videoWidth || !video.videoHeight) {
        statusBox.textContent = "Video not ready. Please wait a moment.";
        return;
    }

    if (holo) {
        holo.classList.remove("hidden");
        holoText.innerText = "SCANNING FACE...";
        holoText.style.color = "";
    }
    statusBox.textContent = "Capturing and analyzing face...";

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const imgData = canvas.toDataURL("image/jpeg", 0.92);

    try {
        const res = await fetch("/api/unlock_from_camera", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: imgData })
        });

        const data = await res.json();

        if (data.status === "ok") {
            holoText.innerText = "ACCESS GRANTED";
            holoText.style.color = "#4caf50";
            statusBox.textContent = `Welcome ${data.user || "User"}! Redirecting...`;
            
            localStorage.setItem("currentUser", data.user || "User");
            
            setTimeout(() => { 
                window.location.href = "/mobile/menu"; 
            }, 1500);
        } else {
            holoText.innerText = "FACE NOT RECOGNIZED";
            holoText.style.color = "#ff4444";
            statusBox.textContent = data.msg || "Face not recognized. Try again or use PIN.";
            
            setTimeout(() => {
                if (holo) holo.classList.add("hidden");
            }, 2000);
        }
    } catch (err) {
        console.error("Face unlock error:", err);
        statusBox.textContent = "Network error during face scan.";
        holoText.innerText = "ERROR";
        
        setTimeout(() => {
            if (holo) holo.classList.add("hidden");
        }, 2000);
    }
};

// ---------------------------------------------------------------------
// PIN FALLBACK UNLOCK - 4 DIGITS ONLY
// ---------------------------------------------------------------------
async function tryPIN() {
    if (!pinInput) {
        console.error("PIN input not found");
        return;
    }
    
    const pin = pinInput.value.trim();
    
    // Validate PIN
    if (!pin) {
        statusBox.textContent = "Please enter a 4-digit PIN.";
        pinInput.classList.add("pin-error");
        setTimeout(() => pinInput.classList.remove("pin-error"), 1000);
        return;
    }
    
    if (pin.length !== 4) {
        statusBox.textContent = "PIN must be exactly 4 digits.";
        pinInput.classList.add("pin-error");
        setTimeout(() => pinInput.classList.remove("pin-error"), 1000);
        pinInput.value = "";
        return;
    }
    
    if (!/^\d{4}$/.test(pin)) {
        statusBox.textContent = "PIN must contain only numbers (0-9).";
        pinInput.classList.add("pin-error");
        setTimeout(() => pinInput.classList.remove("pin-error"), 1000);
        pinInput.value = "";
        return;
    }
    
    statusBox.textContent = "🔐 Verifying PIN...";
    
    try {
        const res = await fetch("/api/verify_system_pin", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pin: pin })
        });
        
        const data = await res.json();
        
        if (data.status === "success") {
            statusBox.textContent = "✅ Access Granted. Redirecting...";
            statusBox.style.color = "#4caf50";
            localStorage.setItem("currentUser", data.username || "User");
            setTimeout(() => { 
                window.location.href = "/mobile/menu"; 
            }, 1000);
        } else {
            statusBox.textContent = data.message || "❌ Invalid PIN. Access denied.";
            statusBox.style.color = "#ff4444";
            pinInput.classList.add("pin-error");
            pinInput.value = "";
            setTimeout(() => {
                pinInput.classList.remove("pin-error");
                statusBox.style.color = "";
            }, 2000);
        }
    } catch (err) {
        console.error("PIN verification error:", err);
        statusBox.textContent = "❌ Server connection failed. Please try again.";
        statusBox.style.color = "#ff4444";
        setTimeout(() => {
            statusBox.style.color = "";
        }, 3000);
    }
}

// Add Enter key handler
if (pinInput) {
    pinInput.addEventListener("keyup", (e) => {
        if (e.key === "Enter" && pinInput.value.length === 4) {
            tryPIN();
        }
    });
}

// Add manual verify button if needed (optional)
const verifyPinBtn = document.getElementById("verifyPinBtn");
if (verifyPinBtn) {
    verifyPinBtn.onclick = tryPIN;
}

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    if (stream) {
        stream.getTracks().forEach(t => t.stop());
    }
});

console.log("✅ Unlock page ready - PIN must be exactly 4 digits");