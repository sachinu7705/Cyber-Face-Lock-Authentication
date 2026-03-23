# migrate_faces.py - Migrate existing face data to user folders
import os
import json
import shutil
import time

print("🔍 Starting face data migration...")

# Load user database
if not os.path.exists("pin.json"):
    print("❌ pin.json not found. Please create users first.")
    exit(1)

with open("pin.json", "r") as f:
    db = json.load(f)

users = db.get("users", [])
if not users:
    print("❌ No users found in database. Please create users first.")
    exit(1)

print(f"📊 Found {len(users)} users in database:")
for user in users:
    print(f"   - {user.get('username')}")

# Create folder for each user
for user in users:
    username = user.get("username")
    user_folder = os.path.join("known_faces", username)
    
    if not os.path.exists(user_folder):
        os.makedirs(user_folder, exist_ok=True)
        print(f"✅ Created folder for {username}")
    else:
        print(f"📁 Folder already exists for {username}")

# Check for existing face files in the known_faces directory
known_faces_dir = "known_faces"
if os.path.exists(known_faces_dir):
    all_files = os.listdir(known_faces_dir)
    
    # Find orphaned face files (not in user folders)
    orphaned_files = []
    for item in all_files:
        item_path = os.path.join(known_faces_dir, item)
        if os.path.isfile(item_path) and (item.endswith('.npy') or item.endswith('.jpg')):
            orphaned_files.append(item)
    
    if orphaned_files:
        print(f"\n⚠️ Found {len(orphaned_files)} orphaned face files:")
        for file in orphaned_files[:10]:  # Show first 10
            print(f"   - {file}")
        
        # Ask user what to do
        print("\nOptions:")
        print("1. Move all orphaned files to first user's folder")
        print("2. Delete orphaned files")
        print("3. Skip (do nothing)")
        
        choice = input("Enter choice (1/2/3): ").strip()
        
        if choice == "1" and users:
            target_user = users[0].get("username")
            target_folder = os.path.join(known_faces_dir, target_user)
            
            for file in orphaned_files:
                src = os.path.join(known_faces_dir, file)
                dst = os.path.join(target_folder, file)
                shutil.move(src, dst)
                print(f"   Moved {file} to {target_user}/")
            
            print(f"✅ Moved {len(orphaned_files)} files to {target_user}'s folder")
            
        elif choice == "2":
            for file in orphaned_files:
                src = os.path.join(known_faces_dir, file)
                os.remove(src)
                print(f"   Deleted {file}")
            print(f"✅ Deleted {len(orphaned_files)} orphaned files")
        else:
            print("⏭️ Skipped orphaned files")
    else:
        print("\n✅ No orphaned face files found")
else:
    print("\n📁 known_faces directory doesn't exist yet")

# Update user face_enrolled status based on existing face files
print("\n📊 Checking user face enrollment status...")
for user in users:
    username = user.get("username")
    user_folder = os.path.join(known_faces_dir, username)
    
    if os.path.exists(user_folder):
        face_files = [f for f in os.listdir(user_folder) if f.endswith('.npy')]
        if face_files:
            user["face_enrolled"] = True
            user["face_folder"] = username
            print(f"   ✅ {username}: {len(face_files)} face(s) found")
        else:
            user["face_enrolled"] = False
            print(f"   ❌ {username}: No face data found")
    else:
        user["face_enrolled"] = False
        print(f"   ❌ {username}: No face folder found")

# Save updated database
with open("pin.json", "w") as f:
    json.dump(db, f, indent=4)

print("\n✅ Database updated with face enrollment status")
print("\n🎉 Migration complete!")