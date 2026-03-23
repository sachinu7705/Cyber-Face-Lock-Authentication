console.log("view_users.js loaded - Enhanced User View");

async function loadUsers() {
    const list = document.getElementById("userList");
    if (!list) return;

    list.innerHTML = "<div style='color:#00f2ff; text-align:center; padding:20px;'>🔍 SCANNING BIOMETRIC VAULT...</div>";

    try {
        const res = await fetch("/api/list_users");
        const data = await res.json();

        console.log("📊 Users data:", data);

        if (data.status !== "ok") {
            list.innerHTML = "<div style='color:red; text-align:center; padding:20px;'>❌ ACCESS DENIED</div>";
            return;
        }

        list.innerHTML = "";

        if (!data.users || data.users.length === 0) {
            list.innerHTML = "<div style='color:#444; text-align:center; padding:40px;'>📭 NO REGISTERED USERS</div>";
            return;
        }

        // Loop through users and display them (stats bar removed)
        data.users.forEach(user => {
            // Handle both string and object formats
            let username, displayName, emails, faceEnrolledStatus, role;
            
            if (typeof user === 'string') {
                username = user;
                displayName = user;
                emails = [];
                faceEnrolledStatus = false;
                role = "user";
            } else {
                username = user.username;
                displayName = user.display_name || user.username;
                emails = user.emails || [];
                faceEnrolledStatus = user.face_enrolled || false;
                role = user.role || "user";
            }
            
            const row = document.createElement("div");
            row.className = "user-item";
            row.dataset.username = username;
            
            // Get avatar letter
            const avatarLetter = displayName.charAt(0).toUpperCase();
            
            row.innerHTML = `
                <div class="user-avatar">${avatarLetter}</div>
                <div class="user-info">
                    <div class="user-name">
                        ${displayName}
                        ${faceEnrolledStatus ? '<span class="user-badge">✓ Face Enrolled</span>' : '<span class="user-badge warning">⚠️ No Face</span>'}
                        ${role === 'admin' ? '<span class="user-badge admin">👑 Admin</span>' : ''}
                    </div>
                    <div class="user-details">
                        <span>🔑 ${username}</span>
                        ${emails.length > 0 ? `<span style="margin-left: 10px;">📧 ${emails[0]}</span>` : ''}
                        ${emails.length > 1 ? `<span style="margin-left: 5px;">+${emails.length - 1} more</span>` : ''}
                    </div>
                </div>
                <button class="delete-btn" onclick="deleteUser('${username}')">🗑️ DELETE</button>
            `;
            
            list.appendChild(row);
        });
        
        console.log(`✅ Loaded ${data.users.length} users`);
        
    } catch (err) {
        console.error("Load users error:", err);
        list.innerHTML = "<div style='color:red; text-align:center; padding:20px;'>❌ SERVER OFFLINE</div>";
    }
}

// Delete user function with custom modal
window.deleteUser = async function(username) {
    // Create custom confirmation modal instead of alert
    const modal = document.createElement("div");
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.85);
        backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        animation: fadeIn 0.3s ease;
    `;
    
    modal.innerHTML = `
        <div style="
            background: linear-gradient(135deg, #0a0a0a, #030305);
            border: 1px solid #ff0055;
            border-radius: 12px;
            padding: 30px;
            max-width: 400px;
            width: 90%;
            text-align: center;
            box-shadow: 0 0 30px rgba(255, 0, 85, 0.3);
            animation: slideUp 0.3s ease;
        ">
            <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
            <div style="color: #ff0055; font-size: 20px; font-weight: bold; margin-bottom: 15px; font-family: monospace;">
                PERMANENT DELETE
            </div>
            <div style="color: #fff; margin-bottom: 10px;">
                Are you sure you want to delete <strong style="color: #ff0055;">${username}</strong>?
            </div>
            <div style="color: #666; font-size: 12px; margin-bottom: 25px;">
                This action cannot be undone. All biometric data will be lost.
            </div>
            <div style="display: flex; gap: 15px; justify-content: center;">
                <button id="confirmDeleteBtn" style="
                    background: linear-gradient(135deg, #ff0055, #cc0044);
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: bold;
                    font-size: 14px;
                    transition: all 0.2s;
                ">DELETE</button>
                <button id="cancelDeleteBtn" style="
                    background: transparent;
                    color: #999;
                    border: 1px solid #333;
                    padding: 12px 24px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: bold;
                    font-size: 14px;
                    transition: all 0.2s;
                ">CANCEL</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add animation styles
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        @keyframes slideUp {
            from {
                transform: translateY(30px);
                opacity: 0;
            }
            to {
                transform: translateY(0);
                opacity: 1;
            }
        }
    `;
    document.head.appendChild(style);
    
    // Handle confirm
    const confirmBtn = document.getElementById("confirmDeleteBtn");
    const cancelBtn = document.getElementById("cancelDeleteBtn");
    
    confirmBtn.onclick = async () => {
        modal.remove();
        await performDelete(username);
    };
    
    cancelBtn.onclick = () => {
        modal.remove();
    };
    
    // Close on outside click
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    };
};

// Perform delete operation
async function performDelete(username) {
    const statusDiv = document.createElement("div");
    statusDiv.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.9);
        padding: 12px 24px;
        border-radius: 8px;
        font-family: monospace;
        font-size: 14px;
        z-index: 10000;
        border: 1px solid #ff0055;
        backdrop-filter: blur(5px);
        animation: fadeIn 0.3s ease;
    `;
    statusDiv.innerHTML = `<span style="color: #ffaa44;">⏳ Deleting ${username}...</span>`;
    document.body.appendChild(statusDiv);
    
    try {
        const res = await fetch("/api/delete_user", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ user: username })
        });
        
        const data = await res.json();
        
        if (data.status === "ok") {
            statusDiv.innerHTML = `<span style="color: #4caf50;">✅ User ${username} deleted successfully!</span>`;
            setTimeout(() => {
                statusDiv.remove();
                loadUsers(); // Reload the list
            }, 1500);
        } else {
            statusDiv.innerHTML = `<span style="color: #ff4444;">❌ Delete failed: ${data.msg}</span>`;
            setTimeout(() => statusDiv.remove(), 3000);
        }
    } catch (e) {
        console.error("Delete error:", e);
        statusDiv.innerHTML = `<span style="color: #ff4444;">❌ Server communication error</span>`;
        setTimeout(() => statusDiv.remove(), 3000);
    }
}

// Load delete users function (for delete-user page)
async function loadDeleteUsers() {
    const list = document.getElementById("deleteList");
    if (!list) return;

    list.innerHTML = "<div style='color:#00f2ff; text-align:center; padding:20px;'>🔍 LOADING USERS...</div>";

    try {
        const res = await fetch("/api/list_users");
        const data = await res.json();

        if (data.status !== "ok") {
            list.innerHTML = "<div style='color:red; text-align:center;'>❌ ACCESS DENIED</div>";
            return;
        }

        list.innerHTML = "";

        if (!data.users || data.users.length === 0) {
            list.innerHTML = "<div style='color:#444; text-align:center; padding:40px;'>📭 NO USERS FOUND</div>";
            return;
        }

        data.users.forEach(user => {
            const username = typeof user === 'string' ? user : user.username;
            const displayName = typeof user === 'string' ? user : (user.display_name || user.username);
            const faceEnrolled = typeof user === 'object' ? (user.face_enrolled || false) : false;
            const emails = typeof user === 'object' ? (user.emails || []) : [];
            const avatarLetter = displayName.charAt(0).toUpperCase();
            
            const row = document.createElement("div");
            row.className = "delete-item";
            row.style.cssText = `
                display: flex;
                justify-content: space-between;
                align-items: center;
                background: rgba(255, 0, 85, 0.05);
                border: 1px solid #331111;
                margin-bottom: 12px;
                padding: 15px;
                border-left: 3px solid #ff0055;
                transition: all 0.3s ease;
                border-radius: 8px;
            `;

            row.innerHTML = `
                <div style="display: flex; align-items: center; gap: 15px; flex: 1;">
                    <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #ff2b2b, #ff6b6b); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 18px;">
                        ${avatarLetter}
                    </div>
                    <div class="user-info">
                        <div class="user-name" style="color:#eee; font-family:monospace; font-size:16px;">
                            ${displayName}
                            ${faceEnrolled ? '<span style="color:#4caf50; font-size:10px; margin-left:8px;">✓ Face</span>' : '<span style="color:#ff9800; font-size:10px; margin-left:8px;">⚠️ No Face</span>'}
                        </div>
                        <div style="font-size:10px; color:#666;">Username: ${username}</div>
                        ${emails.length > 0 ? `<div style="font-size:9px; color:#888;">📧 ${emails[0]}</div>` : ''}
                    </div>
                </div>
                <button class="del-btn" onclick="deleteUser('${username}')" style="background:#ff0055; color:white; border:none; padding:8px 15px; cursor:pointer; font-weight:bold; border-radius:5px;">
                    DELETE
                </button>
            `;
            list.appendChild(row);
        });
        
        console.log(`✅ Loaded ${data.users.length} users for deletion`);

    } catch (err) {
        console.error("Load users error:", err);
        list.innerHTML = "<div style='color:red; text-align:center;'>❌ SERVER OFFLINE</div>";
    }
}

// Export functions for use in other pages
window.loadUsers = loadUsers;
window.loadDeleteUsers = loadDeleteUsers;
window.deleteUser = deleteUser;

// Load users based on page type
document.addEventListener("DOMContentLoaded", () => {
    const pageType = window.location.pathname;
    if (pageType.includes("view-users")) {
        loadUsers();
    } else if (pageType.includes("delete-user")) {
        loadDeleteUsers();
    }
});