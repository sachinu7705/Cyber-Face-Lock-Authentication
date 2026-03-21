document.getElementById("saveNewPinBtn").onclick = async () => {
  const a = document.getElementById("newPin").value.trim();
  const b = document.getElementById("confirmPin").value.trim();
  const status = document.getElementById("newPinStatus");

  if (!a || !b) {
    status.innerText = "All fields required";
    return;
  }
  if (a !== b) {
    status.innerText = "PINs do not match";
    return;
  }

  status.innerText = "Saving...";

  const fd = new FormData();
  fd.append("new_pin", a);

  const res = await fetch("/api/reset_pin", {
    method: "POST",
    body: fd
  }).then(r => r.json());

  status.innerText = res.msg;

  if (res.status === "ok") {
    setTimeout(() => location.href = "/mobile/settings", 1000);
  }
};
