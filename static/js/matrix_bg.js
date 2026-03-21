/* Matrix Background Animation */

const c = document.createElement("canvas");
c.id = "matrix-bg";
document.body.appendChild(c);

const ctx = c.getContext("2d");
c.width = window.innerWidth;
c.height = window.innerHeight;

const letters = "01";
const fontSize = 16;
const columns = Math.floor(c.width / fontSize);

const drops = Array(columns).fill(1);

function draw() {
  ctx.fillStyle = "rgba(0, 0, 0, 0.06)";
  ctx.fillRect(0, 0, c.width, c.height);

  ctx.fillStyle = "#ff0000";
  ctx.font = fontSize + "px monospace";

  drops.forEach((y, x) => {
    const text = letters[Math.floor(Math.random() * letters.length)];
    ctx.fillText(text, x * fontSize, y * fontSize);

    if (y * fontSize > c.height && Math.random() > 0.975) drops[x] = 0;
    drops[x]++;
  });

  requestAnimationFrame(draw);
}
draw();

window.onresize = () => {
  c.width = window.innerWidth;
  c.height = window.innerHeight;
};
