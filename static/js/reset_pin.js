document.addEventListener("DOMContentLoaded", () => {

    const emailInput = document.getElementById("emailInput");
    const sendOtpBtn = document.getElementById("sendOtpBtn");
    const verifyOtpBtn = document.getElementById("verifyOtpBtn");
    const savePinBtn = document.getElementById("savePinBtn");

    const otpSection = document.getElementById("otpSection");
    const pinSection = document.getElementById("pinSection");

    const status = document.getElementById("status");
    const otpBoxes = Array.from(document.querySelectorAll(".otp-box"));

    const resendWrapper = document.getElementById("resendWrapper");
    const resendBtn = document.getElementById("resendBtn");

    let timerInterval = null;

    // -------------------------
    // Allow ONLY digits in PIN
    // -------------------------
    ["pin1", "pin2"].forEach(id => {
        const box = document.getElementById(id);
        box.addEventListener("input", () => {
            box.value = box.value.replace(/\D/g, ""); // remove non-digits
        });
    });

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

    // ------------------------
    // SEND OTP
    // ------------------------
    sendOtpBtn.onclick = async () => {
        status.innerText = "";

        let fd = new FormData();
        fd.append("email", emailInput.value.trim());

        let res = await fetch("/api/send_reset_email", {
            method: "POST",
            body: fd
        });

        let data = await res.json();
        status.innerText = data.msg;

        if (data.status === "ok") {
            otpSection.style.display = "block";
            otpBoxes[0].focus();

            startTimer(); 
        }
    };

    // ------------------------
    // RESEND OTP
    // ------------------------
    resendBtn.onclick = () => {
        if (!resendBtn.classList.contains("resend-enabled")) return;
        sendOtpBtn.onclick();
    };

    // ------------------------
    // OTP Behavior
    // ------------------------
    otpBoxes.forEach((box, idx) => {
        box.addEventListener("input", () => {
            box.value = box.value.replace(/\D/g, ""); 
            if (box.value.length === 1 && idx < 5) otpBoxes[idx + 1].focus();
        });
    });

    // ------------------------
    // VERIFY OTP
    // ------------------------
    verifyOtpBtn.onclick = async () => {
        let code = otpBoxes.map(b => b.value).join("");

        let fd = new FormData();
        fd.append("email", emailInput.value.trim());
        fd.append("code", code);

        let res = await fetch("/api/verify_email_code", {
            method: "POST",
            body: fd
        });

        let data = await res.json();
        status.innerText = data.msg;
        if (data.status === "ok") {
            document.getElementById("pinPopup").classList.remove("hidden");
            document.getElementById("modalPin1").focus();
        }

        else {
            otpBoxes.forEach(b => {
                b.value = "";
                b.classList.add("shake", "otp-error");
            });

            setTimeout(() => otpBoxes.forEach(b => b.classList.remove("shake")), 400);
            setTimeout(() => otpBoxes.forEach(b => b.classList.remove("otp-error")), 1000);

            otpBoxes[0].focus();
        }
    };

    // ------------------------
    // SAVE NEW PIN
    // ------------------------
    savePinBtn.onclick = async () => {
        const p1 = document.getElementById("pin1").value;
        const p2 = document.getElementById("pin2").value;

        if (p1.length !== 4 || p2.length !== 4) {
            status.innerText = "PIN must be exactly 4 digits.";
            return;
        }

        if (p1 !== p2) {
            status.innerText = "PINs do not match.";

            const p1b = document.getElementById("pin1");
            const p2b = document.getElementById("pin2");

            p1b.classList.add("shake", "pin-error");
            p2b.classList.add("shake", "pin-error");

            setTimeout(() => {
                p1b.classList.remove("shake");
                p2b.classList.remove("shake");
            }, 400);

            setTimeout(() => {
                p1b.classList.remove("pin-error");
                p2b.classList.remove("pin-error");
            }, 1000);

            return;
        }

        let fd = new FormData();
        fd.append("pin", p1);

        let res = await fetch("/api/reset_pin", {
            method: "POST",
            body: fd
        });

        let data = await res.json();
        status.innerText = data.msg;

        if (data.status === "ok") {
            document.querySelector("main").innerHTML = `
                <div class="success-wrapper">
                    <div class="success-check"></div>
                    <div class="success-text">PIN Updated!</div>
                </div>
            `;

            setTimeout(() => location.reload(), 2500);
        }
    };

});
document.getElementById("modalSavePinBtn").onclick = async () => {

    const p1 = document.getElementById("modalPin1").value.trim();
    const p2 = document.getElementById("modalPin2").value.trim();

    if (p1.length !== 4 || p2.length !== 4) {
        status.innerText = "PIN must be 4 digits.";
        return;
    }

    if (p1 !== p2) {
        status.innerText = "PINs do not match.";

        let m1 = document.getElementById("modalPin1");
        let m2 = document.getElementById("modalPin2");

        m1.classList.add("shake", "pin-error");
        m2.classList.add("shake", "pin-error");

        setTimeout(() => {
            m1.classList.remove("shake");
            m2.classList.remove("shake");
        }, 400);

        return;
    }

    let fd = new FormData();
    fd.append("pin", p1);

    let res = await fetch("/api/reset_pin", {
        method: "POST",
        body: fd
    });

    let data = await res.json();
    status.innerText = data.msg;

    if (data.status === "ok") {
        document.getElementById("pinPopup").innerHTML = `
            <div class="pin-popup-box">
                <div class="pin-popup-title">PIN Updated ✔</div>
            </div>
        `;
        setTimeout(() => location.reload(), 1800);
    }
};
