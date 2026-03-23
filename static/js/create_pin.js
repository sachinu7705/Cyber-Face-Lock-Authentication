window.addEventListener("DOMContentLoaded", () => {

let state = { step: 1, email: "", username: "", tempPin: "" };

const content = document.getElementById("content");
const nextBtn = document.getElementById("nextBtn");
const backBtn = document.getElementById("backBtn");

const labels = [
    null,
    document.getElementById("stepLabel-1"),
    document.getElementById("stepLabel-2"),
    document.getElementById("stepLabel-3")
];

/* ---------------- THEME ---------------- */
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

document.getElementById("theme-toggle")?.addEventListener("click", cycleTheme);

/* ---------------- CLOSE ---------------- */
document.getElementById("closeCreate")?.addEventListener("click", () => {
    window.location.href = "/mobile";
});

/* ---------------- UI ---------------- */
function render() {
    content.innerHTML = "";

    for (let i = 1; i <= 3; i++) {
        if (labels[i]) labels[i].classList.toggle("active", i === state.step);
    }

    backBtn.style.display = state.step > 1 ? "inline-block" : "none";

    switch (state.step) {
        case 1:
            stepEmailAndUsername();
            break;
        case 2:
            stepOTP();
            break;
        case 3:
            stepPIN();
            break;
    }

    nextBtn.textContent = state.step === 3 ? "Create PIN" : "Continue";
}

function message(txt, type = "ok") {
    let el = document.createElement("div");
    el.className = "message " + type;
    el.textContent = txt;
    content.prepend(el);
    setTimeout(() => el.remove(), 3000);
}

/* ---------------- STEP 1: EMAIL & USERNAME ---------------- */
function stepEmailAndUsername() {
    content.innerHTML = `
        <label style="display: block; margin-bottom: 5px; font-size: 12px; color: #888;">USERNAME</label>
        <input id="username" type="text" placeholder="Choose a username (e.g., john_doe)" autocomplete="off" style="margin-bottom: 15px;">
        <div id="usernameStatus" style="font-size: 12px; margin-top: -10px; margin-bottom: 15px; color: #666;"></div>
        
        <label style="display: block; margin-bottom: 5px; font-size: 12px; color: #888;">EMAIL</label>
        <input id="email" type="email" placeholder="Enter your email" autocomplete="off">
        <div id="emailStatus" style="font-size: 12px; margin-top: 5px; color: #666;"></div>
    `;
    
    const usernameInput = document.getElementById("username");
    const emailInput = document.getElementById("email");
    const usernameStatus = document.getElementById("usernameStatus");
    const emailStatus = document.getElementById("emailStatus");
    
    let usernameValid = false;
    let emailValid = false;
    
    // Check username availability
    const checkUsername = async (username) => {
        if (!username || username.length < 3) {
            usernameStatus.innerHTML = '<span style="color: #ffaa44;">⚠️ Username must be at least 3 characters</span>';
            usernameValid = false;
            updateNextButton();
            return;
        }
        
        // Check if username contains only allowed characters
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            usernameStatus.innerHTML = '<span style="color: #ff4444;">❌ Username can only contain letters, numbers, and underscores</span>';
            usernameValid = false;
            updateNextButton();
            return;
        }
        
        try {
            const res = await fetch("/api/check_username_exists", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: username })
            });
            const data = await res.json();
            
            if (data.exists) {
                usernameStatus.innerHTML = '<span style="color: #ff4444;">❌ Username already taken. Please choose another.</span>';
                usernameValid = false;
            } else {
                usernameStatus.innerHTML = '<span style="color: #4caf50;">✅ Username available!</span>';
                usernameValid = true;
                state.username = username;
            }
        } catch (err) {
            console.error("Username check error:", err);
            usernameStatus.innerHTML = '<span style="color: #ff4444;">❌ Error checking username</span>';
            usernameValid = false;
        }
        updateNextButton();
    };
    
    // Check email availability
    const checkEmail = async (email) => {
        if (!email || !email.includes('@')) {
            emailStatus.innerHTML = '';
            emailValid = false;
            updateNextButton();
            return;
        }
        
        try {
            const res = await fetch("/api/check_email_exists", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: email })
            });
            const data = await res.json();
            
            if (data.exists) {
                emailStatus.innerHTML = '<span style="color: #ff4444;">⚠️ Email already registered. Please use a different email.</span>';
                emailValid = false;
            } else {
                emailStatus.innerHTML = '<span style="color: #4caf50;">✅ Email available!</span>';
                emailValid = true;
                state.email = email;
            }
        } catch (err) {
            console.error("Email check error:", err);
            emailStatus.innerHTML = '<span style="color: #ff4444;">❌ Error checking email</span>';
            emailValid = false;
        }
        updateNextButton();
    };
    
    const updateNextButton = () => {
        if (usernameValid && emailValid) {
            nextBtn.disabled = false;
            nextBtn.style.opacity = "1";
        } else {
            nextBtn.disabled = true;
            nextBtn.style.opacity = "0.5";
        }
    };
    
    let usernameTimeout;
    if (usernameInput) {
        usernameInput.addEventListener("input", (e) => {
            clearTimeout(usernameTimeout);
            const username = e.target.value.trim();
            usernameTimeout = setTimeout(() => checkUsername(username), 500);
        });
    }
    
    let emailTimeout;
    if (emailInput) {
        emailInput.addEventListener("input", (e) => {
            clearTimeout(emailTimeout);
            const email = e.target.value.trim().toLowerCase();
            emailTimeout = setTimeout(() => checkEmail(email), 500);
        });
    }
}

function stepOTP() {
    content.innerHTML = `
        <p class="lead" style="text-align: center;">OTP sent to <b>${state.email}</b></p>
        <input id="otp" type="text" maxlength="6" placeholder="Enter 6-digit OTP" autocomplete="off" style="text-align: center; font-size: 20px; letter-spacing: 4px;">
        <button id="resendOtp" class="btn ghost" style="margin-top: 10px; width: 100%;">Resend OTP</button>
    `;
    
    // Auto-send OTP when step loads
    sendOTP();
    
    document.getElementById("resendOtp")?.addEventListener("click", () => {
        sendOTP();
    });
}

function stepPIN() {
    content.innerHTML = `
        <input id="pin1" type="password" placeholder="Enter 4-digit PIN" maxlength="4" pattern="\d{4}" autocomplete="off" style="text-align: center; font-size: 20px; letter-spacing: 4px;">
        <br><br>
        <input id="pin2" type="password" placeholder="Confirm PIN" maxlength="4" pattern="\d{4}" autocomplete="off" style="text-align: center; font-size: 20px; letter-spacing: 4px;">
        <div id="pinStatus" style="font-size: 12px; margin-top: 5px;"></div>
    `;
    
    const pin1 = document.getElementById("pin1");
    const pin2 = document.getElementById("pin2");
    const pinStatus = document.getElementById("pinStatus");
    
    const validatePin = () => {
        const p1 = pin1.value;
        const p2 = pin2.value;
        
        if (p1.length === 4 && p2.length === 4) {
            if (p1 === p2 && /^\d{4}$/.test(p1)) {
                pinStatus.innerHTML = '<span style="color: #4caf50;">✅ PINs match</span>';
                nextBtn.disabled = false;
                nextBtn.style.opacity = "1";
                state.tempPin = p1;
            } else if (p1 !== p2) {
                pinStatus.innerHTML = '<span style="color: #ff4444;">❌ PINs do not match</span>';
                nextBtn.disabled = true;
                nextBtn.style.opacity = "0.5";
            } else if (!/^\d{4}$/.test(p1)) {
                pinStatus.innerHTML = '<span style="color: #ff4444;">❌ PIN must be exactly 4 digits</span>';
                nextBtn.disabled = true;
                nextBtn.style.opacity = "0.5";
            }
        } else {
            pinStatus.innerHTML = '<span style="color: #666;">PIN must be 4 digits</span>';
            nextBtn.disabled = true;
            nextBtn.style.opacity = "0.5";
        }
    };
    
    pin1.addEventListener("input", validatePin);
    pin2.addEventListener("input", validatePin);
    validatePin();
}

/* ---------------- API FUNCTIONS ---------------- */
async function sendOTP() {
    const email = state.email;
    if (!email) {
        message("Email is required", "err");
        return;
    }
    
    message("Sending OTP...", "ok");
    
    try {
        const res = await fetch("/api/send_create_otp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: email, mode: "create" })
        });
        
        const data = await res.json();
        
        if (res.ok) {
            message("OTP sent to your email!", "ok");
        } else {
            message(data.message || "Failed to send OTP", "err");
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
    
    try {
        const res = await fetch("/api/verify_create_otp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: state.email, code: code })
        });
        
        const data = await res.json();
        
        if (res.ok && data.status === "success") {
            message("OTP verified!", "ok");
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

async function createPIN() {
    const pin = state.tempPin;
    const username = state.username;
    const email = state.email;
    
    if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
        message("Please enter a valid 4-digit PIN", "err");
        return;
    }
    
    if (!username) {
        message("Username is required", "err");
        return;
    }
    
    try {
        const res = await fetch("/api/create_user_account", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                email: email,
                username: username,
                pin: pin 
            })
        });
        
        const data = await res.json();
        
        if (res.ok && data.status === "success") {
            message(`Account "${username}" created successfully!`, "ok");
            setTimeout(() => {
                window.location.href = "/mobile";
            }, 1500);
        } else {
            message(data.message || "Failed to create account", "err");
        }
    } catch (err) {
        console.error("Create account error:", err);
        message("Network error. Please try again.", "err");
    }
}

/* ---------------- BUTTON HANDLERS ---------------- */
nextBtn.addEventListener("click", (e) => {
    e.preventDefault();
    
    if (state.step === 1) {
        const username = document.getElementById("username").value.trim();
        const email = document.getElementById("email").value.trim().toLowerCase();
        
        if (!username) {
            message("Please enter a username", "err");
            return;
        }
        
        if (!email || !email.includes('@')) {
            message("Please enter a valid email address", "err");
            return;
        }
        
        state.username = username;
        state.email = email;
        
        // Double-check both are available
        Promise.all([
            fetch("/api/check_username_exists", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: username })
            }),
            fetch("/api/check_email_exists", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: email })
            })
        ])
        .then(async ([userRes, emailRes]) => {
            const userData = await userRes.json();
            const emailData = await emailRes.json();
            
            if (userData.exists) {
                message(`Username "${username}" is already taken. Please choose another.`, "err");
                return;
            }
            if (emailData.exists) {
                message("Email already registered. Please use a different email.", "err");
                return;
            }
            
            state.step = 2;
            render();
        })
        .catch(err => {
            message("Error checking availability", "err");
        });
        
    } else if (state.step === 2) {
        verifyOTP();
        
    } else if (state.step === 3) {
        createPIN();
    }
});

backBtn.addEventListener("click", () => {
    if (state.step > 1) {
        state.step--;
        render();
    }
});

render();

});