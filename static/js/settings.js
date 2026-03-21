// settings.js
// Keys: APP_LOCK_PIN, LOCKED_APPS (array), CUSTOM_APPS (array)
// Admin PIN is 0909

const ADMIN_PIN = "0909";
const PIN_KEY = "APP_LOCK_PIN";
const LOCKED_APPS_KEY = "LOCKED_APPS";
const CUSTOM_APPS_KEY = "CUSTOM_APPS";

const el = id => document.getElementById(id);
const firstRun = el('firstRun'), manageRun = el('managePin');
const pinMsg = el('pinMsg');

function hasPin(){ return !!localStorage.getItem(PIN_KEY); }
function showState(){
  if(hasPin()){
    firstRun.style.display = 'none';
    manageRun.style.display = 'block';
  } else {
    firstRun.style.display = 'block';
    manageRun.style.display = 'none';
  }
  pinMsg.innerText = '';
}
showState();

// Save new PIN (first time)
el('savePinBtn')?.addEventListener('click', ()=>{
  const a = el('newPin').value.trim(), b = el('confPin').value.trim();
  if(!a || a.length < 4) { pinMsg.innerText = 'PIN must be at least 4 digits'; return; }
  if(a !== b){ pinMsg.innerText = 'PINs do not match'; return; }
  localStorage.setItem(PIN_KEY, a);
  pinMsg.innerText = 'PIN saved ✅';
  el('newPin').value=''; el('confPin').value='';
  showState();
});

// Change PIN (when already set)
el('changePinBtn')?.addEventListener('click', ()=>{
  const newPin = el('changePin').value.trim();
  if(!newPin || newPin.length < 4){ pinMsg.innerText = 'Enter valid PIN'; return; }
  // require confirmation via current PIN or face? We'll ask current PIN now
  const cur = prompt('Enter current Privacy PIN (or Admin PIN 0909)');
  if(cur === ADMIN_PIN || cur === localStorage.getItem(PIN_KEY)){
    localStorage.setItem(PIN_KEY, newPin);
    pinMsg.innerText = 'PIN changed successfully';
    el('changePin').value = '';
  } else pinMsg.innerText = 'Authorization failed';
});

// Forgot PIN -> allow reset via Face OR Admin PIN
el('forgotPinBtn')?.addEventListener('click', async ()=>{
  pinMsg.innerText = 'Verifying identity... (face or admin PIN)';
  // Option 1: ask for admin PIN quickly
  const maybeAdmin = prompt('Enter Admin PIN (or leave empty to verify by face)');
  if(maybeAdmin === ADMIN_PIN){
    const np = prompt('Enter new PIN (4-8 digits)');
    if(np && np.length >=4){ localStorage.setItem(PIN_KEY, np); pinMsg.innerText='PIN reset via Admin'; showState(); return; }
  }

  // Option 2: Face verification - open quick camera and POST to /api/unlock_from_camera
  try {
    pinMsg.innerText = 'Opening camera for face verification...';
    const stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'}});
    const v = document.createElement('video'); v.autoplay = true; v.playsInline = true; v.srcObject = stream;
    await v.play();
    // take snapshot after 1s
    await new Promise(r=>setTimeout(r, 900));
    const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d').drawImage(v,0,0,c.width,c.height);
    const dataUrl = c.toDataURL('image/jpeg',0.9);
    // stop stream
    stream.getTracks().forEach(t=>t.stop());
    pinMsg.innerText = 'Verifying face...';
    const fd = new FormData(); fd.append('image', dataUrl);
    const res = await fetch('/api/unlock_from_camera',{method:'POST', body:fd}).then(r=>r.json()).catch(e=>({status:'error', msg:e}));
    if(res.status === 'ok'){
      const np = prompt(`Face matched (${res.user}). Enter new PIN (4-8 digits)`);
      if(np && np.length >= 4){ localStorage.setItem(PIN_KEY, np); pinMsg.innerText = 'PIN reset by face ✓'; showState(); return; }
    } else {
      pinMsg.innerText = 'Face verification failed';
    }
  } catch(e){
    console.error(e);
    pinMsg.innerText = 'Face verification failed or camera error';
  }
});

// Reset All -> clears PIN and locked apps (confirmation)
el('resetAllBtn')?.addEventListener('click', ()=>{
  if(!confirm('Reset all App Locker data? This will remove PIN and locked apps.')) return;
  localStorage.removeItem(PIN_KEY);
  localStorage.removeItem(LOCKED_APPS_KEY);
  localStorage.removeItem(CUSTOM_APPS_KEY);
  pinMsg.innerText = 'All data cleared';
  showState();
});

// init show
showState();
