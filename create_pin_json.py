# create_pin_json.py
import json
import bcrypt
import time
import os

# Create default database
default_db = {
    "users": [],
    "settings": {
        "allow_new_registration": True,
        "require_email_verification": True,
        "max_users": 10
    }
}

# Save to file
with open("pin.json", "w") as f:
    json.dump(default_db, f, indent=4)

print("✅ Created new empty pin.json file")
print("File content:")
with open("pin.json", "r") as f:
    print(f.read())