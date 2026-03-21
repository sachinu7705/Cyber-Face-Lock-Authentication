document.addEventListener("DOMContentLoaded", () => {

    const oldPinInput = document.getElementById("oldPin");
    const checkOldBtn = document.getElementById("checkOldPinBtn");
    const status = document.getElementById("status");

    const popup = document.getElementById("pinPopup");
    const modalPin1 = document.getElementById("modalPin1");
    const modalPin2 = document.getElementById("modalPin2");
    const modalSave = document.getElementById("modalSavePinBtn");

    // Only digits for old PIN
    oldPinInput.addEventListener("input", () => {
        oldPinInput.value = oldPinInput.value.replace(/\D/g, "");
    });

    // ---------------------------
    // CHECK OLD PIN
    // ---------------------------
    checkOldBtn.onclick = async () => {

        let fd = new FormData();
        fd.append("old_pin", oldPinInput.value.trim());

        let res = await fetch("/api/check_old_pin", {
            method: "POST",
            body: fd
        });

        let data = await res.json();
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
    };

    // ---------------------------
    // SAVE NEW PIN
    // ---------------------------
    modalSave.onclick = async () => {

        let p1 = modalPin1.value.trim();
        let p2 = modalPin2.value.trim();

        if (p1.length !== 4 || p2.length !== 4) {
            status.innerText = "PIN must be 4 digits.";
            return;
        }

        if (p1 !== p2) {
            status.innerText = "PINs do not match.";

            modalPin1.classList.add("shake", "pin-error");
            modalPin2.classList.add("shake", "pin-error");

            setTimeout(() => {
                modalPin1.classList.remove("shake");
                modalPin2.classList.remove("shake");
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
            popup.innerHTML = `
                <div class="pin-popup-box">
                    <div class="pin-popup-title">PIN Updated ✔</div>
                </div>`;
            setTimeout(() => location.reload(), 1800);
        }
    };

});
