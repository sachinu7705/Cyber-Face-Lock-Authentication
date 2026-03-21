console.log("delete_user.js loaded");

async function loadUsers() {
    const list = document.getElementById("deleteList");
    list.innerHTML = "<div class='loading'>Loading…</div>";

    const res = await fetch("/api/list_users");
    const data = await res.json();

    if (data.status !== "ok") {
        list.innerHTML = "<div class='loading'>Error loading users</div>";
        return;
    }

    list.innerHTML = "";

    data.users.forEach(user => {
        const row = document.createElement("div");
        row.className = "delete-item";

        row.innerHTML = `
            <div class="user-name">${user}</div>
            <button class="del-btn">DELETE</button>
        `;

        row.querySelector(".del-btn").onclick = () => deleteUser(user, row);
        list.appendChild(row);
    });
}

async function deleteUser(user, row) {
    if (!confirm(`Delete ${user}?`)) return;

    const fd = new FormData();
    fd.append("user", user);

    const res = await fetch("/api/delete_user", {
        method: "POST",
        body: fd
    });

    const data = await res.json();

    if (data.status === "ok") {
        row.remove();
    } else {
        alert(data.msg);
    }
}

loadUsers();
