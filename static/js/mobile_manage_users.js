console.log("Manage Users - Cyberpunk Mode Loaded");

/* ------------------------
   Navigation
   ------------------------ */
document.getElementById("goBack").onclick = () => {
    history.back();
};

/* ------------------------
   Buttons → Pages
   ------------------------ */
document.getElementById("viewUsers").onclick = () => {
    window.location.href = "/mobile/view-users";
};
document.getElementById("launcherApps").onclick = () => {
    window.location.href = "/mobile/apps";
};

document.getElementById("addUsers").onclick = () => {
    window.location.href = "/mobile/enroll";
};

document.getElementById("deleteUsers").onclick = () => {
    window.location.href = "/mobile/delete-user";
};

document.getElementById("registerEmail").onclick = () => {
    window.location.href = "/mobile/register-email";
};
