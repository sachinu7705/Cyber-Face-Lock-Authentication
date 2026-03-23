document.addEventListener("DOMContentLoaded", () => {

    const emailInput = document.getElementById("emailInput");
    const sendBtn = document.getElementById("sendCodeBtn");
    const verifyBtn = document.getElementById("verifyBtn");
    const step2 = document.getElementById("step2");
    const status = document.getElementById("status");

    const resendWrapper = document.getElementById("resendWrapper");
    const resendBtn = document.getElementById("resendBtn");

    const otpBoxes = Array.from(document.querySelectorAll(".otp-box"));

    let timerInterval = null;

    
    // -----------------------------
    // START RESEND TIMER
    // -----------------------------
    function startTimer() {
        let timeLeft = 60;

        resendBtn.innerText = `Resend Code (${timeLeft}s)`;
        resendBtn.classList.add("resend-disabled");
        resendBtn.classList.remove("resend-enabled");

        resendWrapper.style.display = "block";

        timerInterval = setInterval(() => {
            timeLeft--;
            resendBtn.innerText = `Resend Code (${timeLeft}s)`;

            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                resendBtn.innerText = "Resend Code";
                resendBtn.classList.remove("resend-disabled");
                resendBtn.classList.add("resend-enabled");
            }
        }, 1000);
    }

    // -----------------------------
    // SEND VERIFICATION CODE
    // -----------------------------
    async function sendVerificationCode() {
        status.innerText = "";
        let email = emailInput.value.trim();

        if (!email) {
            status.innerText = "Enter an email first.";
            return;
        }

        let fd = new FormData();
        fd.append("email", email);

        let res = await fetch("/api/send_reset_email", {
            method: "POST",
            body: fd
        });

        let data = await res.json();
        status.innerText = data.msg;

        if (data.status === "ok") {
            step2.style.display = "block";
            otpBoxes[0].focus();

            startTimer();  // start resend timer
        }
    }

    sendBtn.onclick = sendVerificationCode;

    // -----------------------------
    // RESEND BTN
    // -----------------------------
    resendBtn.onclick = async () => {
        if (resendBtn.classList.contains("resend-disabled")) return;

        sendVerificationCode(); // reuse same function
    };

    // -----------------------------
    // OTP BEHAVIOR
    // -----------------------------
    otpBoxes.forEach((box, idx) => {

        box.addEventListener("input", () => {
            if (box.value.length === 1 && idx < 5) {
                otpBoxes[idx + 1].focus();
            }
        });

        box.addEventListener("keydown", (e) => {
            if (e.key === "Backspace" && box.value === "" && idx > 0) {
                otpBoxes[idx - 1].focus();
            }
        });

    });

    otpBoxes[0].addEventListener("paste", (e) => {
        let paste = e.clipboardData.getData("text").trim();
        if (paste.length === 6) {
            otpBoxes.forEach((box, i) => box.value = paste[i]);
            otpBoxes[5].focus();
        }
    });

    // -----------------------------
    // VERIFY CODE + SAVE EMAIL
    // -----------------------------
    verifyBtn.onclick = async () => {
        status.innerText = "";

        let email = emailInput.value.trim();
        let code = otpBoxes.map(b => b.value).join("");

        if (code.length !== 6) {
            status.innerText = "Enter the full 6-digit code.";
            return;
        }

        let fd = new FormData();
        fd.append("email", email);
        fd.append("code", code);

        let verifyRes = await fetch("/api/verify_email_code", {
            method: "POST",
            body: fd
        });

        let verifyData = await verifyRes.json();
        status.innerText = verifyData.msg;

        // -----------------------------------
        // WRONG OTP — SHAKE + AUTO CLEAR
        // -----------------------------------
        if (verifyData.status !== "ok") {

            // shake + red glow
            otpBoxes.forEach(b => {
                b.classList.add("shake");
                b.classList.add("otp-error");
            });

            // remove shake class
            setTimeout(() => {
                otpBoxes.forEach(b => b.classList.remove("shake"));
            }, 400);

            // remove red glow
            setTimeout(() => {
                otpBoxes.forEach(b => b.classList.remove("otp-error"));
            }, 1000);

            // auto-clear OTP
            otpBoxes.forEach(b => b.value = "");

            // refocus first box
            setTimeout(() => {
                otpBoxes[0].focus();
            }, 120);

            return;
        }

        // -----------------------------
        // SAVE EMAIL
        // -----------------------------
        const emailToSave = emailInput.value.trim(); // Get the email string

        let saveRes = await fetch("/api/register_email", {
            method: "POST",
            headers: { "Content-Type": "application/json" }, // Tell server we are sending JSON
            body: JSON.stringify({ email: emailToSave })    // Send as JSON object
        });
                let saveData = await saveRes.json();

        // -----------------------------
        // SUCCESS ANIMATION
        // -----------------------------
        document.querySelector("main").innerHTML = `
            <div class="success-wrapper">
                <div class="success-check"></div>
                <div class="success-text">Email Saved Successfully!</div>
            </div>
        `;

        // reload after animation
        setTimeout(() => {
            location.reload();
        }, 2500);
    };

});
