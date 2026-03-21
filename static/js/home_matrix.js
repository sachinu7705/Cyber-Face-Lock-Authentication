/* MATRIX BACKGROUND */
const canvas = document.getElementById("matrixCanvas");
const ctx = canvas.getContext("2d");

function resize(){
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resize();
window.onresize = resize;

const chars = "0123456789ABCDEF#*";
const size = 16;
const cols = Math.floor(window.innerWidth / size);
const drops = Array(cols).fill(1);

function matrix(){
  ctx.fillStyle = "rgba(0,0,0,0.05)";
  ctx.fillRect(0,0,canvas.width,canvas.height);

  ctx.fillStyle = "#ff2b2b";
  ctx.font = size + "px monospace";

  drops.forEach((y, i)=>{
    ctx.fillText(chars[Math.floor(Math.random()*chars.length)], i*size, y*size);
    if(y*size > canvas.height && Math.random() > 0.95) drops[i] = 0;
    drops[i]++;
  });

  requestAnimationFrame(matrix);
}
matrix();

/*  BOOT ANIMATION */
const bootLog = document.getElementById("bootLog");
const bootProgress = document.getElementById("bootProgress");
const bootScreen = document.getElementById("bootScreen");

const messages = [
  "[ OK ] Initializing Secure Kernel...",
  "[ OK ] Loading Face Recognition Core...",
  "[ OK ] Starting Encryption Modules...",
  "[ OK ] Matrix Renderer Activated...",
  "[ OK ] Camera Interface Ready...",
  "[ OK ] Boot Sequence Completed."
];

let idx = 0;
function nextLine(){
  if(idx < messages.length){
    bootLog.innerHTML += messages[idx] + "<br>";
    bootProgress.style.width = ((idx+1)/messages.length)*100 + "%";
    idx++;
    setTimeout(nextLine, 500);
  } else {
    setTimeout(()=> bootScreen.style.opacity = "0", 600);
    setTimeout(()=> bootScreen.style.display = "none", 1400);
  }
}
nextLine();
