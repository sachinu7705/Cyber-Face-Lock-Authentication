console.log("mobile_menu.js loaded");

// Navigation buttons
document.getElementById("btnLockedApps").onclick = () =>
    location.href = "/mobile/locked-apps";

document.getElementById("btnSelectApps").onclick = () =>
    location.href = "/mobile/select-apps";

document.getElementById("btnChangePin").onclick = () =>
    location.href = "/mobile/change-pin";


document.getElementById("btnLogout").onclick = () => {
    window.location.href = "/logout";
};
document.getElementById("manageUsersBtn").onclick = () => {
    window.location.href = "/mobile/manage-users";
};

document.getElementById("viewUsersBtn").onclick = () => {
    window.location.href = "/mobile/view-users";
};

// Theme toggle
document.getElementById("themeToggle").onclick = () =>
    document.body.classList.toggle("dark");
// UNIVERSAL BACK BUTTON (Best Method)


// --------------------------------------------------------------------
// CYBER BACKGROUND ANIMATION (same as mobile_index)
// --------------------------------------------------------------------
const c = document.getElementById("bgCanvas");
const ctx = c.getContext("2d");

function resize(){
  c.width = innerWidth;
  c.height = innerHeight;
}
resize();
window.onresize = resize;

let t = 0;
function draw(){
  ctx.fillStyle = "rgba(0,0,0,0.08)";
  ctx.fillRect(0,0,c.width,c.height);

  ctx.fillStyle = "#ff2727";

  for(let i=0;i<50;i++){
    let x = Math.sin(i*0.25 + t) * 120 + c.width/2;
    let y = i * 22;
    ctx.fillRect(x, y, 4, 10);
  }

  t += 0.05;
  requestAnimationFrame(draw);
}
draw();
