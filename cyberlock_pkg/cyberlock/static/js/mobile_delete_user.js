

let currentUserToDelete = null;
let currentRowToDelete = null;

async function loadUsers() {
    const list = document.getElementById("deleteList");
    if (!list) return;

    list.innerHTML = "<div class='loading'>🔍 ACCESSING DATABASE...</div>";

    try {
        const res = await fetch("/api/list_users");
        const data = await res.json();

        

        if (data.status !== "ok") {
            list.innerHTML = "<div class='loading' style='color:#ff0055;'>❌ ACCESS ERROR</div>";
            return;
        }

        list.innerHTML = "";

        if (!data.users || data.users.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📭</div>
                    <div>NO IDENTITIES FOUND</div>
                    <div style="font-size: 11px; margin-top: 10px;">Use 'Enroll Face' to add users</div>
                </div>
            `;
            return;
        }

        // Calculate stats
        let faceEnrolled = 0;
        let totalUsers = data.users.length;
        
        // Create stats card
        const statsCard = document.getElementById("statsCard");
        if (statsCard) {
            statsCard.style.display = "block";
            statsCard.innerHTML = `
                <div class="stats-grid">
                    <div>
                        <div class="stat-value">${totalUsers}</div>
                        <div class="stat-label">Total Users</div>
                    </div>
                    <div>
                        <div class="stat-value" id="faceEnrolledStat">0</div>
                        <div class="stat-label">Face Enrolled</div>
                    </div>
                    <div>
                        <div class="stat-value" id="pendingStat">0</div>
                        <div class="stat-label">Pending</div>
                    </div>
                </div>
                <div class="warning-text">⚠️ DELETION IS PERMANENT AND CANNOT BE UNDONE</div>
            `;
        }

        // Display users
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
            
            if (faceEnrolledStatus) faceEnrolled++;
            
            // Get avatar letter
            const avatarLetter = displayName.charAt(0).toUpperCase();
            
            const row = document.createElement("div");
            row.className = "delete-item";
            row.dataset.username = username;
            
            row.innerHTML = `
                <div class="user-avatar">${avatarLetter}</div>
                <div class="user-info">
                    <div class="user-name">
                        ${displayName}
                        ${faceEnrolledStatus ? 
                            '<span class="user-badge badge-face">✓ Face Enrolled</span>' : 
                            '<span class="user-badge badge-no-face">⚠️ No Face</span>'}
                        ${role === 'admin' ? '<span class="user-badge badge-admin">👑 Admin</span>' : ''}
                    </div>
                    <div class="user-details">
                        <span>🔑 ${username}</span>
                        ${emails.length > 0 ? `<span>📧 ${emails[0]}</span>` : ''}
                        ${emails.length > 1 ? `<span>+${emails.length - 1} more</span>` : ''}
                    </div>
                </div>
                <button class="delete-btn" onclick="showDeleteModal('${username}', '${displayName}', this.closest('.delete-item'))">
                    DELETE
                </button>
            `;
            
            list.appendChild(row);
        });
        
        // Update stats
        const faceEnrolledStat = document.getElementById("faceEnrolledStat");
        const pendingStat = document.getElementById("pendingStat");
        if (faceEnrolledStat) faceEnrolledStat.textContent = faceEnrolled;
        if (pendingStat) pendingStat.textContent = totalUsers - faceEnrolled;
        
        

    } catch (err) {
        console.error("Load users error:", err);
        list.innerHTML = "<div class='loading' style='color:red;'>❌ SERVER OFFLINE</div>";
    }
}

// Show custom confirmation modal
window.showDeleteModal = function(username, displayName, row) {
    currentUserToDelete = username;
    currentRowToDelete = row;
    
    const modal = document.getElementById("confirmModal");
    const modalMessage = document.getElementById("modalMessage");
    
    if (modal && modalMessage) {
        modalMessage.innerHTML = `Are you sure you want to permanently delete <strong style="color: #ff0055;">${displayName}</strong>?<br><br>This action cannot be undone and will remove all biometric data.`;
        modal.style.display = "flex";
    }
};

// Perform delete operation
async function performDelete() {
    if (!currentUserToDelete) return;
    
    // Show toast notification
    const toast = document.createElement("div");
    toast.className = "toast-notification";
    toast.innerHTML = `<span style="color: #ffaa44;">⏳ Deleting ${currentUserToDelete}...</span>`;
    document.body.appendChild(toast);
    
    try {
        const res = await fetch("/api/delete_user", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ user: currentUserToDelete })
        });
        
        const data = await res.json();
        
        if (data.status === "ok") {
            toast.innerHTML = `<span style="color: #4caf50;">✅ User ${currentUserToDelete} deleted successfully!</span>`;
            
            // Animate removal
            if (currentRowToDelete) {
                currentRowToDelete.style.transition = "all 0.3s ease";
                currentRowToDelete.style.opacity = "0";
                currentRowToDelete.style.transform = "translateX(-20px)";
                setTimeout(() => {
                    currentRowToDelete.remove();
                    // Reload stats
                    loadUsers();
                }, 300);
            } else {
                setTimeout(() => loadUsers(), 1500);
            }
        } else {
            toast.innerHTML = `<span style="color: #ff4444;">❌ Delete failed: ${data.msg}</span>`;
        }
        
        setTimeout(() => toast.remove(), 3000);
        
    } catch (e) {
        console.error("Delete error:", e);
        toast.innerHTML = `<span style="color: #ff4444;">❌ Server communication error</span>`;
        setTimeout(() => toast.remove(), 3000);
    }
    
    // Close modal
    const modal = document.getElementById("confirmModal");
    if (modal) modal.style.display = "none";
    
    currentUserToDelete = null;
    currentRowToDelete = null;
}

// Close modal
function closeModal() {
    const modal = document.getElementById("confirmModal");
    if (modal) modal.style.display = "none";
    currentUserToDelete = null;
    currentRowToDelete = null;
}

// Set up modal event listeners
document.addEventListener("DOMContentLoaded", () => {
    loadUsers();
    
    // Modal buttons
    const confirmBtn = document.getElementById("modalConfirm");
    const cancelBtn = document.getElementById("modalCancel");
    const modal = document.getElementById("confirmModal");
    
    if (confirmBtn) {
        confirmBtn.onclick = () => performDelete();
    }
    
    if (cancelBtn) {
        cancelBtn.onclick = () => closeModal();
    }
    
    if (modal) {
        // Close when clicking overlay
        modal.querySelector(".modal-overlay")?.addEventListener("click", () => closeModal());
    }
});

// Export for global access
window.loadUsers = loadUsers;