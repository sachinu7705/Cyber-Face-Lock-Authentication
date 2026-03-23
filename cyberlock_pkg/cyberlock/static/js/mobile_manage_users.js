console.log("Manage Users - Cyberpunk Mode Loaded");

/* ------------------------
   Navigation
   ------------------------ */
const goBackBtn = document.getElementById("goBack");
if (goBackBtn) {
    goBackBtn.onclick = () => {
        history.back();
    };
}

/* ------------------------
   Buttons → Pages
   ------------------------ */
// Apps Launcher
const launcherApps = document.getElementById("launcherApps");
if (launcherApps) {
    launcherApps.onclick = () => {
        window.location.href = "/mobile/apps";
    };
}


// Delete Users
const deleteUsers = document.getElementById("deleteUsers");
if (deleteUsers) {
    deleteUsers.onclick = () => {
        window.location.href = "/mobile/delete-user";
    };
}

// Register Email
const registerEmail = document.getElementById("registerEmail");
if (registerEmail) {
    registerEmail.onclick = () => {
        window.location.href = "/mobile/register-email";
    };
}

console.log("✅ All buttons initialized");