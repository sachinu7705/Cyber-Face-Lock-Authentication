console.log("view_users.js loaded");

async function loadUsers() {
    const list = document.getElementById("userList");
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
        row.className = "user-item";

        row.innerHTML = `
            <div class="user-name">${user}</div>
        `;

        list.appendChild(row);
    });
}

loadUsers();
