/******************************************************************************
 * CYBERLOCK — RESET PIN (FIXED EMAIL LOOKUP)
 ******************************************************************************/

window.addEventListener("DOMContentLoaded", () => {

/* -------------------------------------------------------------
   DOM REFERENCES
--------------------------------------------------------------*/
let state = { step: 1, email: "", otpSent: false };

const content = document.getElementById("content");
const nextBtn = document.getElementById("nextBtn");
const backBtn = document.getElementById("backBtn");

const labels = [
    null,
    document.getElementById("stepLabel-1"),
    document.getElementById("stepLabel-2"),
    document.getElementById("stepLabel-3")
];


/* -------------------------------------------------------------
   THEME SYSTEM
--------------------------------------------------------------*/
function applyTheme(theme) {
    document.body.classList.remove("theme-dark", "theme-neon", "theme-lite");
    document.body.classList.add("theme-" + theme);
    localStorage.setItem("theme", theme);
}

function cycleTheme() {
    const current = localStorage.getItem("theme") || "dark";
    if (current === "dark") applyTheme("neon");
    else if (current === "neon") applyTheme("lite");
    else applyTheme("dark");
}

applyTheme(localStorage.getItem("theme") || "dark");

const themeBtn = document.getElementById("theme-toggle");
themeBtn?.addEventListener("click", cycleTheme);

/* -------------------------------------------------------------
   CLOSE RESET
--------------------------------------------------------------*/
const closeBtn = document.getElementById("closeReset");
closeBtn?.addEventListener("click", () => {
    window.location.href = "/mobile";
});

/* -------------------------------------------------------------
   RENDER STEPS
--------------------------------------------------------------*/
function render() {
    for (let i = 1; i <= 3; i++) {
        if (labels[i]) labels[i].classList.toggle("active", i === state.step);
    }

    backBtn.style.display = state.step > 1 ? "inline-block" : "none";

    if (state.step === 1) stepEmail();
    if (state.step === 2) stepOTP();
    if (state.step === 3) stepPIN();

    nextBtn.textContent =
        state.step === 3 ? "Save PIN" :
        state.step === 2 ? "Verify OTP" :
        "Send OTP";
}

function message(txt, type = "ok") {
    let el = document.createElement("div");
    el.className = "message " + type;
    el.textContent = txt;
    content.prepend(el);
    setTimeout(() => el.remove(), 3500);
}

/* -------------------------------------------------------------
   STEP TEMPLATES
--------------------------------------------------------------*/
function stepEmail() {
    content.innerHTML = `
        <input id="email" type="email" placeholder="Enter your registered email" autocomplete="off">
        <div id="emailStatus" style="font-size: 12px; margin-top: 8px; color: #ffaa44;"></div>
        <button id="checkEmailBtn" class="btn ghost" style="margin-top: 10px; width: 100%;">Check Email</button>
    `;
    
    const emailInput = document.getElementById("email");
    const emailStatus = document.getElementById("emailStatus");
    const checkEmailBtn = document.getElementById("checkEmailBtn");
    
    if (checkEmailBtn) {
        checkEmailBtn.onclick = async () => {
            const email = emailInput.value.trim().toLowerCase();
            if (!email || !email.includes('@')) {
                emailStatus.innerHTML = '<span style="color: #ff4444;">❌ Please enter a valid email</span>';
                return;
            }
            
            emailStatus.innerHTML = '<span style="color: #00f2ff;">🔍 Checking email...</span>';
            
            try {
                const res = await fetch("/api/check_email_exists", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: email })
                });
                
                const data = await res.json();
                
                if (data.exists) {
                    emailStatus.innerHTML = '<span style="color: #4caf50;">✅ Email found! You can reset your PIN.</span>';
                    state.email = email;
                    // Auto-proceed to next step after 1 second
                    setTimeout(() => {
                        state.step = 2;
                        render();
                    }, 1000);
                } else {
                    emailStatus.innerHTML = '<span style="color: #ff4444;">❌ Email not registered. Please use a registered email.</span>';
                }
            } catch (err) {
                emailStatus.innerHTML = '<span style="color: #ff4444;">❌ Error checking email. Please try again.</span>';
                console.error("Email check error:", err);
            }
        };
    }
}

function stepOTP() {
    content.innerHTML = `
        <p class="lead" style="text-align: center;">OTP sent to <b>${state.email}</b></p>
        <input id="otp" type="text" maxlength="6" placeholder="Enter 6-digit OTP" autocomplete="off" style="text-align: center; font-size: 20px; letter-spacing: 4px;">
        <button id="resendOtp" class="btn ghost" style="margin-top: 10px; width: 100%;">Resend OTP</button>
        <div id="otpStatus" style="font-size: 12px; margin-top: 8px; text-align: center;"></div>
    `;
    
    // Auto-send OTP when step loads
    sendOTP();
    
    const resendBtn = document.getElementById("resendOtp");
    if (resendBtn) {
        resendBtn.addEventListener("click", () => {
            sendOTP();
        });
    }
}

function stepPIN() {
    content.innerHTML = `
        <label style="display: block; margin-bottom: 8px; font-size: 12px; color: #888;">NEW 4-DIGIT PIN</label>
        <input id="pin1" type="password" placeholder="••••" maxlength="4" pattern="\d{4}" autocomplete="off" style="text-align: center; font-size: 24px; letter-spacing: 8px;">
        <br><br>
        <label style="display: block; margin-bottom: 8px; font-size: 12px; color: #888;">CONFIRM PIN</label>
        <input id="pin2" type="password" placeholder="••••" maxlength="4" pattern="\d{4}" autocomplete="off" style="text-align: center; font-size: 24px; letter-spacing: 8px;">
        <div id="pinStatus" style="font-size: 12px; margin-top: 10px; text-align: center;"></div>
    `;
    
    const pin1 = document.getElementById("pin1");
    const pin2 = document.getElementById("pin2");
    const pinStatus = document.getElementById("pinStatus");
    
    // Restrict to digits only
    const restrictToDigits = (input) => {
        input.addEventListener("input", () => {
            input.value = input.value.replace(/\D/g, "");
            if (input.value.length > 4) {
                input.value = input.value.slice(0, 4);
            }
        });
    };
    
    restrictToDigits(pin1);
    restrictToDigits(pin2);
    
    // Validate PINs in real-time
    const validatePins = () => {
        const p1 = pin1.value;
        const p2 = pin2.value;
        
        if (p1.length === 4 && p2.length === 4) {
            if (p1 === p2) {
                pinStatus.innerHTML = '<span style="color: #4caf50;">✅ PINs match</span>';
                nextBtn.disabled = false;
                nextBtn.style.opacity = "1";
            } else {
                pinStatus.innerHTML = '<span style="color: #ff4444;">❌ PINs do not match</span>';
                nextBtn.disabled = true;
                nextBtn.style.opacity = "0.5";
            }
        } else {
            pinStatus.innerHTML = '<span style="color: #666;">Enter 4-digit PIN</span>';
            nextBtn.disabled = true;
            nextBtn.style.opacity = "0.5";
        }
    };
    
    pin1.addEventListener("input", validatePins);
    pin2.addEventListener("input", validatePins);
    validatePins();
}

/* -------------------------------------------------------------
   API CALLS
--------------------------------------------------------------*/
async function sendOTP() {
    if (!state.email) {
        message("Email is required", "err");
        return;
    }
    
    message("Sending OTP...", "ok");
    
    try {
        const res = await fetch("/api/request_reset", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: state.email })
        });
        
        const data = await res.json();
        
        if (res.ok && data.status === "ok") {
            message("✅ OTP sent to your email!", "ok");
            const otpStatus = document.getElementById("otpStatus");
            if (otpStatus) {
                otpStatus.innerHTML = '<span style="color: #4caf50;">📧 OTP sent! Check your email.</span>';
            }
        } else {
            message(data.message || "Failed to send OTP", "err");
            const otpStatus = document.getElementById("otpStatus");
            if (otpStatus) {
                otpStatus.innerHTML = `<span style="color: #ff4444;">❌ ${data.message || "Failed to send OTP"}</span>`;
            }
        }
    } catch (err) {
        console.error("Send OTP error:", err);
        message("Network error. Please try again.", "err");
    }
}

async function verifyOTP() {
    let code = document.getElementById("otp").value.trim();
    if (code.length < 4) {
        message("Please enter valid OTP", "err");
        return;
    }
    
    if (code.length !== 6) {
        message("OTP must be 6 digits", "err");
        return;
    }
    
    message("Verifying OTP...", "ok");
    
    try {
        const res = await fetch("/api/verify_reset_code", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                email: state.email, 
                code: code 
            })
        });
        
        const data = await res.json();
        
        if (res.ok && data.status === "success") {
            message("✅ OTP verified!", "ok");
            state.step = 3;
            render();
        } else {
            message(data.message || "Invalid OTP", "err");
        }
    } catch (err) {
        console.error("Verify OTP error:", err);
        message("Verification failed", "err");
    }
}

async function savePIN() {
    let p1 = document.getElementById("pin1").value;
    let p2 = document.getElementById("pin2").value;
    
    // Validate PIN
    if (!p1 || !p2) {
        message("Please enter PIN", "err");
        return;
    }
    
    if (p1.length !== 4) {
        message("PIN must be exactly 4 digits", "err");
        document.getElementById("pin1").classList.add("pin-error");
        setTimeout(() => document.getElementById("pin1").classList.remove("pin-error"), 1000);
        return;
    }
    
    if (!/^\d{4}$/.test(p1)) {
        message("PIN must contain only numbers", "err");
        return;
    }
    
    if (p1 !== p2) {
        message("PINs do not match", "err");
        return;
    }
    
    message("Updating PIN...", "ok");
    
    try {
        const res = await fetch("/api/set_new_pin", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                email: state.email,
                new_pin: p1 
            })
        });
        
        const data = await res.json();
        
        if (data.status === "ok") {
            message("✅ PIN UPDATED SUCCESSFULLY!", "ok");
            setTimeout(() => { 
                window.location.href = "/mobile"; 
            }, 1500);
        } else {
            message(data.message || "Failed to update PIN", "err");
        }
    } catch (err) {
        console.error("Save PIN error:", err);
        message("Network error. Please try again.", "err");
    }
}

/* -------------------------------------------------------------
   BUTTON HANDLERS
--------------------------------------------------------------*/
nextBtn.addEventListener("click", () => {
    if (state.step === 1) {
        const email = document.getElementById("email")?.value.trim().toLowerCase();
        if (!email || !email.includes('@')) {
            message("Please enter a valid email", "err");
            return;
        }
        state.email = email;
        state.step = 2;
        render();
    } else if (state.step === 2) {
        verifyOTP();
    } else if (state.step === 3) {
        savePIN();
    }
});

backBtn.addEventListener("click", () => {
    if (state.step > 1) {
        state.step--;
        render();
    }
});

/* -------------------------------------------------------------
   INITIALIZE
--------------------------------------------------------------*/
render();

});