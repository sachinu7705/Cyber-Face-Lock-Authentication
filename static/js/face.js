(function () {
    let faceVideo, statusText, saveBtn, startBtn, cancelBtn;
    let modelsLoaded = false;
    let detectionInterval = null;
    let variationCount = 0; 

    window.addEventListener("DOMContentLoaded", () => {
        // Support both naming conventions for video elements
        const enrollVideo = document.getElementById("enrollVideo");
        const unlockVideo = document.getElementById("unlockVideo");
        const webcam = document.getElementById("webcam");

        faceVideo = enrollVideo || unlockVideo || webcam;
        statusText = document.getElementById("scanStatus") || document.getElementById("appsStatus");

        saveBtn = document.getElementById("confirmUploadBtn");
        startBtn = document.getElementById("startScanBtn");
        cancelBtn = document.getElementById("cancelScanBtn");

        if (!faceVideo) {
            console.error("No video element found (ID: enrollVideo, unlockVideo, or webcam)");
            return;
        }

        // Initialize AI Models
        loadModels();

        // Button Assignments
        if (saveBtn) saveBtn.onclick = enrollFace;
        if (startBtn) startBtn.onclick = startCamera;
        if (cancelBtn) cancelBtn.onclick = stopCamera;
    });

    async function startCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { width: 640, height: 480, facingMode: "user" } 
            });
            faceVideo.srcObject = stream;
            
            faceVideo.onloadedmetadata = () => {
                faceVideo.play();
                if (statusText) statusText.innerText = "📸 Camera active. Center your face.";
                
                // If this is the Unlock/Verification page, start auto-scanning
                if (faceVideo.id === "unlockVideo" || faceVideo.id === "webcam") {
                    if (detectionInterval) clearInterval(detectionInterval);
                    detectionInterval = setInterval(detectFace, 1200);
                }
            };
        } catch (err) {
            console.error("Camera Error:", err);
            if (statusText) statusText.innerText = "❌ Camera access denied.";
        }
    }

    function stopCamera() {
        if (faceVideo && faceVideo.srcObject) {
            faceVideo.srcObject.getTracks().forEach(track => track.stop());
            faceVideo.srcObject = null;
        }
        if (detectionInterval) {
            clearInterval(detectionInterval);
            detectionInterval = null;
        }
        if (statusText) statusText.innerText = "🛑 Camera offline.";
    }

    async function loadModels() {
        if (modelsLoaded) return;
        if (statusText) statusText.innerText = "🧠 Initializing Biometric AI...";
        try {
            // Ensure models are located in /static/models/
            const MODEL_URL = '/static/models';
            await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
            await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
            await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
            modelsLoaded = true;
            if (statusText) statusText.innerText = "✅ AI Ready for Scanning";
        } catch (e) {
            console.error("Model Load Error:", e);
            if (statusText) statusText.innerText = "❌ AI Model Load Failed";
        }
    }

    /**
     * ENROLLMENT LOGIC
     * Sends descriptor to /api/save-face
     * Handles the "Already Enrolled" duplicate check
     */
    async function enrollFace() {
        if (!modelsLoaded) return alert("System still loading AI...");
        if (!faceVideo || faceVideo.readyState !== 4) return alert("Start camera first!");

        if (statusText) statusText.innerText = "🔍 Analyzing Biometrics...";

        const detection = await faceapi
            .detectSingleFace(faceVideo, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptor();

        if (!detection) {
            if (statusText) statusText.innerText = "❌ Face not detected. Adjust lighting.";
            return;
        }

        try {
            const userEmail = localStorage.getItem("email") || "sachinu0404@gmail.com";
            
            const res = await fetch("/api/save-face", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: userEmail,
                    descriptor: Array.from(detection.descriptor)
                })
            });

            const data = await res.json();

            if (data.status === "exists") {
                // Triggered if the face matches a different email or already exists
                if (statusText) {
                    statusText.style.color = "#ff0055";
                    statusText.innerText = `🚫 Already Enrolled: ${data.msg}`;
                }
                alert("This face is already registered in the system!");
            } else if (data.status === "ok" || data.status === "saved") {
                variationCount++;
                if (statusText) {
                    statusText.style.color = "#00f2ff";
                    statusText.innerText = `✅ Scan ${variationCount} Saved Successfully!`;
                }
            } else {
                if (statusText) statusText.innerText = "❌ Save Failed: " + (data.msg || "Unknown error");
            }
        } catch (err) {
            console.error("Network Error:", err);
            if (statusText) statusText.innerText = "❌ Server Connection Error";
        }
    }

    /**
     * VERIFICATION LOGIC
     * Auto-runs on unlock pages to verify identity
     */
    async function detectFace() {
        if (!faceVideo || faceVideo.readyState !== 4) return;

        const detection = await faceapi
            .detectSingleFace(faceVideo, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptor();

        if (!detection) return;

        try {
            const userEmail = localStorage.getItem("email") || "sachinu0404@gmail.com";

            const res = await fetch("/api/verify-face-js", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: userEmail,
                    descriptor: Array.from(detection.descriptor)
                })
            });

            const data = await res.json();
            if (data.status === "success") {
                if (statusText) {
                    statusText.style.color = "#00f2ff";
                    statusText.innerText = "✅ Identity Verified! Unlocking...";
                }
                stopCamera();
                
                // Redirect to dashboard or trigger app launch
                setTimeout(() => { 
                    if (window.location.pathname.includes("mobile_apps")) {
                        // If on apps page, just close the overlay
                        const overlay = document.getElementById("faceScanOverlay");
                        if (overlay) overlay.style.display = "none";
                    } else {
                        window.location.href = "/dashboard"; 
                    }
                }, 1000);
            }
        } catch (err) {
            console.error("Verif Error:", err);
        }
    }
})();