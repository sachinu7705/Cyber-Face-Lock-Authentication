console.log("mobile_unlock.js loaded");

// ---------------------------------------------------------------------
// ELEMENTS FROM HTML (ALL MATCHING EXACT IDs YOU SENT)
// ---------------------------------------------------------------------
const video = document.getElementById("unlockVideo");
const pinInput = document.getElementById("unlockPin");
const statusBox = document.getElementById("unlockMsg");

const btnStart = document.getElementById("startUnlockCam");
const btnCapture = document.getElementById("captureUnlockBtn");
const btnStop = document.getElementById("stopUnlockCam");

const hudCanvas = document.getElementById("hudCanvas");
const holo = document.getElementById("holo");
const holoText = document.getElementById("holoText");

let stream = null;

// ---------------------------------------------------------------------
//  START CAMERA
// ---------------------------------------------------------------------
btnStart.onclick = async () => {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        statusBox.textContent = "Camera started.";
    } 
    catch (e) {
        statusBox.textContent = "Camera failed: " + e;
        console.error(e);
    }
};

// ---------------------------------------------------------------------
//  STOP CAMERA
// ---------------------------------------------------------------------
btnStop.onclick = () => {
    if (stream) {
        stream.getTracks().forEach(t => t.stop());
        stream = null;
        statusBox.textContent = "Camera stopped.";
    }
};

// ---------------------------------------------------------------------
// CAPTURE & SEND TO SERVER FOR FACE UNLOCK
// ---------------------------------------------------------------------
btnCapture.onclick = async () => {
    if (!stream) {
        statusBox.textContent = "Camera not started.";
        return;
    }

    holo.classList.remove("hidden");
    holoText.innerText = "SCANNING FACE...";

    // Take snapshot
    const c = document.createElement("canvas");
    c.width = video.videoWidth;
    c.height = video.videoHeight;
    c.getContext("2d").drawImage(video, 0, 0);

    const imgData = c.toDataURL("image/jpeg", 0.85);

    // Send to API
    const fd = new FormData();
    fd.append("image", imgData);

    const res = await fetch("/api/unlock_from_camera", {
        method: "POST",
        body: fd
    });

    const data = await res.json();

    if (data.status === "ok") {
        holoText.innerText = "ACCESS GRANTED";
        statusBox.textContent = "Welcome " + data.user;

        setTimeout(() => {
            window.location.href = "/mobile/menu";  // next page after unlock
        }, 1000);
    } 
    else {
        holoText.innerText = "FACE NOT RECOGNIZED";
        statusBox.textContent = "Face unlock failed.";
    }

    setTimeout(() => holo.classList.add("hidden"), 1200);
};

// ---------------------------------------------------------------------
// PIN FALLBACK UNLOCK
// ---------------------------------------------------------------------
pinInput.addEventListener("keyup", e => {
    if (e.key === "Enter") tryPIN();
});

async function tryPIN() {
    const pin = pinInput.value.trim();

    if (!pin) return;

    const fd = new FormData();
    fd.append("password", pin);
    fd.append("appname", "unlock");

    const res = await fetch("/api/open_app_password", {
        method: "POST",
        body: fd
    });

    const data = await res.json();

    if (data.status === "ok") {
        statusBox.textContent = "PIN correct.";

        setTimeout(() => {
            window.location.href = "/mobile/menu"; // unlocked page
        }, 700);
    } 
    else {
        statusBox.textContent = "Wrong PIN.";
    }
}
