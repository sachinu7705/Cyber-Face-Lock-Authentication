/******************************************************************************
 * CYBERLOCK — RESET PIN (FULL FIXED VERSION)
 ******************************************************************************/

window.addEventListener("DOMContentLoaded", () => {

/* -------------------------------------------------------------
   DOM REFERENCES (NOW SAFE because DOM IS LOADED)
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
        labels[i].classList.toggle("active", i === state.step);
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
        <input id="email" type="email" placeholder="Enter your email">
    `;
}

function stepOTP() {
    content.innerHTML = `
        <p class="lead">OTP sent to <b>${state.email}</b></p>
        <input id="otp" type="text" maxlength="6" placeholder="Enter OTP">
    `;
}

function stepPIN() {
    content.innerHTML = `
        <input id="pin1" type="password" placeholder="New PIN">
        <br><br>
        <input id="pin2" type="password" placeholder="Confirm PIN">
    `;
}

/* -------------------------------------------------------------
   API CALLS
--------------------------------------------------------------*/
async function sendOTP() {
    let email = document.getElementById("email").value.trim();
    if (!email) return message("Enter email", "err");

    state.email = email;

    const res = await fetch("/api/request_reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
    });

    const data = await res.json();
    if (!res.ok) return message(data.message, "err");

    message("OTP sent!");
    state.step = 2;
    render();
}

async function verifyOTP() {
    let code = document.getElementById("otp").value.trim();
    if (code.length < 4) return message("Invalid OTP", "err");

    const res = await fetch("/api/verify_reset_code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: state.email, code })
    });

    const data = await res.json();
    if (!res.ok) return message(data.message, "err");

    message("OTP verified!");
    state.step = 3;
    render();
}

async function savePIN() {
    let p1 = document.getElementById("pin1").value;
    let p2 = document.getElementById("pin2").value;

    if (p1 !== p2) return message("PIN mismatch", "err");

    const res = await fetch("/api/set_new_pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: state.email, new_pin: p1 })
    });

    const data = await res.json();
    if (!res.ok) return message(data.message, "err");

    message("PIN updated!");

    setTimeout(() => {
        window.location.href = "/mobile";
    }, 800);
}

/* -------------------------------------------------------------
   BUTTON HANDLERS
--------------------------------------------------------------*/
nextBtn.addEventListener("click", () => {
    if (state.step === 1) return sendOTP();
    if (state.step === 2) return verifyOTP();
    if (state.step === 3) return savePIN();
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
