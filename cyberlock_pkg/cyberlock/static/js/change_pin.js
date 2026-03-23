document.addEventListener("DOMContentLoaded", () => {
    const oldPinInput = document.getElementById("oldPin");
    const checkOldBtn = document.getElementById("checkOldPinBtn");
    const status = document.getElementById("status");

    const popup = document.getElementById("pinPopup");
    const modalPin1 = document.getElementById("modalPin1");
    const modalPin2 = document.getElementById("modalPin2");
    const modalSave = document.getElementById("modalSavePinBtn");

    // Get email from localStorage or fallback to your primary email
    const email = localStorage.getItem("email") || "sachinu0404@gmail.com"; 

    // Restrict input to digits only
    const restrictToDigits = (input) => {
        input.addEventListener("input", () => {
            input.value = input.value.replace(/\D/g, "");
        });
    };

    restrictToDigits(oldPinInput);
    [modalPin1, modalPin2].forEach(restrictToDigits);

    // ---------------------------
    // 1. CHECK OLD PIN
    // ---------------------------
    checkOldBtn.onclick = async () => {
        const oldPinValue = oldPinInput.value.trim();

        if (!oldPinValue) {
            status.innerText = "Please enter your current PIN.";
            return;
        }

        try {
            const res = await fetch("/api/check_old_pin", {
                method: "POST",
                headers: { "Content-Type": "application/json" }, // ✅ FIX: Added JSON header
                body: JSON.stringify({ 
                    old_pin: oldPinValue, 
                    email: email 
                }) // ✅ FIX: Sending JSON string
            });

            const data = await res.json();
            status.innerText = data.msg;

            if (data.status === "ok") {
                popup.classList.remove("hidden");
                modalPin1.focus();
            } else {
                oldPinInput.classList.add("shake", "pin-error");
                if (navigator.vibrate) navigator.vibrate(150);
                setTimeout(() => oldPinInput.classList.remove("shake"), 400);
                setTimeout(() => oldPinInput.classList.remove("pin-error"), 800);
            }
        } catch (err) {
            status.innerText = "Server communication error.";
        }
    };


    // ---------------------------
    // SAVE NEW PIN (FIXED RESPONSE HANDLING)
    // ---------------------------
    modalSave.onclick = async () => {
        const p1 = modalPin1.value.trim();
        const p2 = modalPin2.value.trim();
        const old_pin = oldPinInput.value.trim();

        if (p1.length !== 4 || p2.length !== 4) {
            status.innerText = "PIN must be 4 digits.";
            return;
        }

        if (p1 !== p2) {
            status.innerText = "PINs do not match.";
            [modalPin1, modalPin2].forEach(el => el.classList.add("shake", "pin-error"));
            setTimeout(() => {
                [modalPin1, modalPin2].forEach(el => el.classList.remove("shake"));
            }, 400);
            return;
        }

        try {
            const res = await fetch("/api/change_pin", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    old_pin: old_pin,
                    new_pin: p1,
                    email: email
                })
            });

            const data = await res.json();

            if (data.status === "ok") {
                // 1. Show Success Message in the Status Bar
                status.style.color = "#00f2ff";
                status.innerText = "PIN UPDATED SUCCESSFULLY";

                // 2. Clear the popup and show a success checkmark
                popup.innerHTML = `
                    <div class="pin-popup-box" style="text-align:center; padding:30px;">
                        <div style="font-size:40px; color:#00f2ff; margin-bottom:10px;">✔</div>
                        <div style="color:#00f2ff; font-weight:bold; letter-spacing:2px;">VAULT UPDATED</div>
                    </div>`;

                // 3. Auto-close and reload after a delay
                setTimeout(() => {
                    popup.classList.add("hidden");
                    location.reload(); 
                }, 2000);

            } else {
                status.style.color = "#ff0055";
                status.innerText = data.msg || "Update failed.";
            }
        } catch (err) {
            console.error("Save Error:", err);
            status.innerText = "Connection lost during save.";
        }
    };
});