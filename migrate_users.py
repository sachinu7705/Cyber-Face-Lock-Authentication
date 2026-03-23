# migrate_users.py
import json
import time

# Load existing database
with open("pin.json", "r") as f:
    db = json.load(f)

# Create new structure
new_db = {
    "users": [],
    "settings": db.get("settings", {})
}

# Process existing users
if "users" in db:
    for i, user in enumerate(db["users"]):
        # Create a clean user entry
        new_user = {
            "user_id": i + 1,
            "username": user.get("username", user.get("email", "").split('@')[0]),
            "display_name": user.get("display_name", user.get("username", user.get("email"))),
            "emails": user.get("emails", [user.get("email")] if user.get("email") else []),
            "pin": user.get("pin"),
            "created_at": user.get("created_at", time.time()),
            "updated_at": time.time(),
            "face_enrolled": user.get("face_enrolled", False),
            "face_folder": user.get("username", user.get("email", "").split('@')[0]),
            "active": True,
            "role": user.get("role", "user")
        }
        new_db["users"].append(new_user)

# Save new structure
with open("pin.json", "w") as f:
    json.dump(new_db, f, indent=4)

print("✅ Database migrated! Users separated:")
for user in new_db["users"]:
    print(f"  - {user['username']}: {user['emails']}")