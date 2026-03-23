// static/js/mobile.js (updated with proper error handling)

/* ---------- DOM Elements with validation ---------- */
const video = document.getElementById('enrollVideo');
const overlay = document.getElementById('overlay');
const startBtn = document.getElementById('startScanBtn');
const cancelBtn = document.getElementById('cancelScanBtn');
const quickBtn = document.getElementById('quickCaptureBtn');
const statusEl = document.getElementById('scanStatus');
const thumbList = document.getElementById('thumbList');
const confirmBtn = document.getElementById('confirmUploadBtn');

// Validate required elements exist
if (!video || !overlay) {
    console.error('mobile.js: Required elements not found - video or overlay missing');
    throw new Error('Required DOM elements missing');
}

/* ---------- state ---------- */
let mpFace = null;
let mpCamera = null;
let latestLandmarks = null;
let running = false;
let stepIndex = 0;
const STABLE_TIME = 700;
let stableStart = null;
let images = [];
let verifiedUsername = null;

/* ---------- Guided steps ---------- */
const STEPS = [
    { name: 'Face Forward', cond: p => Math.abs(p.yaw) < 0.18 && Math.abs(p.pitch) < 0.18 },
    { name: 'Turn Right',  cond: p => p.yaw > 0.28 },
    { name: 'Turn Left',   cond: p => p.yaw < -0.28 },
    { name: 'Look Up',     cond: p => p.pitch < -0.22 },
    { name: 'Blink (one eye)', cond: (p, extras) => extras && extras.blinked },
];

/* ---------- Helper Functions ---------- */
function showError(message) {
    const statusElement = document.getElementById('scanStatus');
    if (statusElement) {
        statusElement.innerHTML = `<span style="color: #ff4444;">⚠️ ${message}</span>`;
        statusElement.classList.add('error');
        setTimeout(() => {
            if (statusElement.innerHTML.includes(message)) {
                statusElement.innerHTML = 'Ready. Use <strong>Start Scan</strong>.';
                statusElement.classList.remove('error');
            }
        }, 4000);
    } else {
        console.error('Error:', message);
    }
}

function showSuccess(message) {
    const statusElement = document.getElementById('scanStatus');
    if (statusElement) {
        statusElement.innerHTML = `<span style="color: #4caf50;">✅ ${message}</span>`;
        statusElement.classList.add('success');
        setTimeout(() => {
            statusElement.classList.remove('success');
        }, 2000);
    }
}

// Check if username exists
// Check if username exists in known_faces folder
async function checkUsernameExists(username) {
    try {
        const res = await fetch('/api/list_users');
        const data = await res.json();
        if (data.status === 'ok') {
            return data.users.includes(username);
        }
        return false;
    } catch (e) {
        console.error('Error checking username:', e);
        return false;
    }
}
// Setup username validation with error handling
const usernameInput = document.getElementById('enrollUsername');
const usernameStatus = document.getElementById('usernameStatus');
const pinInput = document.getElementById('enrollPin');

if (usernameInput && usernameStatus) {
    usernameInput.addEventListener('input', async (e) => {
        const username = e.target.value.trim();
        if (username.length > 0) {
            try {
                const exists = await checkUsernameExists(username);
                if (exists) {
                    usernameStatus.innerHTML = '⚠️ Existing user - you will add more face scans';
                    usernameStatus.className = 'username-status warning';
                } else {
                    usernameStatus.innerHTML = '✅ New user - a new account will be created';
                    usernameStatus.className = 'username-status success';
                }
            } catch (error) {
                usernameStatus.innerHTML = '❌ Error checking username';
                usernameStatus.className = 'username-status error';
            }
        } else {
            usernameStatus.innerHTML = '';
            usernameStatus.className = 'username-status';
        }
    });
}

/* ---------- Face Detection Helper Functions ---------- */
function pXY(lm, i, w, h) {
    const L = lm[i];
    return [L.x * w, L.y * h];
}

function estimatePose(lm, w, h) {
    const [nx, ny] = pXY(lm, 1, w, h);
    const [lx, ly] = pXY(lm, 33, w, h);
    const [rx, ry] = pXY(lm, 263, w, h);
    const [cx, cy] = pXY(lm, 152, w, h);
    const ex = (lx + rx) / 2;
    const ey = (ly + ry) / 2;
    const faceW = Math.hypot(rx - lx, ry - ly) || (w * 0.2);
    const faceH = Math.hypot(ey - cy, ex - cx) || (h * 0.25);
    return {
        yaw: (nx - ex) / faceW,
        pitch: (ey - ny) / faceH,
        roll: Math.atan2(ry - ly, rx - lx) * 180 / Math.PI,
        cx: nx, cy: ny, faceW, faceH
    };
}

function eyeOpenRatio(lm, w, h) {
    try {
        const leftV = Math.abs((lm[159].y - lm[145].y) * h);
        const leftH = Math.hypot((lm[33].x - lm[133].x) * w, (lm[33].y - lm[133].y) * h) || 1;
        const rightV = Math.abs((lm[386].y - lm[374].y) * h);
        const rightH = Math.hypot((lm[263].x - lm[362].x) * w, (lm[263].y - lm[362].y) * h) || 1;
        return { left: leftV / leftH, right: rightV / rightH };
    } catch (e) {
        return { left: 1, right: 1 };
    }
}

function mouthRatio(lm, w, h) {
    try {
        const upp = lm[13], low = lm[14];
        const gap = Math.hypot((upp.x - low.x) * w, (upp.y - low.y) * h);
        const eyeL = lm[33], eyeR = lm[263], chin = lm[152];
        const eyeY = ((eyeL.y + eyeR.y) / 2) * h;
        const faceH = Math.abs(chin.y * h - eyeY) || (h * 0.25);
        return gap / faceH;
    } catch (e) {
        return 0;
    }
}

function computeBrightnessFromVideo(videoEl, lm, w, h) {
    try {
        const xs = [lm[1].x, lm[33].x, lm[263].x, lm[152].x];
        const ys = [lm[1].y, lm[33].y, lm[263].y, lm[152].y];
        const minX = Math.max(0, Math.min(...xs)), maxX = Math.min(1, Math.max(...xs));
        const minY = Math.max(0, Math.min(...ys)), maxY = Math.min(1, Math.max(...ys));
        const px1 = Math.floor(minX * w), py1 = Math.floor(minY * h);
        const px2 = Math.ceil(maxX * w), py2 = Math.ceil(maxY * h);
        const sw = Math.max(8, px2 - px1), sh = Math.max(8, py2 - py1);
        const c = document.createElement('canvas');
        c.width = sw; c.height = sh;
        const ctx2 = c.getContext('2d');
        ctx2.drawImage(videoEl, px1, py1, sw, sh, 0, 0, sw, sh);
        const d = ctx2.getImageData(0, 0, sw, sh).data;
        let total = 0, count = 0;
        for (let i = 0; i < d.length; i += 4) {
            const r = d[i], g = d[i + 1], b = d[i + 2];
            const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            total += lum; count++;
        }
        return (total / count) / 255;
    } catch (e) {
        return 0.5;
    }
}

const ctx = overlay.getContext('2d');
function drawFrame(lm, w, h, fraction = 0, stepName = '') {
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    
    // Mirror x for UI
    const cx = (1 - lm[1].x) * overlay.width;
    const cy = lm[1].y * overlay.height;
    
    const eyeL = lm[33], eyeR = lm[263];
    const eyeLx = (1 - eyeL.x) * overlay.width, eyeLy = eyeL.y * overlay.height;
    const eyeRx = (1 - eyeR.x) * overlay.width, eyeRy = eyeR.y * overlay.height;
    const faceWpx = Math.hypot(eyeRx - eyeLx, eyeRy - eyeLy);
    const radius = Math.max(44, faceWpx * 0.9);
    
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();
    
    ctx.strokeStyle = '#00e676';
    ctx.lineWidth = 6;
    const start = -Math.PI / 2;
    const end = start + Math.min(1, fraction) * 2 * Math.PI;
    ctx.beginPath(); ctx.arc(cx, cy, radius, start, end); ctx.stroke();
    
    ctx.fillStyle = '#fff';
    ctx.font = '15px Arial';
    ctx.fillText(stepName, 8, 20);
    ctx.restore();
}

/* ---------- MediaPipe Functions ---------- */
function detectUMDFaceMesh() {
    const FaceMeshCtor = window.FaceMesh || (window.faceMesh && window.faceMesh.FaceMesh) || null;
    const CameraCtor = window.Camera || (window.cameraUtils && window.cameraUtils.Camera) || null;
    if (FaceMeshCtor && CameraCtor) return { FaceMeshCtor, CameraCtor };
    return null;
}

async function startCameraAndMesh() {
    const umd = detectUMDFaceMesh();
    if (!umd) {
        throw new Error('MediaPipe FaceMesh UMD not found');
    }

    if (!mpFace) {
        const FaceMeshClass = umd.FaceMeshCtor;
        mpFace = new FaceMeshClass({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
            }
        });

        mpFace.setOptions({
            maxNumFaces: 1,
            refineLandmarks: true,
            minDetectionConfidence: 0.6,
            minTrackingConfidence: 0.6
        });

        mpFace.onResults((res) => {
            if (res.multiFaceLandmarks && res.multiFaceLandmarks.length) {
                latestLandmarks = res.multiFaceLandmarks[0];
            } else {
                latestLandmarks = null;
            }
        });
    }

    if (!mpCamera) {
        const CameraClass = umd.CameraCtor;
        mpCamera = new CameraClass(video, {
            onFrame: async () => { await mpFace.send({ image: video }); },
            width: 640, height: 480
        });
    }

    await mpCamera.start();
    if (!video._stream && video.srcObject) video._stream = video.srcObject;
}

function stopCameraAndMesh() {
    try { mpCamera && mpCamera.stop(); } catch (e) {}
    stopVideoStream();
    latestLandmarks = null;
}

function stopVideoStream() {
    try {
        if (video && video._stream) {
            video._stream.getTracks().forEach(t => t.stop());
            video._stream = null;
        }
        if (video) {
            video.pause();
            video.srcObject = null;
        }
    } catch (e) { /* ignore */ }
}

async function startVideoOnly() {
    if (video._stream) return;
    const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
    video.srcObject = s;
    video._stream = s;
    await video.play();
}

/* ---------- Capture Snapshot ---------- */
function captureSnapshot() {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    images.push(dataUrl);
    
    // Add thumbnail
    if (thumbList) {
        const img = document.createElement("img");
        img.src = dataUrl;
        thumbList.appendChild(img);
    }
    
    stepIndex++;
    if (stepIndex >= STEPS.length) {
        running = false;
        if (statusEl) statusEl.innerHTML = "Capture complete — review and Save.";
        stopCameraAndMesh();
    } else {
        if (statusEl) statusEl.innerHTML = `Captured ${images.length}/${STEPS.length}. Next: ${STEPS[stepIndex].name}`;
    }
}

/* ---------- Render Loop ---------- */
function renderLoop() {
    overlay.width = video.clientWidth || video.videoWidth || overlay.width;
    overlay.height = video.clientHeight || video.videoHeight || overlay.height;
    
    if (!running) {
        requestAnimationFrame(renderLoop);
        return;
    }
    
    if (latestLandmarks) {
        const lm = latestLandmarks;
        const pose = estimatePose(lm, overlay.width, overlay.height);
        const ratios = eyeOpenRatio(lm, overlay.width, overlay.height);
        const mouthR = mouthRatio(lm, overlay.width, overlay.height);
        const brightness = computeBrightnessFromVideo(video, lm, overlay.width, overlay.height);
        const extras = {
            blinked: (ratios.left < 0.22 || ratios.right < 0.22),
            mouthOpen: (mouthR >= 0.18),
            brightness,
            faceWpx: pose.faceW
        };
        
        const TOO_SMALL = 42;
        const TOO_LARGE = overlay.width * 0.82;
        let sizeMsg = '';
        if (pose.faceW < TOO_SMALL) sizeMsg = 'Move closer';
        else if (pose.faceW > TOO_LARGE) sizeMsg = 'Move back a bit';
        let lightMsg = '';
        if (brightness < 0.16) lightMsg = 'Too dark';
        else if (brightness > 0.92) lightMsg = 'Too bright';
        
        const step = STEPS[stepIndex] || { name: '--', cond: () => false };
        const condMet = step.cond(pose, extras);
        
        let fraction = 0;
        if (condMet && !sizeMsg && !lightMsg) {
            if (!stableStart) stableStart = performance.now();
            fraction = Math.min(1, (performance.now() - stableStart) / STABLE_TIME);
        } else {
            stableStart = null;
            fraction = 0;
        }
        
        drawFrame(lm, overlay.width, overlay.height, fraction, `${step.name}`);
        
        let statusMsg = `Step: ${step.name}`;
        if (sizeMsg) statusMsg += ` • ${sizeMsg}`;
        if (lightMsg) statusMsg += ` • ${lightMsg}`;
        if (statusEl) statusEl.innerHTML = statusMsg;
        
        if (fraction >= 1) {
            stableStart = null;
            captureSnapshot();
        }
    } else {
        ctx.clearRect(0, 0, overlay.width, overlay.height);
        if (statusEl) statusEl.innerHTML = "No face detected — position face inside view";
    }
    
    requestAnimationFrame(renderLoop);
}

/* ---------- Start Button Handler with Error Checking ---------- */

// Start button handler with proper PIN verification
// Start button handler with proper PIN verification
if (startBtn) {
    startBtn.onclick = async () => {
        // Get elements with error checking
        const usernameInput = document.getElementById('enrollUsername');
        const pinInput = document.getElementById('enrollPin');
        
        if (!usernameInput || !pinInput) {
            showError('Form elements not found. Please refresh the page.');
            return;
        }
        
        const username = usernameInput.value.trim();
        const pin = pinInput.value.trim();
        
        usernameInput.style.borderColor = '';
        pinInput.style.borderColor = '';
        
        if (!username) {
            showError('Please enter your username');
            usernameInput.focus();
            return;
        }
        
        if (!pin) {
            showError('Please enter your 4-digit PIN');
            pinInput.focus();
            return;
        }
        
        if (!/^\d{4}$/.test(pin)) {
            showError('PIN must be exactly 4 digits');
            pinInput.focus();
            return;
        }
        
        try {
            // Check if username exists in known_faces folder
            const userExists = await checkUsernameExists(username);
            
            if (userExists) {
                // EXISTING USER - Verify PIN
                showSuccess('Verifying credentials...');
                
                const verifyRes = await fetch('/api/verify-pin', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        username: username,
                        pin: pin,
                        is_new_user: false
                    })
                });
                
                const verifyData = await verifyRes.json();
                
                if (verifyData.status !== 'success') {
                    showError(verifyData.message || 'Invalid PIN. Access denied.');
                    pinInput.style.borderColor = '#ff4444';
                    pinInput.value = '';
                    pinInput.focus();
                    return;
                }
                
                // PIN is correct - proceed with adding more face scans
                verifiedUsername = username;
                showSuccess(`Welcome back ${username}! Adding more face scans...`);
                
            } else {
                // NEW USER - Verify system PIN
                showSuccess('Verifying system PIN for new account...');
                
                const verifyRes = await fetch('/api/verify-pin', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        username: username,
                        pin: pin,
                        is_new_user: true
                    })
                });
                
                const verifyData = await verifyRes.json();
                
                if (verifyData.status !== 'success') {
                    showError(verifyData.message || 'Invalid system PIN. Cannot create new account.');
                    pinInput.style.borderColor = '#ff4444';
                    pinInput.value = '';
                    pinInput.focus();
                    return;
                }
                
                verifiedUsername = username;
                showSuccess(`Welcome ${username}! Starting face enrollment for new account...`);
            }
            
            // Only reach here if PIN verification passed
            // Reset state and start camera
            images = [];
            if (thumbList) thumbList.innerHTML = '';
            stepIndex = 0;
            stableStart = null;
            running = true;
            if (statusEl) statusEl.innerHTML = 'Starting camera & model...';
            
            try {
                await startVideoOnly();
                await startCameraAndMesh();
                if (statusEl) statusEl.innerHTML = `Step 1: ${STEPS[0].name}`;
                requestAnimationFrame(renderLoop);
            } catch (e) {
                running = false;
                showError('Failed to start camera: ' + (e?.message || e));
            }
            
        } catch (error) {
            console.error('Verification error:', error);
            showError('Unable to verify. Please try again.');
        }
    };
}
/* ---------- Cancel Button ---------- */
if (cancelBtn) {
    cancelBtn.onclick = () => {
        running = false;
        stopCameraAndMesh();
        if (statusEl) statusEl.innerHTML = 'Scan cancelled';
    };
}

/* ---------- Confirm Button ---------- */
// Confirm button handler with final PIN verification
// Confirm button handler with final verification
if (confirmBtn) {
    confirmBtn.onclick = async () => {
        const usernameInput = document.getElementById('enrollUsername');
        const pinInput = document.getElementById('enrollPin');
        
        if (!usernameInput || !pinInput) {
            showError('Form elements not found');
            return;
        }
        
        const username = usernameInput.value.trim();
        const pin = pinInput.value.trim();
        
        if (!username) {
            showError('Username is required');
            return;
        }
        
        if (!pin) {
            showError('PIN is required');
            return;
        }
        
        if (images.length === 0) {
            showError('No face images captured. Please start scan first.');
            return;
        }
        
        // Check if user exists
        const userExists = await checkUsernameExists(username);
        
        // Final verification before saving
        showSuccess('Final verification...');
        
        try {
            const verifyRes = await fetch('/api/verify-pin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    username: username,
                    pin: pin,
                    is_new_user: !userExists  // If user doesn't exist, treat as new user
                })
            });
            
            const verifyData = await verifyRes.json();
            
            if (verifyData.status !== 'success') {
                showError(verifyData.message || 'PIN verification failed. Cannot save.');
                pinInput.style.borderColor = '#ff4444';
                pinInput.value = '';
                pinInput.focus();
                return;
            }
            
            // PIN verified - proceed with save
            const fd = new FormData();
            fd.append('name', username);
            fd.append('pin', pin);
            images.forEach(i => fd.append('images[]', i));
            
            if (statusEl) statusEl.innerHTML = 'Uploading and saving...';
            
            const res = await fetch('/api/enroll_from_camera', { 
                method: 'POST', 
                body: fd 
            }).then(r => r.json());
            
            if (res.status === 'ok') {
                showSuccess('✅ ' + (res.msg || 'Saved successfully!'));
                setTimeout(() => (location.href = '/mobile'), 1500);
            } else {
                showError(res.msg || 'Enrollment failed. Please try again.');
            }
        } catch (e) {
            showError('Verification error: ' + (e?.message || e));
            console.error(e);
        }
    };
}
// Keep overlay size in sync
requestAnimationFrame(function frameKeep() {
    if (overlay && video) {
        overlay.width = video.clientWidth || video.videoWidth || overlay.width;
        overlay.height = video.clientHeight || video.videoHeight || overlay.height;
    }
    requestAnimationFrame(frameKeep);
});