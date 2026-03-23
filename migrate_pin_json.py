# migrate_pin_json.py
import json
import time

# Load existing data
print("📖 Loading existing pin.json...")
with open("pin.json", "r") as f:
    db = json.load(f)

print("🔍 Current database structure:")
print(json.dumps(db, indent=2))

# Create new structure
new_db = {
    "users": [],
    "settings": {
        "allow_new_registration": True,
        "require_email_verification": True,
        "max_users": 10
    }
}

# Migrate existing users
if "users" in db and db["users"]:
    for user in db["users"]:
        new_user = {
            "username": user.get("username"),
            "display_name": user.get("username"),
            "emails": [user.get("email")] if user.get("email") else [],
            "pin": user.get("pin"),
            "created_at": user.get("created_at", time.time()),
            "updated_at": time.time(),
            "face_enrolled": user.get("face_enrolled", False),
            "face_folder": user.get("username"),
            "active": True,
            "role": "user"
        }
        
        # Add any additional emails from the old emails list
        if "emails" in db and db["emails"]:
            for email in db["emails"]:
                if email not in new_user["emails"]:
                    new_user["emails"].append(email)
        
        new_db["users"].append(new_user)
        print(f"✅ Migrated user: {new_user['username']} with emails: {new_user['emails']}")

# If there's a root PIN but no users, create a default admin
if not new_db["users"] and "pin" in db:
    print("⚠️ No users found but root PIN exists. Creating default admin...")
    new_user = {
        "username": "admin",
        "display_name": "Administrator",
        "emails": ["admin@cyberlock.local"],
        "pin": db["pin"],
        "created_at": time.time(),
        "updated_at": time.time(),
        "face_enrolled": False,
        "face_folder": "admin",
        "active": True,
        "role": "admin"
    }
    new_db["users"].append(new_user)

# Create backup of old file
backup_file = f"pin_backup_{int(time.time())}.json"
with open(backup_file, "w") as f:
    json.dump(db, f, indent=4)
print(f"📦 Backup saved to: {backup_file}")

# Save new structure
with open("pin.json", "w") as f:
    json.dump(new_db, f, indent=4)

print("✅ Database migrated successfully!")
print("\n📊 New database structure:")
print(json.dumps(new_db, indent=2))