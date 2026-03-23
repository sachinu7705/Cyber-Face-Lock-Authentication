/* view_email.js — View and manage registered emails */

document.addEventListener("DOMContentLoaded", async () => {
    const listContainer = document.querySelector(".list-container");
    const popup = document.getElementById("confirmPopup");
    const confirmDelete = document.getElementById("confirmDelete");
    const cancelDelete = document.getElementById("cancelDelete");

    let emailToDelete = null;

    async function loadEmails() {
        const emailList = document.getElementById("emailList") || document.querySelector(".list-container");
        if (!emailList) return;

        emailList.innerHTML = "<div style='color:#00f2ff; text-align:center; padding:20px;'>🔍 ACCESSING VAULT...</div>";

        try {
            const res = await fetch("/api/get_saved_email");
            const data = await res.json();

            console.log("📧 Loaded emails:", data);

            if (data.status !== "ok") {
                emailList.innerHTML = `<div style='color:#ff0055; text-align:center;'>❌ ${data.msg || "FAILED TO LOAD IDENTITIES"}</div>`;
                return;
            }

            emailList.innerHTML = "";

            if (data.emails && data.emails.length > 0) {
                data.emails.forEach(email => {
                    const row = document.createElement("div");
                    row.className = "email-item";
                    row.style.cssText = `
                        background: rgba(0, 242, 255, 0.05);
                        border: 1px solid #1a1a1a;
                        margin-bottom: 10px;
                        padding: 15px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        border-left: 3px solid #00f2ff;
                        transition: all 0.3s ease;
                    `;

                    row.innerHTML = `
                        <div style="color:#eee; font-family:monospace; font-size:14px;">
                            📧 ${email}
                        </div>
                        <button onclick="prepareDelete('${email}')" 
                            style="background:#ff0055; border:none; color:white; padding:6px 14px; 
                            cursor:pointer; font-weight:bold; font-size:12px; border-radius:4px;
                            transition: all 0.2s ease;">
                            REMOVE
                        </button>
                    `;
                    
                    // Add hover effect
                    const btn = row.querySelector('button');
                    btn.onmouseover = () => {
                        btn.style.transform = 'scale(1.05)';
                        btn.style.background = '#ff3366';
                    };
                    btn.onmouseout = () => {
                        btn.style.transform = 'scale(1)';
                        btn.style.background = '#ff0055';
                    };
                    
                    emailList.appendChild(row);
                });
                
                // Add count display
                const countDiv = document.createElement("div");
                countDiv.style.cssText = `
                    margin-top: 20px;
                    padding: 10px;
                    text-align: center;
                    color: #00f2ff;
                    font-family: monospace;
                    font-size: 12px;
                    border-top: 1px solid rgba(0,242,255,0.2);
                `;
                countDiv.innerHTML = `📊 Total emails: ${data.emails.length}`;
                emailList.appendChild(countDiv);
                
            } else {
                emailList.innerHTML = `
                    <div style='color:#444; text-align:center; padding:40px;'>
                        <div style="font-size: 48px; margin-bottom: 10px;">📭</div>
                        <div>NO EMAILS REGISTERED</div>
                        <div style="font-size: 11px; margin-top: 10px;">Use 'Register Email' to add one</div>
                    </div>
                `;
            }

        } catch (err) {
            console.error("Fetch error:", err);
            emailList.innerHTML = "<div style='color:red; text-align:center; padding:20px;'>❌ VAULT CONNECTION ERROR</div>";
        }
    }

    // Make functions global
    window.loadEmails = loadEmails;
    window.prepareDelete = (email) => {
        emailToDelete = email;
        if (popup) {
            popup.classList.remove("popup-hidden");
            // Update popup text to show which email will be deleted
            const popupText = popup.querySelector(".popup-text");
            if (popupText) {
                popupText.innerHTML = `Are you sure you want to remove <strong>${email}</strong> from authorized list?`;
            }
        }
    };

    if (cancelDelete) {
        cancelDelete.onclick = () => {
            popup.classList.add("popup-hidden");
            emailToDelete = null;
        };
    }

    if (confirmDelete) {
        confirmDelete.onclick = async () => {
            if (emailToDelete) {
                await executeDelete(emailToDelete);
                popup.classList.add("popup-hidden");
                emailToDelete = null;
            }
        };
    }

    async function executeDelete(email) {
        try {
            const res = await fetch("/api/delete_saved_email", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ email: email })
            });
            
            const data = await res.json();
            
            if (data.status === "ok") {
                // Show success message
                const statusDiv = document.createElement("div");
                statusDiv.style.cssText = `
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    background: rgba(76, 175, 80, 0.9);
                    color: white;
                    padding: 10px 20px;
                    border-radius: 8px;
                    font-family: monospace;
                    z-index: 1000;
                    animation: fadeOut 2s forwards;
                `;
                statusDiv.innerHTML = "✅ Email removed successfully!";
                document.body.appendChild(statusDiv);
                
                setTimeout(() => statusDiv.remove(), 2000);
                
                // Refresh the list
                loadEmails();
            } else {
                alert("Delete failed: " + (data.msg || "Unknown error"));
            }
        } catch (e) {
            console.error("Delete request failed:", e);
            alert("Server error during deletion.");
        }
    }

    // Add CSS animation for fadeOut
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeOut {
            0% { opacity: 1; transform: translateY(0); }
            70% { opacity: 1; transform: translateY(0); }
            100% { opacity: 0; transform: translateY(-20px); visibility: hidden; }
        }
    `;
    document.head.appendChild(style);

    // Load emails when page loads
    loadEmails();
});