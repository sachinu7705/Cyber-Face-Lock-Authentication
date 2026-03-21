document.addEventListener("DOMContentLoaded", async () => {
    const listContainer = document.querySelector(".list-container");
    const popup = document.getElementById("confirmPopup");
    const confirmDelete = document.getElementById("confirmDelete");
    const cancelDelete = document.getElementById("cancelDelete");

    let emailToDelete = null;

    async function loadEmails() {
        // Show scanning status
        listContainer.innerHTML = '<div class="status" style="color:#00f2ff">SCANNING VAULT...</div>';
        
        try {
            let res = await fetch("/api/get_saved_email");
            let data = await res.json();

            listContainer.innerHTML = '';

            if (data.status === "ok" && data.emails && data.emails.length > 0) {

                if (data.emails && data.emails.length > 0) {
                    data.emails.forEach((email, index) => {
                        const row = document.createElement("div");

                        row.className = "email-row";
                        row.style.cssText = `
                            display:flex;
                            justify-content:space-between;
                            align-items:center;
                            margin-bottom:15px;
                            padding:10px;
                            border-bottom:1px solid #333;
                        `;

                        row.innerHTML = `
                            <div class="email-left">
                                <div class="email-text" style="font-family:monospace;">
                                    <b style="color:#00f2ff;">[ID: ${index + 1}]</b><br>${email}
                                </div>
                            </div>
                            <div class="email-right">
                                <button class="danger-btn small-btn" onclick="prepareDelete('${email}')">
                                    DELETE
                                </button>
                            </div>
                        `;

                        listContainer.appendChild(row);
                    });
                } else {
                    listContainer.innerHTML = `
                        <div style="text-align:center; padding:30px; color:#ff8aa0;">
                            NO RECOVERY DATA FOUND
                        </div>
                    `;
                }

                // ✅ ALWAYS SHOW BUTTON
                const addMoreBtn = document.createElement("button");
                addMoreBtn.className = "cyber-btn";
                addMoreBtn.style.width = "100%";
                addMoreBtn.style.marginTop = "20px";
                addMoreBtn.innerText = "+ REGISTER NEW EMAIL";
                addMoreBtn.onclick = () => location.href = '/mobile/register-email';

                listContainer.appendChild(addMoreBtn);
            }
            else {
                // Empty State View
                listContainer.innerHTML = `
                    <div style="text-align:center; padding:50px; border:1px dashed #ff8aa0; color:#ff8aa0;">
                        <div style="font-size:18px; margin-bottom:15px; font-family:monospace;">NO RECOVERY DATA FOUND</div>
                        <button class="cyber-btn" onclick="location.href='/mobile/register-email'">
                            INITIALIZE REGISTRATION
                        </button>
                    </div>
                `;
            }
        } catch (err) {
            listContainer.innerHTML = '<div class="status" style="color:red;">CONNECTION ERROR</div>';
        }
    }

    // Make it global so the button onclick can see it
    window.prepareDelete = (email) => {
        emailToDelete = email;
        if (popup) popup.classList.remove("popup-hidden");
    };

    
    if (cancelDelete) {
        cancelDelete.onclick = () => popup.classList.add("popup-hidden");
    }

    if (confirmDelete) {
        confirmDelete.onclick = async () => {
            try {
                let res = await fetch("/api/delete_saved_email", {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({ email: emailToDelete })
                });
                
                popup.classList.add("popup-hidden");
                loadEmails(); // Refresh list
            } catch (e) {
                alert("Delete failed. Check connection.");
            }
        };
    }

    loadEmails();
});