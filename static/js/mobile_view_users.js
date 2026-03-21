console.log("View Users - Loaded");

document.getElementById("goBack").onclick = () => history.back();

fetch("/api/get_apps/default")  // reuse user data API
    .then(r => r.json())
    .then(() => loadUsers());

function loadUsers() {
    fetch("/api/get_all_users")  // NEW ENDPOINT (I will add for you)
        .then(r => r.json())
        .then(data => {
            const box = document.getElementById("userList");
            box.innerHTML = "";

            if (!data.users.length) {
                box.innerHTML = "<div class='message'>No users enrolled.</div>";
                return;
            }

            data.users.forEach(u => {
                let div = document.createElement("div");
                div.className = "cyber-item";
                div.innerHTML = `<span>${u}</span>`;
                box.appendChild(div);
            });
        });
}
