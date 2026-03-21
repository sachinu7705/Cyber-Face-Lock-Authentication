(function () {

    // -----------------------------
    // 📦 PRIVATE VARIABLES
    // -----------------------------
    let faceVideo, statusText, saveBtn, startBtn, cancelBtn;
    let modelsLoaded = false;

    // -----------------------------
    // 🎯 DOM READY
    // -----------------------------
    window.addEventListener("DOMContentLoaded", () => {
        faceVideo = document.getElementById("enrollVideo");
        statusText = document.getElementById("scanStatus");
        saveBtn = document.getElementById("confirmUploadBtn");
        startBtn = document.getElementById("startScanBtn");
        cancelBtn = document.getElementById("cancelScanBtn");

        if (!faceVideo) {
            console.warn("Not enroll page → skipping face.js");
            return;
        }

        if (saveBtn) saveBtn.onclick = enrollFace;

        if (startBtn) {
            startBtn.onclick = async () => {
                await startCamera();
                statusText.innerText = "📸 Camera started. Position your face.";
            };
        }

        if (cancelBtn) cancelBtn.onclick = stopCamera;

        init();
    });

    // -----------------------------
    // 🎥 START CAMERA
    // -----------------------------
    async function startCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            faceVideo.srcObject = stream;
            await faceVideo.play();
        } catch (err) {
            console.error(err);
            alert("Camera access denied!");
        }
    }

    // -----------------------------
    // 🛑 STOP CAMERA
    // -----------------------------
    function stopCamera() {
        if (faceVideo && faceVideo.srcObject) {
            faceVideo.srcObject.getTracks().forEach(track => track.stop());
            faceVideo.srcObject = null;
            statusText.innerText = "🛑 Camera stopped.";
        }
    }

    // -----------------------------
    // 🧠 LOAD MODELS (ONLY ONCE)
    // -----------------------------
    async function loadModels() {
        if (modelsLoaded) return;

        statusText.innerText = "🧠 Loading AI models...";

        await faceapi.nets.tinyFaceDetector.loadFromUri('/static/models');
        await faceapi.nets.faceLandmark68Net.loadFromUri('/static/models');
        await faceapi.nets.faceRecognitionNet.loadFromUri('/static/models');

        modelsLoaded = true;
        statusText.innerText = "✅ AI Ready";
    }

    // -----------------------------
    // 📸 ENROLL FACE
    // -----------------------------
    async function enrollFace() {

        if (!faceVideo || faceVideo.readyState !== 4) {
            statusText.innerText = "⚠️ Camera not ready";
            return;
        }

        statusText.innerText = "🔍 Scanning face...";

        const detection = await faceapi
            .detectSingleFace(
                faceVideo,
                new faceapi.TinyFaceDetectorOptions()
            )
            .withFaceLandmarks()
            .withFaceDescriptor();

        if (!detection) {
            statusText.innerText = "❌ No face detected";
            return;
        }

        try {
            const res = await fetch("/api/save-face", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    descriptor: Array.from(detection.descriptor)
                })
            });

            const data = await res.json();

            statusText.innerText =
                data.status === "saved"
                    ? "✅ Face enrolled!"
                    : "❌ Save failed";

        } catch (err) {
            console.error(err);
            statusText.innerText = "❌ Network error";
        }
    }

    // -----------------------------
    // 🔓 VERIFY FACE
    // -----------------------------
    async function detectFace() {

        if (!faceVideo || faceVideo.readyState !== 4) {
            statusText.innerText = "⚠️ Camera not ready";
            return;
        }

        statusText.innerText = "🔍 Verifying...";

        const detection = await faceapi
            .detectSingleFace(
                faceVideo,
                new faceapi.TinyFaceDetectorOptions()
            )
            .withFaceLandmarks()
            .withFaceDescriptor();

        if (!detection) {
            statusText.innerText = "❌ No face detected";
            return;
        }

        try {
            const res = await fetch("/api/verify-face-js", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    descriptor: Array.from(detection.descriptor)
                })
            });

            const data = await res.json();

            statusText.innerText =
                data.status === "success"
                    ? "✅ Unlocked!"
                    : "❌ Access Denied";

        } catch (err) {
            console.error(err);
            statusText.innerText = "❌ Network error";
        }
    }

    // -----------------------------
    // 🚀 INIT
    // -----------------------------
    async function init() {
        await loadModels(); // no auto camera
    }

})();