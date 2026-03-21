let cam = document.getElementById("cam");
let canvas = document.getElementById("canvas");
let msg = document.getElementById("msg");

navigator.mediaDevices.getUserMedia({ video: true })
.then(stream => cam.srcObject = stream);

function takeSnapshot() {
    let ctx = canvas.getContext("2d");
    canvas.width = cam.videoWidth;
    canvas.height = cam.videoHeight;
    ctx.drawImage(cam, 0, 0);
    return canvas.toDataURL("image/jpeg");
}

function captureEnroll() {
    let name = document.getElementById("name").value;
    let pin = document.getElementById("pin").value;

    let img = takeSnapshot();

    // ✅ ADD IMAGE TO GRID
    let thumbs = document.getElementById("thumbs");

    let image = document.createElement("img");
    image.src = img;

    thumbs.appendChild(image);

    // send backend
    let data = new FormData();
    data.append("name", name);
    data.append("pin", pin);
    data.append("image", img);

    fetch("/api/enroll_camera", { method:"POST", body:data })
    .then(r => r.json())
    .then(res => msg.innerHTML = res.msg);
}


function captureUnlock() {
    let img = takeSnapshot();

    let data = new FormData();
    data.append("image", img);

    fetch("/api/unlock", { method:"POST", body:data })
    .then(r => r.json())
    .then(res => {
        if(res.status === "ok") msg.innerHTML = "Welcome " + res.name;
        else msg.innerHTML = res.msg;
    });
}
