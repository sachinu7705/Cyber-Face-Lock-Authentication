window.addEventListener("DOMContentLoaded", () => {

let state = { step: 1, email: "" };

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
    // 🔥 CLEAR OLD CONTENT (VERY IMPORTANT)
    content.innerHTML = "";

    for (let i = 1; i <= 3; i++) {
        labels[i].classList.toggle("active", i === state.step);
    }

    backBtn.style.display = state.step > 1 ? "inline-block" : "none";

    // 🔥 SWITCH prevents duplicate rendering
    switch (state.step) {
        case 1:
            stepEmail();
            break;
        case 2:
            stepOTP();
            break;
        case 3:
            stepPIN();
            break;
    }

    nextBtn.textContent =
        state.step === 3 ? "Create PIN" :
        state.step === 2 ? "Verify OTP" :
        "Send OTP";
}

function message(txt, type = "ok") {
    let el = document.createElement("div");
    el.className = "message " + type;
    el.textContent = txt;
    content.prepend(el);
    setTimeout(() => el.remove(), 3000);
}

/* ---------------- STEPS ---------------- */
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

/* ---------------- API ---------------- */
async function sendOTP() {
    let email = document.getElementById("email").value.trim();
    if (!email) return message("Enter email", "err");

    state.email = email;

    const res = await fetch("/api/send_create_otp", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            email,
            mode: "create"
        })
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

    const res = await fetch("/api/verify_create_otp", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ email: state.email, code })
    });

    const data = await res.json();
    if (!res.ok) return message(data.message, "err");

    message("OTP verified!");
    state.step = 3;
    render();
}

async function createPIN() {
    let p1 = document.getElementById("pin1").value;
    let p2 = document.getElementById("pin2").value;

    if (p1 !== p2) return message("PIN mismatch", "err");

    const res = await fetch("/api/create_pin", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ email: state.email, pin: p1 })
    });

    // ✅ FIRST get data
    const data = await res.json();

    console.log("CREATE PIN RESPONSE:", data); // debug

    // ✅ THEN check response
    if (!res.ok) return message(data.message, "err");

    message("PIN created!");

    setTimeout(() => {
        window.location.href = "/mobile";
    }, 800);
}
/* ---------------- BUTTONS ---------------- */
nextBtn.addEventListener("click", (e) => {
    e.preventDefault();   // 🔥 prevents reload

    if (state.step === 1) return sendOTP();
    if (state.step === 2) return verifyOTP();
    if (state.step === 3) return createPIN();
});

backBtn.addEventListener("click", () => {
    if (state.step > 1) {
        state.step--;
        render();
    }
});

/* ---------------- START ---------------- */
render();

});