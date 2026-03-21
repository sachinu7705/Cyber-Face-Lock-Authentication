// static/js/mobile.js (updated)
// Robust FaceID-like guided enrollment using MediaPipe FaceMesh UMD (or helpful error if missing)
// Keeps your guided steps, ring animation, blink & mouth checks, thumbnails, etc.


/* ---------- DOM ---------- */
const video = document.getElementById?.('enrollVideo');
const overlay = document.getElementById?.('overlay');
const startBtn = document.getElementById?.('startScanBtn');
const cancelBtn = document.getElementById?.('cancelScanBtn');
const quickBtn = document.getElementById?.('quickCaptureBtn');
const statusEl = document.getElementById?.('scanStatus');
const thumbList = document.getElementById?.('thumbList');
const confirmBtn = document.getElementById?.('confirmUploadBtn');

if (!video || !overlay) {
  console.warn('mobile.js: enroll page elements not found — script will no-op');
  // nothing else to do on non-enroll pages
} else {
  /* ---------- state ---------- */
  let mpFace = null;     // FaceMesh instance (UMD)
  let mpCamera = null;   // Camera instance (UMD)
  let latestLandmarks = null;
  let running = false;
  let stepIndex = 0;
  const STABLE_TIME = 700; // ms to hold pose
  let stableStart = null;
  let images = [];

  /* ---------- Guided steps (FaceID-like) ---------- */
  const STEPS = [
    { name: 'Face Forward', cond: p => Math.abs(p.yaw) < 0.18 && Math.abs(p.pitch) < 0.18 },
    { name: 'Turn Right',  cond: p => p.yaw > 0.28 },
    { name: 'Turn Left',   cond: p => p.yaw < -0.28 },
    { name: 'Look Up',     cond: p => p.pitch < -0.22 },
    { name: 'Blink (one eye)', cond: (p, extras) => extras && extras.blinked },
  ];

  /* ---------- helper math ---------- */
  function pXY(lm, i, w, h) {
    const L = lm[i];
    return [L.x * w, L.y * h];
  }
  let lastPose = null;

  function isStablePose(pose) {
    if (!lastPose) {
      lastPose = pose;
      return false;
    }

    const diff =
      Math.abs(pose.yaw - lastPose.yaw) +
      Math.abs(pose.pitch - lastPose.pitch);

    lastPose = pose;

    return diff < 0.02; // smaller = more strict
  }
  function estimatePose(lm, w, h) {
    // nose tip (1), left outer eye (33), right outer eye (263), chin (152)
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

  /* ---------- blink detection (simple ratio) ---------- */
  function eyeOpenRatio(lm, w, h) {
    // uses mediapipe landmark indexes
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

  /* ---------- mouth openness ---------- */
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

  /* ---------- lighting compute ---------- */
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

  /* ---------- drawing ---------- */
  const ctx = overlay.getContext('2d');
  function drawFrame(lm, w, h, fraction = 0, stepName = '') {
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    // mirror x for UI (so user's left/right feel natural)
    const cx = (1 - lm[1].x) * overlay.width;
    const cy = lm[1].y * overlay.height;

    const eyeL = lm[33], eyeR = lm[263];
    const eyeLx = (1 - eyeL.x) * overlay.width, eyeLy = eyeL.y * overlay.height;
    const eyeRx = (1 - eyeR.x) * overlay.width, eyeRy = eyeR.y * overlay.height;
    const faceWpx = Math.hypot(eyeRx - eyeLx, eyeRy - eyeLy);
    const radius = Math.max(44, faceWpx * 0.9);

    // faint circle
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();

    // progress arc
    ctx.strokeStyle = '#00e676';
    ctx.lineWidth = 6;
    const start = -Math.PI / 2;
    const end = start + Math.min(1, fraction) * 2 * Math.PI;
    ctx.beginPath(); ctx.arc(cx, cy, radius, start, end); ctx.stroke();

    // label
    ctx.fillStyle = '#fff';
    ctx.font = '15px Arial';
    ctx.fillText(stepName, 8, 20);

    ctx.restore();
  }

  /* ---------- media / mediapipe init (robust) ---------- */

  // helper: ensure UMD FaceMesh + Camera exist and return constructors
  function detectUMDFaceMesh() {
    // tries common global names and shapes used by UMD builds
    // returns object { FaceMeshCtor, CameraCtor } or null if not found
    const FaceMeshCtor = window.FaceMesh || (window.faceMesh && window.faceMesh.FaceMesh) || null;
    const CameraCtor = window.Camera || (window.cameraUtils && window.cameraUtils.Camera) || (window.CameraUtils && window.CameraUtils.Camera) || (window.camera && window.camera.Camera) || null;
    // Some older UMDs have FaceMesh under window.facemesh or faceMesh namespace; check minimal feature
    if (FaceMeshCtor && CameraCtor) return { FaceMeshCtor, CameraCtor };
    return null;
  }

  async function startCameraAndMesh() {
    // try to detect UMD FaceMesh + Camera (most stable path for this project)
    const umd = detectUMDFaceMesh();
    if (!umd) {
      const msg = 'MediaPipe FaceMesh UMD not found. Please add these two <script> tags in your HTML head:\n\n' +
                  '<script src="https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js"></script>\n' +
                  '<script src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js"></script>\n\n' +
                  'Or use the Tasks API (FaceLandmarker) and I can supply code for that. For now the page needs the UMD files.';
      console.error(msg);
      throw new Error('MediaPipe FaceMesh UMD missing — see console / message for instructions');
    }

    // create instances only once
    if (!mpFace) {
      const FaceMeshCtor = umd.FaceMeshCtor;
      // Some UMD builds expose constructor directly as FaceMesh, others as FaceMesh.FaceMesh
      const FaceMeshClass = window.FaceMesh || (window.faceMesh && window.faceMesh.FaceMesh) || FaceMeshCtor;
      mpFace = new FaceMeshClass({
        locateFile: (file) => {
          // Use CDN path that works with UMD
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

    // start camera wrapper
    if (!mpCamera) {
      const CameraClass = window.Camera || (window.camera && window.camera.Camera) || (window.cameraUtils && window.cameraUtils.Camera);
      if (!CameraClass) {
        throw new Error('Camera constructor not found (camera_utils not loaded)');
      }
      mpCamera = new CameraClass(video, {
        onFrame: async () => { await mpFace.send({ image: video }); },
        width: 640, height: 480
      });
    }

    // start the camera
    await mpCamera.start();
    // also set video._stream marker so stopVideoStream works
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
      video.pause();
      video.srcObject = null;
    } catch (e) { /* ignore */ }
  }

  async function startVideoOnly() {
    if (video._stream) return;
    const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }});
    video.srcObject = s; video._stream = s;
    await video.play();
  }

  /* ---------- render loop ---------- */
  function renderLoop() {
    // keep overlay resolution in sync
    overlay.width = video.clientWidth || video.videoWidth || overlay.width;
    overlay.height = video.clientHeight || video.videoHeight || overlay.height;

    if (!running) { requestAnimationFrame(renderLoop); return; }

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

      // size/lighting checks
      const TOO_SMALL = 42;
      const TOO_LARGE = overlay.width * 0.82;
      let sizeMsg = '';
      if (pose.faceW < TOO_SMALL) sizeMsg = 'Move closer';
      else if (pose.faceW > TOO_LARGE) sizeMsg = 'Move back a bit';
      let lightMsg = '';
      if (brightness < 0.16) lightMsg = 'Too dark';
      else if (brightness > 0.92) lightMsg = 'Too bright';

      const step = STEPS[stepIndex] || { name: '--', cond: () => false };
      const condArg = (step.name === 'Open Mouth' || step.name.includes('Blink')) ? extras : pose;
      const condMet = (step.name === 'Open Mouth' || step.name.includes('Blink')) ? step.cond(pose, extras) : step.cond(pose);

      let fraction = 0;
      if (condMet && !sizeMsg && !lightMsg) {
        if (!stableStart) stableStart = performance.now();
        fraction = Math.min(1, (performance.now() - stableStart) / STABLE_TIME);
      } else {
        stableStart = null;
        fraction = 0;
      }

      drawFrame(lm, overlay.width, overlay.height, fraction, `${step.name}`);

      // status string
      let s = `Step: ${step.name}`;
      if (sizeMsg) s += ` • ${sizeMsg}`;
      if (lightMsg) s += ` • ${lightMsg}`;
      if (step.name === 'Open Mouth') s += extras.mouthOpen ? ' • mouth open ✓' : ' • please open mouth';
      if (step.name.includes('Blink')) s += extras.blinked ? ' • blink detected ✓' : ' • blink once';
      if (statusEl) statusEl.innerText = s;

      if (fraction >= 1) {
        stableStart = null;
        captureSnapshot();
      }
    } else {
      ctx.clearRect(0, 0, overlay.width, overlay.height);
      if (statusEl) statusEl.innerText = "No face detected — position face inside view";
    }

    requestAnimationFrame(renderLoop);
  }

  /* ---------- snapshot & gallery ---------- */
  function captureSnapshot() {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640; canvas.height = video.videoHeight || 480;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    images.push(dataUrl);

    // add thumb
    const img = document.createElement("img");
    img.src = dataUrl;   // ✅ FIXED

    thumbList.appendChild(img);



    
        stepIndex++;
    if (stepIndex >= STEPS.length) {
      running = false;
      if (statusEl) statusEl.innerText = "Capture complete — review and Save.";
      stopCameraAndMesh();
    } else {
      if (statusEl) statusEl.innerText = `Captured ${images.length}/${STEPS.length}. Next: ${STEPS[stepIndex].name}`;
    }
  }

  /* ---------- UI handlers ---------- */
  let storedPin = null;

    async function loadStoredPin() {
        const res = await fetch("/api/get_pin");
        const data = await res.json();
        storedPin = data.pin;
    }
loadStoredPin();
  startBtn.onclick = async () => {
    const name = document.getElementById('enrollName').value.trim();
    const pin = document.getElementById('enrollPin').value.trim();
    if (!name) return alert('Enter name');
    if (pin !== storedPin) return alert('Invalid PIN');

    // reset
    images = []; if (thumbList) thumbList.innerHTML = ''; stepIndex = 0; stableStart = null;
    running = true;
    if (statusEl) statusEl.innerText = 'Starting camera & model...';

    try {
      // start video first (gives permission prompt)
      await startVideoOnly();

      // then start FaceMesh + Camera (UMD)
      await startCameraAndMesh();

      if (statusEl) statusEl.innerText = `Step 1: ${STEPS[0].name}`;
      requestAnimationFrame(renderLoop);
    } catch (e) {
      running = false;
      const msg = (e && e.message) ? e.message : String(e);
      if (statusEl) statusEl.innerText = 'Start failed: ' + msg;
      console.error('start error:', e);
      // helpful console message
      console.info('If you see "MediaPipe FaceMesh UMD missing" please add these <script> tags in your HTML head:\n' +
                   '<script src="https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js"></script>\n' +
                   '<script src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js"></script>\n' +
                   'Then reload the page and allow camera permission.');
    }
  };

  cancelBtn.onclick = () => {
    running = false;
    stopCameraAndMesh();
    if (statusEl) statusEl.innerText = 'Scan cancelled';
  };

  quickBtn && (quickBtn.onclick = async () => {
    try {
      await startVideoOnly();
      if (statusEl) statusEl.innerText = 'Quick capture — hold still...';
      setTimeout(() => {
        const c = document.createElement('canvas'); c.width = video.videoWidth || 640; c.height = video.videoHeight || 480;
        c.getContext('2d').drawImage(video, 0, 0, c.width, c.height);
        const d = c.toDataURL('image/jpeg', 0.92);
        images.push(d); if (thumbList) thumbList.innerHTML = ''; const img = document.createElement('img'); img.src = d; thumbList && thumbList.appendChild(img);
        if (statusEl) statusEl.innerText = 'Captured (quick). Save when ready.';
      }, 500);
    } catch (e) {
      if (statusEl) statusEl.innerText = 'Quick capture failed: ' + (e?.message || e);
    }
  });

  confirmBtn.onclick = async () => {
    const name = document.getElementById('enrollName').value.trim();
    const pin = document.getElementById('enrollPin').value.trim();
    if (!name) return alert('Name required');
    if (images.length === 0) return alert('No images captured');

    const fd = new FormData();
    fd.append('name', name);
    fd.append('pin', pin);
    images.forEach(i => fd.append('images[]', i));

    if (statusEl) statusEl.innerText = 'Uploading...';
    try {
      const res = await fetch('/api/enroll_from_camera', { method: 'POST', body: fd }).then(r => r.json());
      if (statusEl) statusEl.innerText = res.msg || 'Saved';
      if (res.status === 'ok') setTimeout(() => (location.href = '/mobile'), 900);
    } catch (e) {
      if (statusEl) statusEl.innerText = 'Upload error: ' + (e?.message || e);
    }
  };

  // stop camera on background
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      running = false;
      stopCameraAndMesh();
    }
  });

  // keep overlay size in sync
  requestAnimationFrame(function frameKeep() {
    overlay.width = video.clientWidth || video.videoWidth || overlay.width;
    overlay.height = video.clientHeight || video.videoHeight || overlay.height;
    requestAnimationFrame(frameKeep);
  });
}
