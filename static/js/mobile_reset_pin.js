console.log("Reset PIN — Cyber Enhanced");

const emailBox = document.getElementById("stepEmail");
const codeBox = document.getElementById("stepCode");
const newPinBox = document.getElementById("stepNewPin");

const msgEmail = document.getElementById("msgEmail");
const msgCode = document.getElementById("msgCode");
const msgPin = document.getElementById("msgPin");

const resendTimer = document.getElementById("resendTimer");
const tCount = document.getElementById("tCount");
const holoSuccess = document.getElementById("holoSuccess");

let emailGlobal = "";
let timer;

// Utility
function show(step) {
    emailBox.classList.add("hidden");
    codeBox.classList.add("hidden");
    newPinBox.classList.add("hidden");
    step.classList.remove("hidden");
}

// Step 1: Send reset email
document.getElementById("sendCodeBtn").onclick = async () => {
    const email = document.getElementById("emailInput").value.trim();
    if (!email) {
        msgEmail.textContent = "Enter email.";
        emailBox.classList.add("shake");
        setTimeout(() => emailBox.classList.remove("shake"), 400);
        return;
    }

    msgEmail.textContent = "Sending...";
    emailGlobal = email;

    const fd = new FormData();
    fd.append("email", email);

    let r = await fetch("/api/send_reset_email", { method: "POST", body: fd });
    let d = await r.json();

    if (d.status === "ok") {
        msgEmail.textContent = "✔ Code sent!";
        startTimer();
        show(codeBox);
    } else {
        msgEmail.textContent = "Error: " + d.msg;
    }
};

// Email resend timer
function startTimer() {
    let sec = 30;
    resendTimer.classList.remove("hidden");

    timer = setInterval(() => {
        tCount.textContent = sec;
        sec--;
        if (sec < 0) {
            clearInterval(timer);
            resendTimer.textContent = "You can request again.";
        }
    }, 1000);
}

// Step 2: Verify code
document.getElementById("verifyCodeBtn").onclick = async () => {
    const code = document.getElementById("codeInput").value.trim();
    if (!code) {
        msgCode.textContent = "Enter code.";
        codeBox.classList.add("shake");
        setTimeout(() => codeBox.classList.remove("shake"), 400);
        return;
    }

    msgCode.textContent = "Verifying...";

    const fd = new FormData();
    fd.append("email", emailGlobal);
    fd.append("code", code);

    let r = await fetch("/api/verify_email_code", { method: "POST", body: fd });
    let d = await r.json();

    if (d.status === "ok") {
        msgCode.textContent = "✔ Verified!";
        show(newPinBox);
    } else {
        msgCode.textContent = "Invalid code.";
        codeBox.classList.add("shake");
        setTimeout(() => codeBox.classList.remove("shake"), 400);
    }
};

// Step 3: Reset PIN
document.getElementById("setNewPinBtn").onclick = async () => {
    const newPin = document.getElementById("newPinInput").value.trim();

    if (!newPin || newPin.length < 4) {
        msgPin.textContent = "PIN must be 4+ digits.";
        newPinBox.classList.add("shake");
        setTimeout(() => newPinBox.classList.remove("shake"), 400);
        return;
    }

    msgPin.textContent = "Updating...";

    const fd = new FormData();
    fd.append("new_pin", newPin);

    let r = await fetch("/api/reset_pin", { method: "POST", body: fd });
    let d = await r.json();

    if (d.status === "ok") {
        msgPin.textContent = "";
        holoSuccess.classList.remove("hidden");

        setTimeout(() => {
            window.location.href = "/mobile";
        }, 1800);
    } else {
        msgPin.textContent = "Error: " + d.msg;
    }
};
