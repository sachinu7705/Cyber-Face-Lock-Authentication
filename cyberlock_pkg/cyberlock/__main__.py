import os

# Detect if running on Render
IS_RENDER = os.environ.get("RENDER") == "true"

if IS_RENDER:
    # On Render, we can't use camera or dlib
    print("⚠️ Running on Render - Face recognition features disabled")
    detector = None
    sp = None
    facerec = None
else:
    # Local development with face recognition
    import cv2
    import dlib
    import face_recognition

import glob
from pathlib import Path
from shutil import copyfile
import configparser
from flask import Flask, render_template, request, jsonify

import numpy as np
import os
import base64
import json
from io import BytesIO
from PIL import Image
from flask_mail import Mail, Message
import random
import time
import platform
from lock_manager import lock_app, unlock_app
import subprocess
import shlex
import bcrypt
import re

from cryptography.fernet import Fernet


# FORCE LOCAL MODE (no Docker / no cloud)
IS_CLOUD = os.environ.get("RENDER") == "true"

# Import face libraries (needed for your app)
import cv2
import dlib
import face_recognition
from flask import redirect, url_for, session

import os


app = Flask(__name__)
FACE_DB = "face_db.json"
FACE_DATA_DIR = "known_faces"
app.secret_key = os.environ.get("SECRET_KEY", "dev_key")
# 1. Load env
from dotenv import load_dotenv
load_dotenv()

# 2. Configure mail
app.config.update(
    MAIL_SERVER='smtp.gmail.com',
    MAIL_PORT=587,
    MAIL_USE_TLS=True,
    MAIL_USERNAME=os.environ.get("MAIL_USERNAME"),
    MAIL_PASSWORD=os.environ.get("MAIL_PASSWORD"),
    MAIL_DEFAULT_SENDER=os.environ.get("MAIL_USERNAME")
)

# 3. Initialize Mail
mail = Mail(app)

# ============================================================
# ENCRYPTION SETUP - ADDED FOR RENDER
# ============================================================
KEY_FILE = "face_key.key"
_cipher = None

def get_encryption_key():
    if os.path.exists(KEY_FILE):
        with open(KEY_FILE, 'rb') as f:
            return f.read()
    else:
        key = Fernet.generate_key()
        with open(KEY_FILE, 'wb') as f:
            f.write(key)
        return key

_cipher = Fernet(get_encryption_key())

def encrypt_face_encoding(enc):
    """Encrypt face encoding numpy array"""
    bytes_data = enc.tobytes()
    return _cipher.encrypt(bytes_data)

def decrypt_face_encoding(encrypted_bytes):
    """Decrypt face encoding back to numpy array"""
    decrypted = _cipher.decrypt(encrypted_bytes)
    return np.frombuffer(decrypted, dtype=np.float64)
# ============================================================

reset_tokens = {}
reset_codes = {}  
ENROLLED_FACE_PATH = "data/enrolled_user.jpg"
APPS_FILE = "locked_apps.json"


import os
import urllib.request
import bz2

MODEL_PATH = "models/shape_predictor_68_face_landmarks.dat"
MODEL_URL = "http://dlib.net/files/shape_predictor_68_face_landmarks.dat.bz2"

def download_model():
    if os.path.exists(MODEL_PATH):
        return

    print("[INFO] Model not found. Downloading...")

    os.makedirs("models", exist_ok=True)
    compressed_path = MODEL_PATH + ".bz2"

    try:
        urllib.request.urlretrieve(MODEL_URL, compressed_path)

        print("[INFO] Extracting model...")
        with bz2.open(compressed_path, 'rb') as f_in:
            with open(MODEL_PATH, 'wb') as f_out:
                f_out.write(f_in.read())

        os.remove(compressed_path)
        print("[INFO] Model ready!")

    except Exception as e:
        print("[ERROR] Failed to download model:", e)
        print("👉 Please download manually (see README)")
        exit()

# Call BEFORE using dlib
if not IS_CLOUD:
    download_model()


# ------------------------------
# Load DLIB models
# ------------------------------
if not IS_CLOUD:
    detector = dlib.get_frontal_face_detector()
    sp = dlib.shape_predictor("models/shape_predictor_68_face_landmarks.dat")
    facerec = dlib.face_recognition_model_v1("models/dlib_face_recognition_resnet_model_v1.dat")
else:
    detector = None
    sp = None
    facerec = None

# Locked apps database (JSON)
# ------------------------------
APPS_DB = "locked_apps.json"

if not os.path.exists(APPS_DB):
    with open(APPS_DB, "w") as f:
        json.dump({}, f)

def load_apps():
    with open(APPS_DB, "r") as f:
        return json.load(f)

def save_apps(data):
    with open(APPS_DB, "w") as f:
        json.dump(data, f, indent=2)

def load_faces():
    if not os.path.exists(FACE_DB):
        return {}
    return json.load(open(FACE_DB))

def save_faces(data):
    json.dump(data, open(FACE_DB, "w"), indent=2)

# ------------------------------
# Utility: Save Faces (UPDATED WITH ENCRYPTION)
# ------------------------------
def save_encoding_and_images(name, frames, encodings):
    user_dir = os.path.join("known_faces", name)
    os.makedirs(user_dir, exist_ok=True)

    for i, (frame, enc) in enumerate(zip(frames, encodings)):
        enc_filename = f"face_{i}.enc"
        with open(os.path.join(user_dir, enc_filename), 'wb') as f:
            f.write(encrypt_face_encoding(enc))
        
        img_filename = f"face_{i}.jpg"
        img_path = os.path.join(user_dir, img_filename)
        Image.fromarray(frame).save(img_path)
    
    print(f"✅ Successfully secured {len(encodings)} biometric points for {name}")

def load_face_encoding(filepath):
    with open(filepath, 'rb') as f:
        encrypted = f.read()
    return decrypt_face_encoding(encrypted)

def verify_face_logic(image_data):
    try:
        authorized_image = face_recognition.load_image_file("data/enrolled_user.jpg")
        authorized_encoding = face_recognition.face_encodings(authorized_image)[0]

        header, encoded = image_data.split(",", 1)
        nparr = np.frombuffer(base64.b64decode(encoded), np.uint8)
        live_frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        rgb_frame = cv2.cvtColor(live_frame, cv2.COLOR_BGR2RGB)
        live_encodings = face_recognition.face_encodings(rgb_frame)

        if len(live_encodings) > 0:
            results = face_recognition.compare_faces([authorized_encoding], live_encodings[0], tolerance=0.6)
            return results[0]
        return False
    except Exception as e:
        print(f"Error: {e}")
        return False


def download_face_model():
    path = "models/dlib_face_recognition_resnet_model_v1.dat"

    if os.path.exists(path):
        return

    print("[INFO] Downloading face recognition model...")

    url = "http://dlib.net/files/dlib_face_recognition_resnet_model_v1.dat.bz2"
    compressed = path + ".bz2"

    urllib.request.urlretrieve(url, compressed)

    with bz2.open(compressed, 'rb') as f_in:
        with open(path, 'wb') as f_out:
            f_out.write(f_in.read())

    os.remove(compressed)
    print("[INFO] Face model ready!")

def get_linux_apps():
    apps = []
    paths = [
        "/usr/share/applications",
        os.path.expanduser("~/.local/share/applications")
    ]

    for path in paths:
        if not os.path.isdir(path):
            continue

        for file in os.listdir(path):
            if not file.endswith(".desktop"):
                continue

            full_path = os.path.join(path, file)

            config = configparser.ConfigParser()
            try:
                config.read(full_path)

                name = config.get("Desktop Entry", "Name", fallback=None)
                desktop_id = file
                exec_cmd = config.get("Desktop Entry", "Exec", fallback=None)
                icon = config.get("Desktop Entry", "Icon", fallback="🖥️")
                category = config.get("Desktop Entry", "Categories", fallback="Other")
                category = category.split(";")[0]

                apps.append({
                     "id": desktop_id.replace(".desktop",""),
                    "exec": exec_cmd,
                    "name": name,
                    "icon": "🖥️",
                    "category": category
                })
            except Exception:
                pass

    return apps

def hash_pin(pin):
    return bcrypt.hashpw(pin.encode(), bcrypt.gensalt()).decode()

def verify_pin(input_pin, stored_hash):
    if not input_pin or not stored_hash:
        return False

    input_pin = str(input_pin).strip()
    stored_hash = str(stored_hash).strip()

    try:
        if stored_hash.startswith("$2b$"):
            return bcrypt.checkpw(
                input_pin.encode('utf-8'), 
                stored_hash.encode('utf-8')
            )
        return input_pin == stored_hash
    except Exception as e:
        print(f"❌ Bcrypt Error: {e}")
        return False


LOCKED_APPS_FILE = "config/locked_apps.json"
os.makedirs("config", exist_ok=True)

def read_locked_apps():
    if not os.path.exists(LOCKED_APPS_FILE):
        return {"locked": [], "settings": {}}
    with open(LOCKED_APPS_FILE, "r") as f:
        return json.load(f)

def save_locked_apps(data):
    with open(LOCKED_APPS_FILE, "w") as f:
        json.dump(data, f, indent=2)

def save_user(email, pin):
    import os, json

    email = email.strip().lower()
    pin = str(pin).strip()

    if os.path.exists("pin.json"):
        with open("pin.json", "r") as f:
            db = json.load(f)
    else:
        db = {"users": []}

    users = db.get("users", [])

    existing = next((u for u in users if u["email"] == email), None)

    if existing:
        existing["pin"] = pin
    else:
        users.append({
            "email": email,
            "pin": pin
        })

    db["users"] = users

    with open("pin.json", "w") as f:
        json.dump(db, f, indent=4)

    print("✅ PIN SAVED:", email)

LINUX_APP_DIRS = [
    "/usr/share/applications",
    "/usr/local/share/applications",
    str(Path.home() / ".local/share/applications")
]

ICON_DIRS = [
    "/usr/share/icons/hicolor",
    "/usr/share/pixmaps",
    "/usr/share/icons",
]

PIN_FILE = "pin.json"

def pin_exists():
    return os.path.exists(PIN_FILE)

def save_pin(email, new_pin):
    if os.path.exists("pin.json"):
        db = json.load(open("pin.json"))
    else:
        db = {"users": []}

    for user in db["users"]:
        if user["email"] == email:
            user["pin"] = hash_pin(new_pin)
            break

    with open("pin.json", "w") as f:
        json.dump(db, f, indent=2)

def load_pin(email=None):
    if not os.path.exists(PIN_FILE):
        return None

    data = json.load(open(PIN_FILE))

    if "users" in data:
        if email:
            for user in data["users"]:
                if user.get("email") == email:
                    return user.get("pin")
        else:
            return data["users"][0].get("pin") if data["users"] else None



def extract_desktop_icon(icon_name):
    if not icon_name:
        return "/static/app_icons/generic.png"

    target_dir = "static/app_icons"
    os.makedirs(target_dir, exist_ok=True)

    for ext in ["png", "svg", "xpm"]:
        cached = f"{target_dir}/{icon_name}.{ext}"
        if os.path.exists(cached):
            return f"/static/app_icons/{icon_name}.{ext}"

    for base in ICON_DIRS:
        for ext in ["png", "svg", "xpm"]:
            pattern = f"{base}/**/{icon_name}.{ext}"
            matches = glob.glob(pattern, recursive=True)
            if matches:
                src = matches[0]
                dst = f"{target_dir}/{icon_name}.{ext}"
                copyfile(src, dst)
                return f"/static/app_icons/{icon_name}.{ext}"

    return "/static/app_icons/generic.png"

def load_accounts():
    try:
        with open("accounts.json", "r") as f:
            return json.load(f)
    except FileNotFoundError:
        return {"users": []}

def save_accounts(accounts):
    with open("accounts.json", "w") as f:
        json.dump(accounts, f, indent=2)

def find_user(accounts, email):
    return next((u for u in accounts.get("users", []) if u.get("email") == email), None)

def email_exists(email):
    try:
        with open("accounts.json", "r") as f:
            accounts = json.load(f)
        
        for user in accounts.get("users", []):
            if user.get("email", "").lower() == email.lower():
                return True
        
        email_file = "config/email.txt"
        if os.path.exists(email_file):
            with open(email_file, "r") as f:
                saved_email = f.read().strip().lower()
                if saved_email == email.lower():
                    return True
        
        return False
        
    except FileNotFoundError:
        with open("accounts.json", "w") as f:
            json.dump({"users": []}, f)
        return False
    except Exception as e:
        print(f"Error checking email: {e}")
        return False


def load_lock_db():
    if not os.path.exists(LOCK_DB):
        return {"locked": [], "settings": {}}
    return json.load(open(LOCK_DB))     

def save_lock_db(data):
    json.dump(data, open(LOCK_DB, "w"), indent=2)


# ------------------------------
#   ROUTES
# ------------------------------

@app.route("/mobile")
def mobile_home():
    return render_template("mobile_index.html")

@app.route("/mobile/enroll")
def mobile_enroll():
    return render_template("mobile_enroll.html")

@app.route("/mobile/unlock")
def mobile_unlock():
    return render_template("mobile_unlock.html")

@app.route("/mobile/locked-apps")
def mobile_locked_apps():
    return render_template("mobile_locked_apps.html")

@app.route("/mobile/open-app/<appname>")
def mobile_open_app(appname):
    return render_template("mobile_open_app.html", appname=appname)

@app.route("/api/pin_exists")
def api_pin_exists():
    try:
        if not os.path.exists("pin.json"):
            return jsonify({"exists": False})
        
        try:
            with open("pin.json", "r") as f:
                content = f.read().strip()
                if not content:
                    return jsonify({"exists": False})
                
                data = json.loads(content)
                has_users = len(data.get("users", [])) > 0
                
                return jsonify({
                    "exists": has_users,
                    "has_users": has_users
                })
        except json.JSONDecodeError:
            return jsonify({"exists": False})
            
    except Exception as e:
        print(f"Error checking PIN exists: {e}")
        return jsonify({"exists": False})

@app.route('/reset')
def reset():
    return render_template('reset.html')

@app.route("/mobile/change-pin")
def mobile_change_pin():
    return render_template("change_pin.html")

@app.route("/mobile/reset-pin")
def mobile_reset_pin():
    return render_template("reset_pin.html")

@app.route("/mobile/reset-pin/new")
def mobile_reset_pin_new():
    return render_template("mobile_reset_pin_new.html")

@app.route("/mobile/menu")
def mobile_menu():
    return render_template("mobile_menu.html")

@app.route("/mobile/manage-users")
def mobile_manage_users():
    return render_template("mobile_manage_users.html")

@app.route("/mobile/add-user")
def mobile_add_user():
    return render_template("mobile_add_user.html")

@app.route("/mobile/delete-user")
def mobile_delete_user():
    return render_template("mobile_delete_user.html")

@app.route("/mobile/view-users")
def mobile_view_users():
    return render_template("mobile_view_users.html")

@app.route("/mobile/register-email")
def mobile_register_email():
    return render_template("mobile_register_email.html")

@app.route("/mobile/view-email")
def mobile_view_email():
    return render_template("mobile_view_email.html")

@app.route("/mobile/select-apps")
def mobile_select_apps():
    return render_template("mobile_select_apps.html")

from flask import session, redirect

@app.route("/mobile/apps")
def mobile_apps():
    return render_template("mobile_apps.html")

@app.route("/logout")
def logout():
    try:
        session.clear()
    except:
        pass
    return redirect("/mobile")

@app.route("/create_pin")
def create_pin_page():
    try:
        users_exist = False
        
        if os.path.exists("pin.json"):
            try:
                with open("pin.json", "r") as f:
                    content = f.read().strip()
                    if content:
                        db = json.loads(content)
                        users_exist = len(db.get("users", [])) > 0
            except:
                pass
        
        return render_template("create_pin.html", users_exist=users_exist)
        
    except Exception as e:
        print(f"Error in create_pin_page: {e}")
        return render_template("create_pin.html", users_exist=False)

@app.route("/api/create_pin", methods=["POST"])
def api_create_pin():
    data = request.get_json() or {}

    email = (data.get("email") or "").strip().lower()
    new_pin = data.get("pin")

    if not email or not new_pin:
        return jsonify({"msg": "Missing data"}), 400

    if os.path.exists("pin.json"):
        with open("pin.json", "r") as f:
            db = json.load(f)
    else:
        db = {"users": []}

    for user in db.get("users", []):
        if user.get("email") == email:
            return jsonify({
                "msg": "Email already exists"
            }), 400

    db["users"].append({
        "email": email,
        "pin": hash_pin(new_pin)
    })

    with open("pin.json", "w") as f:
        json.dump(db, f, indent=2)

    return jsonify({"msg": "PIN created successfully"})

@app.route("/api/launch_app", methods=["POST"])
def launch_app():
    if IS_CLOUD:
        return jsonify({"status": "disabled on cloud"})
    data = request.get_json() or {}
    appid = data.get("app")

    if not appid:
        return jsonify({"status": "error", "msg": "Missing app id"}), 400

    desktop_dirs = [
        "/usr/share/applications",
        "/usr/local/share/applications",
        os.path.expanduser("~/.local/share/applications")
    ]

    desktop_file = None

    for d in desktop_dirs:
        if not os.path.exists(d):
            continue
        for f in os.listdir(d):
            if not f.endswith(".desktop"):
                continue

            path = os.path.join(d, f)
            try:
                with open(path, "r", errors="ignore") as file:
                    for line in file:
                        if line.startswith("Name="):
                            name = line.split("=", 1)[1].strip()
                            if name.lower() == appid.lower():
                                desktop_file = path
                                break
                    if desktop_file:
                        break
            except:
                continue
        if desktop_file:
            break

    if not desktop_file:
        return jsonify({"status": "error", "msg": "Desktop file not found"}), 404

    exec_cmd = None
    try:
        with open(desktop_file, "r", errors="ignore") as f:
            for line in f:
                if line.startswith("Exec="):
                    exec_cmd = line.split("=", 1)[1].strip()
                    exec_cmd = exec_cmd.replace("%U", "").replace("%u", "").replace("%F", "").replace("%f", "")
                    break
    except:
        return jsonify({"status": "error", "msg": "Failed reading Exec"}), 500

    if not exec_cmd:
        return jsonify({"status": "error", "msg": "Missing Exec"}), 500

    try:
        subprocess.Popen(
            shlex.split(exec_cmd),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            stdin=subprocess.DEVNULL,
            preexec_fn=os.setsid
        )
        return jsonify({"status": "ok", "msg": f"Launched {appid}"})
    except Exception as e:
        return jsonify({"status": "error", "msg": str(e)}), 500


@app.route("/api/system_lock_app", methods=["POST"])
def system_lock_app():
    if IS_CLOUD:
        return jsonify({"status": "disabled on cloud"})
    import os

    data = request.get_json()
    appid = data.get("app_id")
    name = data.get("app_name", appid)
    icon = data.get("icon", "")

    if not appid:
        return {"status": "error", "msg": "No app_id provided"}

    target_dir = os.path.expanduser("~/.local/share/applications")
    os.makedirs(target_dir, exist_ok=True)

    target_file = os.path.join(target_dir, f"{appid}.lock.desktop")

    content = f"""
[Desktop Entry]
Type=Application
Name={name} (Locked)
Exec=/usr/local/bin/cyber-lock-launch {appid}
Icon={icon}
Terminal=false
"""

    try:
        with open(target_file, "w") as f:
            f.write(content)

        os.system(f"update-desktop-database {target_dir}")

        return {"status": "ok", "msg": f"{appid} locked system-wide"}

    except Exception as e:
        return {"status": "error", "msg": str(e)}

@app.route("/api/system_unlock_app", methods=["POST"])
def system_unlock_app():
    import os
    if IS_CLOUD:
        return jsonify({"status": "disabled on cloud"})
    data = request.get_json()
    appid = data.get("app_id")

    target_file = os.path.expanduser(f"~/.local/share/applications/{appid}.lock.desktop")

    if os.path.exists(target_file):
        os.remove(target_file)
        os.system("update-desktop-database ~/.local/share/applications")
        return {"status": "ok", "msg": f"{appid} unlocked system-wide"}

    return {"status": "ok", "msg": "No system lock file found"}

import bleach

def sanitize_input(text):
    return bleach.clean(text, strip=True)[:100]

@app.route("/api/enroll_from_camera", methods=["POST"])
def api_enroll_from_camera():
    try:
        if request.is_json:
            data = request.get_json(force=True)
            username = data.get("name", "").strip()
            pin = str(data.get("pin", "")).strip()
            images = data.get("images", [])
        else:
            username = request.form.get("name", "").strip()
            pin = str(request.form.get("pin", "")).strip()
            images = request.form.getlist("images[]")

        print(f"📥 ENROLL REQUEST: username={username}, images={len(images)}")

        if not pin.isdigit() or len(pin) != 4:
            return jsonify({
                "status": "error",
                "msg": "PIN must be exactly 4 digits"
            }), 400

        if detector is None or sp is None or facerec is None:
            return jsonify({
                "status": "error",
                "msg": "Face engine not initialized"
            }), 500

        if not username:
            return jsonify({"status": "error", "msg": "Username required"}), 400

        if not images:
            return jsonify({"status": "error", "msg": "No images received"}), 400

        import re
        clean_username = re.sub(r'[^a-zA-Z0-9_]', '_', username)
        
        user_exists = False
        user_data = None
        
        if os.path.exists("pin.json"):
            with open("pin.json", "r") as f:
                db = json.load(f)
            
            for user in db.get("users", []):
                if user.get("username") == clean_username:
                    user_exists = True
                    user_data = user
                    break
        
        if not user_exists:
            return jsonify({
                "status": "error",
                "msg": f"User '{clean_username}' not found. Please create account first."
            }), 404
        
        import bcrypt
        if not bcrypt.checkpw(pin.encode(), user_data["pin"].encode()):
            return jsonify({
                "status": "error",
                "msg": "Invalid PIN"
            }), 401
        
        user_dir = os.path.join("known_faces", clean_username)
        os.makedirs(user_dir, exist_ok=True)

        new_encodings = []
        frames = []

        for i, data_url in enumerate(images):
            try:
                encoded = data_url.split(",", 1)[1] if "," in data_url else data_url
                img_bytes = base64.b64decode(encoded)

                img = Image.open(BytesIO(img_bytes)).convert("RGB")
                frame = np.array(img)

                dets = detector(frame, 1)

                if len(dets) == 0:
                    print(f"⚠️ No face detected in image {i}")
                    continue

                shape = sp(frame, dets[0])
                enc = np.array(facerec.compute_face_descriptor(frame, shape))

                new_encodings.append(enc)
                frames.append(frame)

            except Exception as img_error:
                print(f"❌ Image {i} error:", img_error)
                continue

        if not new_encodings:
            return jsonify({
                "status": "error",
                "msg": "No valid face detected"
            }), 400

        if os.path.exists("known_faces"):
            for existing_user in os.listdir("known_faces"):
                if existing_user == clean_username:
                    continue
                    
                user_path = os.path.join("known_faces", existing_user)
                if not os.path.isdir(user_path):
                    continue
                
                for f_name in os.listdir(user_path):
                    if f_name.endswith(".enc"):
                        try:
                            with open(os.path.join(user_path, f_name), 'rb') as f:
                                encrypted = f.read()
                            known_enc = decrypt_face_encoding(encrypted)
                            dist = np.linalg.norm(known_enc - new_encodings[0])
                            
                            if dist < 0.5:
                                return jsonify({
                                    "status": "error",
                                    "msg": f"⚠️ This face is already registered as '{existing_user}'. Duplicate enrollment not allowed."
                                }), 400
                        except Exception as e:
                            print(f"⚠️ Encoding read error: {e}")

        for i, (frame, enc) in enumerate(zip(frames, new_encodings)):
            existing_files = [f for f in os.listdir(user_dir) if f.startswith("face_") and f.endswith(".enc")]
            next_idx = len(existing_files)
            
            enc_filename = f"face_{next_idx}.enc"
            with open(os.path.join(user_dir, enc_filename), 'wb') as f:
                f.write(encrypt_face_encoding(enc))
            
            img_filename = f"face_{next_idx}.jpg"
            img_path = os.path.join(user_dir, img_filename)
            Image.fromarray(frame).save(img_path)
        
        with open("pin.json", "r") as f:
            db = json.load(f)
        
        for user in db.get("users", []):
            if user.get("username") == clean_username:
                user["face_enrolled"] = True
                user["face_folder"] = clean_username
                user["updated_at"] = time.time()
                break
        
        with open("pin.json", "w") as f:
            json.dump(db, f, indent=4)

        print(f"✅ Face enrolled for user: {clean_username} with {len(new_encodings)} face(s)")
        
        return jsonify({
            "status": "ok",
            "msg": f"Face enrolled successfully for {clean_username}"
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        print("❌ ENROLL ERROR:", str(e))
        return jsonify({
            "status": "error",
            "msg": str(e)
        }), 500
    

@app.route("/mobile/dashboard")
def mobile_dashboard():
    if not session.get("unlocked"):
        return "Access denied", 403
    return render_template("mobile_dashboard.html")

@app.route("/api/list_apps")
def api_list_apps():
    apps = get_linux_apps()
    return jsonify({"status": "ok", "apps": apps})

@app.route("/api/send_otp", methods=["POST"])
def send_otp():
    return {"success": True}

@app.route("/api/verify_otp", methods=["POST"])
def verify_otp():
    return {"success": True}


reset_codes = {}

@app.route("/api/verify_reset_code", methods=["POST"])
def verify_reset_code():
    try:
        data = request.get_json()
        email = data.get("email", "").strip().lower()
        code = data.get("code", "").strip()
        
        print(f"🔐 Verifying reset code for {email}: {code}")
        
        if not email or not code:
            return jsonify({"status": "error", "message": "Missing data"}), 400
        
        if email in reset_tokens:
            token = reset_tokens[email]
            if time.time() > token["expires"]:
                del reset_tokens[email]
                return jsonify({"status": "error", "message": "Code expired"}), 400
            
            if code == token["code"]:
                return jsonify({
                    "status": "success", 
                    "message": "Code verified",
                    "username": token.get("username")
                })
        
        if os.path.exists("pin.json"):
            with open("pin.json", "r") as f:
                db = json.load(f)
            
            if db.get("reset_code") == code and db.get("reset_email") == email:
                return jsonify({
                    "status": "success", 
                    "message": "Code verified"
                })
        
        return jsonify({"status": "error", "message": "Invalid code"}), 400
        
    except Exception as e:
        print(f"❌ Verify code error: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/api/set_new_pin", methods=["POST"])
def api_set_new_pin():
    data = request.get_json()
    email_input = data.get("email", "").strip().lower()
    new_pin = str(data.get("new_pin", "")).strip()

    if len(new_pin) != 4:
        return jsonify({"status": "error", "message": "PIN must be 4 digits"}), 400

    try:
        with open("pin.json", "r") as f:
            db = json.load(f)

        if email_input in [e.strip().lower() for e in db.get("emails", [])]:
            db["pin"] = hash_pin(new_pin) 
            
            with open("pin.json", "w") as f:
                json.dump(db, f, indent=2)
                
            return jsonify({"status": "ok", "message": "PIN encrypted and saved!"})
        
        return jsonify({"status": "error", "message": "Email not found"}), 404

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    

@app.route("/api/get_pin", methods=["GET"])
def get_pin():
    try:
        if not os.path.exists("pin.json"):
            return jsonify({"status": "error", "msg": "PIN configuration missing"}), 404
            
        with open("pin.json", "r") as f:
            data = json.load(f)
        
        return jsonify({"pin": data.get("pin")})
    except Exception as e:
        return jsonify({"status": "error", "msg": str(e)}), 500

@app.route("/api/reset_main_pin", methods=["POST"])
def api_reset_main_pin():
    data = request.get_json()
    new_pin = data.get("pin")

    if not new_pin:
        return jsonify({"status": "error", "msg": "PIN required"}), 400

    email = data.get("email")
    save_pin(email, new_pin)
    return jsonify({"status": "ok"})

@app.route("/api/lock_app", methods=["POST"])
def api_lock():
    app_name = request.json["app"]
    lock_app(app_name)
    return {"status":"ok"}

@app.route("/api/unlock_app", methods=["POST"])
def api_unlock():
    app_name = request.json["app"]
    unlock_app(app_name)
    return {"status":"ok"}

LOCK_DB = "locked_apps.json"

def load_lock_db():
    if not os.path.exists(LOCK_DB):
        return {"locked": [], "settings": {}}
    return json.load(open(LOCK_DB))

def save_lock_db(data):
    json.dump(data, open(LOCK_DB, "w"), indent=2)

@app.route("/api/get_locked_apps")
def api_get_locked_apps():
    db = load_lock_db()
    return jsonify({"status": "ok", "data": db})

@app.route("/api/save_locked_apps", methods=["POST"])
def api_save_locked_apps():
    data = request.get_json() or {}
    locked = data.get("locked", [])
    settings = data.get("settings", {})

    save_lock_db({
        "locked": locked,
        "settings": settings
    })

    return jsonify({"status": "ok", "msg": "Saved successfully"})

@app.route("/api/is_app_locked", methods=["POST"])
def api_is_app_locked():
    data = request.get_json() or {}
    appid = data.get("appid")

    if not appid:
        return jsonify({"status": "error", "locked": False})

    if not os.path.exists("locked_apps.json"):
        return jsonify({"status": "ok", "locked": False})

    db = json.load(open("locked_apps.json"))

    locked_list = db.get("locked", [])

    return jsonify({
        "status": "ok",
        "locked": appid in locked_list
    })

@app.route("/api/get_app_settings", methods=["POST"])
def api_get_app_settings():
    appid = request.form.get("appid") or (request.get_json(silent=True) or {}).get("appid")

    if not appid:
        return jsonify({"status":"error","msg":"appid required"}), 400
    
    data = read_locked_apps()
    settings = data.get("settings", {}).get(appid, {"pin": True, "face": False})

    return jsonify({"status":"ok","settings": settings})

@app.route("/api/save_app_settings", methods=["POST"])
def api_save_app_settings():
    payload = request.get_json(force=True, silent=True) or request.form.to_dict()
    appid = payload.get("appid") or request.form.get("appid")
    
    if not appid:
        return jsonify({"status":"error","msg":"appid required"}), 400
    
    pin = payload.get("pin")
    face = payload.get("face")

    def to_bool(v):
        if isinstance(v, bool): return v
        if isinstance(v, str): return v.lower() in ("1","true","yes","on")
        return bool(v)
    
    settings = {"pin": to_bool(pin), "face": to_bool(face)}
    data = read_locked_apps()

    if "settings" not in data: data["settings"] = {}

    data["settings"][appid] = settings
    save_locked_apps(data)

    return jsonify({"status":"ok","msg":"App settings saved."})

@app.route("/api/list-installed-apps")
def list_installed_apps():
    apps = []

    desktop_dirs = [
        "/usr/share/applications",
        "/usr/local/share/applications",
        os.path.expanduser("~/.local/share/applications")
    ]

    for d in desktop_dirs:
        if not os.path.exists(d):
            continue

        for f in os.listdir(d):
            if not f.endswith(".desktop"):
                continue

            path = os.path.join(d, f)

            name = f.replace(".desktop", "")
            icon = "/static/app_icons/default.png"

            try:
                with open(path, "r", errors="ignore") as file:
                    for line in file:
                        if line.startswith("Name="):
                            name = line.split("=", 1)[1].strip()
                        if line.startswith("Icon="):
                            icon_name = line.split("=", 1)[1].strip()
                            icon = f"/static/app_icons/{icon_name}.png"
            except:
                pass

            apps.append({
                "name": name,
                "icon": icon
            })

    return jsonify({"status": "ok", "apps": apps})

@app.route("/api/set_apps", methods=["POST"])
def api_set_apps():
    user = request.form.get("user")
    raw = request.form.getlist("apps[]")

    if not user:
        return jsonify({"status": "error", "msg": "Missing user"}), 400

    apps = [json.loads(a) for a in raw]

    db = load_apps()
    db[user] = apps
    save_apps(db)

    return jsonify({"status": "ok", "msg": "Apps saved"})

@app.route("/api/get_apps/<user>")
def api_get_apps(user):
    if IS_CLOUD:
        return jsonify({"status": "disabled"})
    db = load_apps()
    return jsonify({
        "status": "ok",
        "apps": db.get(user, [])
    })

@app.route("/api/open_app_face", methods=["POST"])
def api_open_app_face():
    if IS_CLOUD:
        return jsonify({"status": "error", "msg": "Face recognition disabled on cloud"})

    appname = request.form.get("appname")
    data_url = request.form.get("image")

    resp = api_unlock_from_camera()
    if resp[1] != 200:
        return resp

    user = resp[0].json["user"]

    db = load_apps()
    user_apps = db.get(user, [])

    if appname not in user_apps:
        return jsonify({"status": "error", "msg": "App not assigned to this user"}), 403

    return jsonify({"status": "ok", "user": user})

@app.route('/api/open_app_password', methods=['POST'])
def open_app_password():
    req_data = request.get_json()
    user_email = req_data.get("email")
    user_pin = req_data.get("pin")

    with open('pin.json', 'r') as f:
        pin_data = json.load(f)

    if user_email in pin_data.get("emails", []):
        stored_hash = pin_data.get("pin")
        if bcrypt.checkpw(user_pin.encode(), stored_hash.encode()):
            return jsonify({"status": "ok", "msg": "Unlocked"})
        else:
            return jsonify({"status": "error", "msg": "Invalid PIN"}), 401
    else:
        return jsonify({"status": "error", "msg": "Invalid Credentials."}), 403

@app.route("/api/check_old_pin", methods=["POST"])
def api_check_old_pin():
    try:
        data = request.get_json()
        email = data.get("email")
        old_pin = data.get("old_pin")

        if not os.path.exists("pin.json"):
            return jsonify({"status": "error", "msg": "Database missing"}), 404

        with open("pin.json", "r") as f:
            db = json.load(f)

        if "emails" in db and email in db["emails"]:
            stored_hash = db.get("pin")
            
            if bcrypt.checkpw(old_pin.encode(), stored_hash.encode()):
                return jsonify({"status": "ok", "msg": "PIN verified"})
            else:
                return jsonify({"status": "error", "msg": "Incorrect old PIN"}), 401
        else:
            return jsonify({"status": "error", "msg": "Email not authorized"}), 403

    except Exception as e:
        print(f"Error in check_old_pin: {e}")
        return jsonify({"status": "error", "msg": str(e)}), 500

@app.route("/api/change_pin", methods=["POST"])
def change_pin():
    try:
        data = request.get_json(force=True)
        
        email = data.get("email")
        old_pin = data.get("old_pin")
        new_pin = data.get("new_pin")

        if not all([email, old_pin, new_pin]):
            return jsonify({"status": "error", "msg": "Missing required fields"}), 400

        with open("pin.json", "r") as f:
            db = json.load(f)

        if "emails" not in db or email not in db["emails"]:
            return jsonify({"status": "error", "msg": "Unauthorized identity"}), 403

        stored_hash = db.get("pin")
        if not bcrypt.checkpw(old_pin.encode(), stored_hash.encode()):
            return jsonify({"status": "error", "msg": "Old PIN verification failed"}), 401

        new_hash = bcrypt.hashpw(new_pin.encode(), bcrypt.gensalt()).decode()
        db["pin"] = new_hash
        
        with open("pin.json", "w") as f:
            json.dump(db, f, indent=2)

        return jsonify({"status": "ok", "msg": "PIN updated successfully"})

    except Exception as e:
        print(f"Change PIN Error: {e}")
        return jsonify({"status": "error", "msg": str(e)}), 500
    
@app.route("/api/reset_pin", methods=["POST"])
def api_reset_pin():
    new_pin = request.form.get("pin", "").strip()
    email = request.form.get("email")

    if not new_pin or len(new_pin) != 4:
        return jsonify({"status": "error", "msg": "PIN must be 4 digits"}), 400

    try:
        with open("pin.json", "r") as f:
            db = json.load(f)
    except:
        return jsonify({"status": "error", "msg": "Database missing"}), 500

    user = next((u for u in db["users"] if u["email"] == email), None)

    if user:
        user["pin"] = hash_pin(new_pin)

    with open("pin.json", "w") as f:
        json.dump(db, f, indent=2)

    return jsonify({"status": "ok", "msg": "PIN updated successfully"})

@app.route("/api/send_reset_email", methods=["POST"])
def api_send_reset_email():
    email = request.form.get("email")

    if not email:
        return jsonify({"status":"error","msg":"Email required"}), 400

    code = str(random.randint(100000, 999999))
    expires = time.time() + 600

    reset_tokens[email] = {
        "code": code,
        "expires": expires
    }

    try:
        msg = Message(
            subject="Your PIN Reset Code",
            recipients=[email],
            sender=app.config['MAIL_DEFAULT_SENDER']
        )
        msg.body = f"Your security reset code is: {code}\nThis code expires in 10 minutes."
        mail.send(msg)
    except Exception as e:
        print("❌ MAIL ERROR:", e)
        return jsonify({"status":"error","msg":str(e)}), 500

    return jsonify({"status":"ok","msg":"Reset code sent"})

@app.route("/api/verify_email_code", methods=["POST"])
def api_verify_email_code():
    email = request.form.get("email")
    code = request.form.get("code")

    if not email or not code:
        return jsonify({"status":"error","msg":"Missing data"}), 400

    if email not in reset_tokens:
        return jsonify({"status":"error","msg":"No reset request found"}), 400

    entry = reset_tokens[email]

    if time.time() > entry["expires"]:
        del reset_tokens[email]
        return jsonify({"status":"error","msg":"Code expired"}), 400

    if code != entry["code"]:
        return jsonify({"status":"error","msg":"Invalid code"}), 400

    reset_tokens[email]["verified"] = True
    return jsonify({"status":"ok","msg":"Email verified"})

@app.route("/api/set_email", methods=["POST"])
def api_set_email():
    data = request.json
    email = data.get("email")

    if not email:
        return jsonify({"status": "error", "msg": "Email missing"}), 400

    os.makedirs("config", exist_ok=True)
    with open("config/email.txt", "w") as f:
        f.write(email)

    return jsonify({"status": "ok", "msg": "Email registered!"})

@app.route("/api/list_users", methods=["GET"])
def list_users():
    try:
        if not os.path.exists("pin.json"):
            return jsonify({"status": "ok", "users": []})
        
        with open("pin.json", "r") as f:
            db = json.load(f)
        
        users = []
        for user in db.get("users", []):
            users.append({
                "username": user.get("username"),
                "display_name": user.get("display_name"),
                "face_enrolled": user.get("face_enrolled", False),
                "emails": user.get("emails", [])
            })
        
        return jsonify({
            "status": "ok", 
            "users": users,
            "count": len(users)
        })
        
    except Exception as e:
        print(f"Error listing users: {e}")
        return jsonify({"status": "error", "msg": str(e)}), 500

@app.route("/api/get_all_users")
def api_get_all_users():
    if IS_CLOUD:
        return jsonify({"status": "disabled for security"})
    if not session.get("admin"):
        return jsonify({"error": "Unauthorized"}), 403
    base = "known_faces"
    if not os.path.exists(base):
        return jsonify({"users": []})

    users = []
    for name in os.listdir(base):
        if os.path.isdir(os.path.join(base, name)):
            users.append(name)

    return jsonify({"users": users})

@app.route("/api/register_email", methods=["POST"])
def register_email():
    try:
        data = request.get_json()
        new_email = data.get("email")

        with open("pin.json", "r") as f:
            db = json.load(f)

        if "emails" not in db or not isinstance(db["emails"], list):
            db["emails"] = []

        if new_email and new_email not in db["emails"]:
            db["emails"].append(new_email)
            with open("pin.json", "w") as f:
                json.dump(db, f, indent=2)
            return jsonify({"status": "ok"})
        
        return jsonify({"status": "exists", "msg": "Email already registered"})
    except Exception as e:
        return jsonify({"status": "error", "msg": str(e)}), 500

@app.route("/api/get_email")
def api_get_email():
    file = "config/email.txt"

    if not os.path.exists(file):
        return jsonify({"status": "ok", "email": None})

    with open(file, "r") as f:
        email = f.read().strip()

    return jsonify({"status": "ok", "email": email})

@app.route("/api/delete_email", methods=["POST"])
def api_delete_email():
    file = "config/email.txt"
    if os.path.exists(file):
        os.remove(file)
    return jsonify({"status": "ok", "msg": "Email removed"})

@app.route("/api/get_saved_email", methods=["GET"])
def get_saved_email():
    try:
        if not os.path.exists("pin.json"):
            return jsonify({"status": "error", "msg": "No database found"}), 404
        
        try:
            with open("pin.json", "r") as f:
                content = f.read().strip()
                if not content:
                    return jsonify({"status": "ok", "emails": []}), 200
                db = json.loads(content)
        except json.JSONDecodeError:
            return jsonify({"status": "error", "msg": "Database corrupted"}), 500
        
        all_emails = []
        
        for user in db.get("users", []):
            user_emails = user.get("emails", [])
            all_emails.extend(user_emails)
        
        all_emails = list(set(all_emails))
        
        return jsonify({
            "status": "ok",
            "emails": all_emails,
            "count": len(all_emails)
        })
        
    except Exception as e:
        print(f"Error getting saved emails: {e}")
        return jsonify({"status": "error", "msg": str(e)}), 500

@app.route("/api/delete_saved_email", methods=["POST"])
def delete_saved_email():
    try:
        data = request.get_json()
        email_to_remove = data.get("email", "").strip().lower()

        if not email_to_remove:
            return jsonify({"status": "error", "msg": "Email required"}), 400

        if not os.path.exists("pin.json"):
            return jsonify({"status": "error", "msg": "Database not found"}), 404

        try:
            with open("pin.json", "r") as f:
                content = f.read().strip()
                if not content:
                    return jsonify({"status": "error", "msg": "Database empty"}), 500
                db = json.loads(content)
        except json.JSONDecodeError:
            return jsonify({"status": "error", "msg": "Database corrupted"}), 500

        email_found = False
        for user in db.get("users", []):
            if email_to_remove in user.get("emails", []):
                user["emails"].remove(email_to_remove)
                user["updated_at"] = time.time()
                email_found = True
                print(f"✅ Removed email {email_to_remove} from user {user.get('username')}")
                break

        if not email_found:
            return jsonify({"status": "error", "msg": "Email not found"}), 404

        with open("pin.json", "w") as f:
            json.dump(db, f, indent=4)

        return jsonify({"status": "ok", "msg": "Email removed successfully"})

    except Exception as e:
        print(f"Error deleting saved email: {e}")
        return jsonify({"status": "error", "msg": str(e)}), 500

ENROLLED_FACE_PATH = "data/enrolled_user.jpg"

@app.route('/api/verify-face', methods=['POST'])
def verify_face():
    if IS_CLOUD:
        return jsonify({"status": "error", "msg": "Face recognition disabled on cloud"})
    data = request.json
    image_data = data.get('image')
    
    if not image_data:
        return jsonify({"status": "error", "message": "No image provided"}), 400

    try:
        header, encoded = image_data.split(",", 1)
        data_bytes = base64.b64decode(encoded)
        
        with open("temp_scan.jpg", "wb") as f:
            f.write(data_bytes)

        known_image = face_recognition.load_image_file(ENROLLED_FACE_PATH)
        unknown_image = face_recognition.load_image_file("temp_scan.jpg")

        known_encoding = face_recognition.face_encodings(known_image)[0]
        unknown_encodings = face_recognition.face_encodings(unknown_image)

        if len(unknown_encodings) > 0:
            results = face_recognition.compare_faces(
                [known_encoding],
                unknown_encodings[0]
            )
            return jsonify({"status": "success" if results[0] else "fail"})
        else:
            return jsonify({"status": "fail", "reason": "No face detected"})

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

# Initialize limiter correctly
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"]
)

@app.route("/api/verify-pin", methods=["POST"])
def api_verify_pin():
    try:
        data = request.get_json(silent=True) or {}

        print("📥 VERIFY PIN REQUEST:", data)

        username = str(data.get("username", data.get("email", ""))).strip().lower()
        user_input_pin = str(data.get("pin", "")).strip()

        if not username or not user_input_pin:
            return jsonify({
                "status": "fail",
                "message": "Missing username or PIN"
            }), 400

        if not user_input_pin.isdigit() or len(user_input_pin) != 4:
            return jsonify({
                "status": "fail",
                "message": "PIN must be exactly 4 digits"
            }), 400

        if not os.path.exists("pin.json"):
            return jsonify({
                "status": "fail",
                "message": "PIN database not found"
            }), 500

        try:
            with open("pin.json", "r") as f:
                content = f.read().strip()
                if not content:
                    return jsonify({
                        "status": "fail",
                        "message": "Database is empty"
                    }), 500
                db = json.loads(content)
        except json.JSONDecodeError:
            return jsonify({
                "status": "fail",
                "message": "Database corrupted"
            }), 500

        user = None
        for u in db.get("users", []):
            if u.get("username") == username:
                user = u
                break

        if not user:
            return jsonify({
                "status": "fail",
                "message": f"User '{username}' not found"
            }), 404

        stored_pin = user.get("pin")
        
        if not stored_pin:
            return jsonify({
                "status": "fail",
                "message": "PIN not set for this user"
            }), 500

        import bcrypt
        try:
            if bcrypt.checkpw(user_input_pin.encode(), stored_pin.encode()):
                print(f"✅ PIN verified for user: {username}")
                return jsonify({
                    "status": "success",
                    "message": "PIN verified",
                    "username": username,
                    "emails": user.get("emails", [])
                })
            else:
                print(f"❌ Invalid PIN for user: {username}")
                return jsonify({
                    "status": "fail",
                    "message": "Incorrect PIN"
                }), 401
        except Exception as e:
            print(f"❌ BCrypt error: {e}")
            return jsonify({
                "status": "error",
                "message": "PIN verification failed"
            }), 500

    except Exception as e:
        import traceback
        traceback.print_exc()
        print("❌ VERIFY PIN ERROR:", str(e))
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500


@app.route("/api/request_reset", methods=["POST"])
def api_request_reset():
    try:
        data = request.get_json()
        email_input = data.get("email", "").strip().lower()
        
        print(f"📧 Reset request for email: {email_input}")
        
        if not email_input:
            return jsonify({"status": "error", "message": "Email required"}), 400
        
        if not os.path.exists("pin.json"):
            return jsonify({"status": "error", "message": "Database not found"}), 500
        
        with open("pin.json", "r") as f:
            db = json.load(f)
        
        email_found = False
        username = None
        
        for user in db.get("users", []):
            if email_input in user.get("emails", []):
                email_found = True
                username = user.get("username")
                print(f"✅ Email found for user: {username}")
                break
        
        if not email_found:
            if email_input in db.get("emails", []):
                email_found = True
                print(f"✅ Email found in old emails list")
        
        if not email_found:
            print(f"❌ Email not found: {email_input}")
            return jsonify({
                "status": "error", 
                "message": f"Email '{email_input}' is not registered"
            }), 404
        
        code = str(random.randint(100000, 999999))
        expires = time.time() + 600
        
        reset_tokens[email_input] = {
            "code": code,
            "expires": expires,
            "username": username
        }
        
        db["reset_code"] = code
        db["reset_email"] = email_input
        with open("pin.json", "w") as f:
            json.dump(db, f, indent=2)
        
        try:
            msg = Message(
                subject="🔐 CyberLock PIN Reset Code",
                recipients=[email_input],
                sender=app.config['MAIL_DEFAULT_SENDER']
            )
            msg.body = f"""
Your PIN reset code is: {code}

This code expires in 10 minutes.

If you didn't request this reset, please ignore this email.

- CyberLock Security Team
"""
            mail.send(msg)
            print(f"✅ Reset code sent to {email_input}: {code}")
        except Exception as e:
            print(f"❌ Mail error: {e}")
            return jsonify({"status": "error", "message": "Failed to send email"}), 500
        
        return jsonify({
            "status": "ok", 
            "message": "Reset code sent to your email",
            "email": email_input
        })
        
    except Exception as e:
        print(f"❌ Reset error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"status": "error", "message": str(e)}), 500

FACE_DATA_DIR = "known_faces"

@app.route("/api/verify-face-js", methods=["POST"])
def verify_face_js():
    if IS_CLOUD:
        return jsonify({"status": "disabled"})
    data = request.json
    incoming = np.array(data.get("descriptor"))

    db = load_faces()

    for name, desc_list in db.items():
        for d in desc_list:
            known = np.array(d)

            dist = np.linalg.norm(known - incoming)

            if dist < 0.5:
                return jsonify({"status": "success", "user": name})

    return jsonify({"status": "fail"})
    
@app.route("/api/unlock_from_camera", methods=["POST"])
def api_unlock_from_camera():
    if IS_CLOUD:
        return jsonify({"status": "error", "msg": "Face recognition disabled on cloud"})

    try:
        data = request.get_json(force=True, silent=True) or {}
        data_url = data.get("image")

        if not data_url:
            return jsonify({"status": "error", "msg": "No image data received"}), 400

        try:
            if "," in data_url:
                header, encoded = data_url.split(",", 1)
            else:
                encoded = data_url

            img_bytes = base64.b64decode(encoded)
            img = Image.open(BytesIO(img_bytes)).convert("RGB")
            frame = np.array(img)
        except Exception as e:
            print(f"❌ Decode Error: {e}")
            return jsonify({"status": "error", "msg": "Bad image format"}), 400

        try:
            dets = detector(frame, 1)
            if len(dets) == 0:
                return jsonify({"status": "error", "msg": "No face detected in frame"}), 400

            shape = sp(frame, dets[0])
            encoding = np.array(facerec.compute_face_descriptor(frame, shape))

            best_match = None
            best_dist = 0.6
            all_matches = []

            if os.path.exists("known_faces"):
                for person in os.listdir("known_faces"):
                    person_path = os.path.join("known_faces", person)
                    if not os.path.isdir(person_path):
                        continue
                    
                    person_matches = []
                    for f_name in os.listdir(person_path):
                        if f_name.endswith(".enc"):
                            try:
                                with open(os.path.join(person_path, f_name), 'rb') as f:
                                    encrypted = f.read()
                                known_enc = decrypt_face_encoding(encrypted)
                                dist = np.linalg.norm(known_enc - encoding)
                                person_matches.append(dist)
                                
                                if dist < best_dist:
                                    best_dist = dist
                                    best_match = person
                            except Exception as e:
                                print(f"⚠️ Encoding read error for {person}/{f_name}: {e}")
                    
                    if person_matches:
                        avg_dist = sum(person_matches) / len(person_matches)
                        all_matches.append({"user": person, "distance": avg_dist})
                        print(f"📊 {person}: avg distance = {avg_dist:.3f}")

            if best_match:
                confidence = round(float(1 - best_dist), 2)
                print(f"✅ Face recognized: {best_match} (confidence: {confidence})")
                return jsonify({
                    "status": "ok",
                    "user": best_match,
                    "confidence": confidence,
                    "msg": f"Welcome {best_match}!"
                })
            else:
                print("❌ Face not recognized")
                return jsonify({
                    "status": "error",
                    "msg": "Face not recognized. Please ensure good lighting and face clearly visible."
                }), 401

        except Exception as e:
            print(f"❌ Recognition Error: {e}")
            import traceback
            traceback.print_exc()
            return jsonify({"status": "error", "msg": "AI processing failed"}), 500

    except Exception as e:
        print(f"❌ Unlock error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"status": "error", "msg": str(e)}), 500

@app.route("/api/verify_system_pin", methods=["POST"])
def verify_system_pin():
    try:
        data = request.get_json() or {}
        user_input_pin = str(data.get("pin", "")).strip()

        print(f"🔐 Verifying system PIN: {user_input_pin}")

        if not user_input_pin:
            return jsonify({
                "status": "fail",
                "message": "PIN required"
            }), 400

        if not user_input_pin.isdigit() or len(user_input_pin) != 4:
            return jsonify({
                "status": "fail",
                "message": "PIN must be exactly 4 digits"
            }), 400

        if not os.path.exists("pin.json"):
            return jsonify({
                "status": "fail",
                "message": "PIN database not found"
            }), 500

        try:
            with open("pin.json", "r") as f:
                content = f.read().strip()
                if not content:
                    return jsonify({
                        "status": "fail",
                        "message": "Database is empty"
                    }), 500
                db = json.loads(content)
        except json.JSONDecodeError as e:
            print(f"❌ JSON decode error: {e}")
            return jsonify({
                "status": "fail",
                "message": "Database corrupted"
            }), 500

        users = db.get("users", [])
        if not users:
            return jsonify({
                "status": "fail",
                "message": "No users registered"
            }), 404

        import bcrypt
        
        for user in users:
            stored_pin = user.get("pin")
            if stored_pin:
                try:
                    if bcrypt.checkpw(user_input_pin.encode(), stored_pin.encode()):
                        print(f"✅ PIN verified for user: {user.get('username')}")
                        return jsonify({
                            "status": "success",
                            "message": "PIN verified",
                            "username": user.get("username")
                        })
                except Exception as e:
                    print(f"❌ BCrypt error for {user.get('username')}: {e}")
                    continue
        
        print("❌ Invalid system PIN")
        return jsonify({
            "status": "fail",
            "message": "Invalid PIN"
        }), 401

    except Exception as e:
        print(f"❌ System PIN verify error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@app.route("/api/save-face", methods=["POST"])
def save_face():
    data = request.json
    email = data.get("email")
    incoming_descriptor = np.array(data.get("descriptor"))

    if not email or incoming_descriptor is None:
        return jsonify({"status": "error", "msg": "Missing data"}), 400

    db = load_faces()

    for name, desc_list in db.items():
        for existing_desc in desc_list:
            known = np.array(existing_desc)
            dist = np.linalg.norm(known - incoming_descriptor)

            if dist < 0.4:
                return jsonify({
                    "status": "exists", 
                    "msg": f"Access Denied: You are already enrolled as '{name}'."
                }), 403

    if email in db:
        db[email].append(incoming_descriptor.tolist())
    else:
        db[email] = [incoming_descriptor.tolist()]

    save_faces(db)
    return jsonify({"status": "ok", "msg": "Enrollment successful!"})

@app.route("/api/check_email_exists", methods=["POST"])
def check_email_exists():
    try:
        data = request.get_json()
        email = data.get("email", "").strip().lower()
        
        if not email:
            return jsonify({"exists": False}), 200
        
        if os.path.exists("pin.json"):
            try:
                with open("pin.json", "r") as f:
                    content = f.read().strip()
                    if content:
                        db = json.loads(content)
                    else:
                        return jsonify({"exists": False}), 200
            except json.JSONDecodeError:
                return jsonify({"exists": False}), 200
        else:
            return jsonify({"exists": False}), 200
        
        for user in db.get("users", []):
            if email in user.get("emails", []):
                return jsonify({
                    "exists": True,
                    "message": f"Email already registered to user '{user.get('username')}'"
                }), 200
        
        return jsonify({"exists": False}), 200
        
    except Exception as e:
        print(f"Error checking email: {e}")
        return jsonify({"exists": False}), 200

@app.route("/api/add_email_to_account", methods=["POST"])
def add_email_to_account():
    try:
        data = request.get_json()
        username = data.get("username", "").strip()
        new_email = data.get("email", "").strip().lower()
        pin = data.get("pin", "").strip()
        
        if not username or not new_email or not pin:
            return jsonify({
                "status": "error",
                "message": "Username, email, and PIN required"
            }), 400
        
        if not pin.isdigit() or len(pin) != 4:
            return jsonify({
                "status": "error",
                "message": "PIN must be exactly 4 digits"
            }), 400
        
        if not os.path.exists("pin.json"):
            return jsonify({
                "status": "error",
                "message": "Database not found"
            }), 500
        
        with open("pin.json", "r") as f:
            db = json.load(f)
        
        user = None
        for u in db.get("users", []):
            if u.get("username") == username:
                user = u
                break
        
        if not user:
            return jsonify({
                "status": "error",
                "message": f"User '{username}' not found"
            }), 404
        
        import bcrypt
        if not bcrypt.checkpw(pin.encode(), user["pin"].encode()):
            return jsonify({
                "status": "error",
                "message": "Invalid PIN"
            }), 401
        
        if new_email in user.get("emails", []):
            return jsonify({
                "status": "error",
                "message": "Email already registered to this account"
            }), 400
        
        for u in db.get("users", []):
            if new_email in u.get("emails", []):
                return jsonify({
                    "status": "error",
                    "message": f"Email already registered to user '{u.get('username')}'"
                }), 400
        
        user["emails"].append(new_email)
        user["updated_at"] = time.time()
        
        if "emails" not in db:
            db["emails"] = []
        db["emails"].append(new_email)
        
        with open("pin.json", "w") as f:
            json.dump(db, f, indent=4)
        
        return jsonify({
            "status": "success",
            "message": f"Email {new_email} added to account {username}",
            "username": username,
            "emails": user["emails"]
        }), 200
        
    except Exception as e:
        print(f"Error adding email: {e}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@app.route("/api/verify_pin_for_user", methods=["POST"])
def verify_pin_for_user():
    try:
        data = request.get_json()
        username = data.get("username", "").strip()
        pin = data.get("pin", "").strip()
        
        if not username or not pin:
            return jsonify({
                "status": "error",
                "message": "Username and PIN required"
            }), 400
        
        if not pin.isdigit() or len(pin) != 4:
            return jsonify({
                "status": "error",
                "message": "PIN must be exactly 4 digits"
            }), 400
        
        if not os.path.exists("pin.json"):
            return jsonify({
                "status": "error",
                "message": "Database not found"
            }), 500
        
        with open("pin.json", "r") as f:
            db = json.load(f)
        
        user = None
        for u in db.get("users", []):
            if u.get("username") == username:
                user = u
                break
        
        if not user:
            return jsonify({
                "status": "error",
                "message": f"User '{username}' not found"
            }), 404
        
        import bcrypt
        if bcrypt.checkpw(pin.encode(), user["pin"].encode()):
            return jsonify({
                "status": "success",
                "message": "PIN verified",
                "username": username,
                "emails": user.get("emails", [])
            })
        else:
            return jsonify({
                "status": "error",
                "message": "Invalid PIN"
            }), 401
            
    except Exception as e:
        print(f"Error verifying PIN: {e}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@app.route("/api/change_pin_by_username", methods=["POST"])
def change_pin_by_username():
    try:
        data = request.get_json()
        username = data.get("username", "").strip()
        old_pin = data.get("old_pin", "").strip()
        new_pin = data.get("new_pin", "").strip()
        
        if not username or not old_pin or not new_pin:
            return jsonify({
                "status": "error",
                "message": "Missing required fields"
            }), 400
        
        if not new_pin.isdigit() or len(new_pin) != 4:
            return jsonify({
                "status": "error",
                "message": "New PIN must be exactly 4 digits"
            }), 400
        
        if not os.path.exists("pin.json"):
            return jsonify({
                "status": "error",
                "message": "Database not found"
            }), 500
        
        with open("pin.json", "r") as f:
            db = json.load(f)
        
        user_index = None
        user = None
        for i, u in enumerate(db.get("users", [])):
            if u.get("username") == username:
                user_index = i
                user = u
                break
        
        if not user:
            return jsonify({
                "status": "error",
                "message": f"User '{username}' not found"
            }), 404
        
        import bcrypt
        if not bcrypt.checkpw(old_pin.encode(), user["pin"].encode()):
            return jsonify({
                "status": "error",
                "message": "Incorrect old PIN"
            }), 401
        
        hashed_new_pin = bcrypt.hashpw(new_pin.encode(), bcrypt.gensalt()).decode()
        
        db["users"][user_index]["pin"] = hashed_new_pin
        db["users"][user_index]["updated_at"] = time.time()
        
        with open("pin.json", "w") as f:
            json.dump(db, f, indent=4)
        
        print(f"✅ PIN updated for user: {username}")
        
        return jsonify({
            "status": "success",
            "message": "PIN updated successfully"
        })
        
    except Exception as e:
        print(f"Error changing PIN: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500
    
@app.route("/api/send_create_otp", methods=["POST"])
def send_create_otp():
    try:
        data = request.get_json()
        email = data.get("email", "").strip().lower()
        
        if not email:
            return jsonify({"status": "error", "message": "Email required"}), 400
        
        code = str(random.randint(100000, 999999))
        expires = time.time() + 600
        
        reset_tokens[email] = {
            "code": code,
            "expires": expires
        }
        
        msg = Message(
            subject="Your Account Verification Code",
            recipients=[email],
            sender=app.config['MAIL_DEFAULT_SENDER']
        )
        msg.body = f"Your verification code is: {code}\n\nThis code expires in 10 minutes.\n\nWelcome to CyberLock!"
        mail.send(msg)
        
        print(f"✅ OTP sent to {email}: {code}")
        
        return jsonify({
            "status": "success",
            "message": "OTP sent successfully"
        }), 200
        
    except Exception as e:
        print(f"Error sending OTP: {e}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@app.route("/api/verify_create_otp", methods=["POST"])
def verify_create_otp():
    try:
        data = request.get_json()
        email = data.get("email", "").strip().lower()
        code = data.get("code", "").strip()
        
        if not email or not code:
            return jsonify({"status": "error", "message": "Missing data"}), 400
        
        if email not in reset_tokens:
            return jsonify({"status": "error", "message": "No OTP request found"}), 400
        
        token = reset_tokens[email]
        
        if time.time() > token["expires"]:
            del reset_tokens[email]
            return jsonify({"status": "error", "message": "OTP expired"}), 400
        
        if code != token["code"]:
            return jsonify({"status": "error", "message": "Invalid OTP"}), 400
        
        del reset_tokens[email]
        
        return jsonify({
            "status": "success",
            "message": "OTP verified"
        }), 200
        
    except Exception as e:
        print(f"Error verifying OTP: {e}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@app.route("/api/check_username_exists", methods=["POST"])
def check_username_exists():
    try:
        data = request.get_json()
        username = data.get("username", "").strip()
        
        if not username:
            return jsonify({"exists": False}), 200
        
        if not re.match(r'^[a-zA-Z0-9_]+$', username):
            return jsonify({
                "exists": False,
                "invalid": True,
                "message": "Username can only contain letters, numbers, and underscores"
            }), 200
        
        if os.path.exists("pin.json"):
            try:
                with open("pin.json", "r") as f:
                    content = f.read().strip()
                    if content:
                        db = json.loads(content)
                    else:
                        return jsonify({"exists": False}), 200
            except json.JSONDecodeError:
                return jsonify({"exists": False}), 200
        else:
            return jsonify({"exists": False}), 200
        
        for user in db.get("users", []):
            if user.get("username") == username:
                return jsonify({"exists": True, "message": "Username already taken"}), 200
        
        return jsonify({"exists": False}), 200
        
    except Exception as e:
        print(f"Error checking username: {e}")
        return jsonify({"exists": False}), 200

@app.route("/api/create_user_account", methods=["POST"])
def create_user_account():
    try:
        data = request.get_json()
        username = data.get("username", "").strip().lower()
        display_name = data.get("display_name", username).strip()
        email = data.get("email", "").strip().lower()
        pin = data.get("pin", "").strip()
        
        print(f"📝 Creating account - Username: {username}, Email: {email}")
        
        if not pin or len(pin) != 4 or not pin.isdigit():
            return jsonify({
                "status": "error",
                "message": "PIN must be exactly 4 digits"
            }), 400
        
        if not email or '@' not in email:
            return jsonify({
                "status": "error",
                "message": "Valid email required"
            }), 400
        
        if not username or len(username) < 3:
            return jsonify({
                "status": "error",
                "message": "Username must be at least 3 characters"
            }), 400
        
        if not re.match(r'^[a-zA-Z0-9_]+$', username):
            return jsonify({
                "status": "error",
                "message": "Username can only contain letters, numbers, and underscores"
            }), 400
        
        db = {"users": [], "settings": {}}
        
        if os.path.exists("pin.json"):
            try:
                with open("pin.json", "r") as f:
                    content = f.read().strip()
                    if content:
                        db = json.loads(content)
                    else:
                        print("⚠️ pin.json is empty, creating new structure")
                        db = {"users": [], "settings": {}}
            except json.JSONDecodeError as e:
                print(f"⚠️ Error parsing pin.json: {e}, creating new structure")
                db = {"users": [], "settings": {}}
        else:
            print("📁 pin.json doesn't exist, creating new")
        
        if "users" not in db:
            db["users"] = []
        if "settings" not in db:
            db["settings"] = {
                "allow_new_registration": True,
                "require_email_verification": True
            }
        
        for user in db["users"]:
            if user.get("username") == username:
                return jsonify({
                    "status": "error",
                    "message": f"Username '{username}' already taken"
                }), 400
        
        for user in db["users"]:
            if email in user.get("emails", []):
                return jsonify({
                    "status": "error",
                    "message": f"Email already registered to user '{user.get('username')}'"
                }), 400
        
        import bcrypt
        hashed_pin = bcrypt.hashpw(pin.encode(), bcrypt.gensalt()).decode()
        
        new_user = {
            "username": username,
            "display_name": display_name,
            "emails": [email],
            "pin": hashed_pin,
            "created_at": time.time(),
            "updated_at": time.time(),
            "face_enrolled": False,
            "face_folder": username,
            "active": True,
            "role": "user"
        }
        
        db["users"].append(new_user)
        
        with open("pin.json", "w") as f:
            json.dump(db, f, indent=4)
        
        print(f"✅ New user created: {username} (email: {email})")
        
        return jsonify({
            "status": "success",
            "message": f"Account '{username}' created successfully",
            "username": username,
            "email": email
        }), 200
        
    except Exception as e:
        print(f"Error creating user: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@app.route("/api/add_email_to_user", methods=["POST"])
def add_email_to_user():
    try:
        data = request.get_json()
        username = data.get("username", "").strip()
        new_email = data.get("email", "").strip().lower()
        pin = data.get("pin", "").strip()
        
        if not username or not new_email or not pin:
            return jsonify({
                "status": "error",
                "message": "Username, email, and PIN required"
            }), 400
        
        if not pin.isdigit() or len(pin) != 4:
            return jsonify({
                "status": "error",
                "message": "PIN must be exactly 4 digits"
            }), 400
        
        if not os.path.exists("pin.json"):
            return jsonify({
                "status": "error",
                "message": "Database not found"
            }), 500
        
        with open("pin.json", "r") as f:
            db = json.load(f)
        
        user_index = None
        user = None
        for i, u in enumerate(db.get("users", [])):
            if u.get("username") == username:
                user_index = i
                user = u
                break
        
        if not user:
            return jsonify({
                "status": "error",
                "message": f"User '{username}' not found"
            }), 404
        
        import bcrypt
        if not bcrypt.checkpw(pin.encode(), user["pin"].encode()):
            return jsonify({
                "status": "error",
                "message": "Invalid PIN"
            }), 401
        
        for u in db.get("users", []):
            if new_email in u.get("emails", []):
                return jsonify({
                    "status": "error",
                    "message": f"Email already registered to user '{u.get('username')}'"
                }), 400
        
        db["users"][user_index]["emails"].append(new_email)
        db["users"][user_index]["updated_at"] = time.time()
        
        with open("pin.json", "w") as f:
            json.dump(db, f, indent=4)
        
        return jsonify({
            "status": "success",
            "message": f"Email {new_email} added to account {username}",
            "username": username,
            "emails": db["users"][user_index]["emails"]
        }), 200
        
    except Exception as e:
        print(f"Error adding email: {e}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@app.route("/api/get_user_by_email", methods=["POST"])
def get_user_by_email():
    try:
        data = request.get_json()
        email = data.get("email", "").strip().lower()
        
        if not email:
            return jsonify({
                "status": "error",
                "message": "Email required"
            }), 400
        
        if not os.path.exists("pin.json"):
            return jsonify({
                "status": "error",
                "message": "Database not found"
            }), 500
        
        with open("pin.json", "r") as f:
            db = json.load(f)
        
        for user in db.get("users", []):
            if email in user.get("emails", []):
                return jsonify({
                    "status": "success",
                    "username": user.get("username"),
                    "display_name": user.get("display_name"),
                    "emails": user.get("emails"),
                    "face_enrolled": user.get("face_enrolled", False),
                    "role": user.get("role", "user")
                }), 200
        
        return jsonify({
            "status": "error",
            "message": "Email not registered"
        }), 404
        
    except Exception as e:
        print(f"Error getting user: {e}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@app.route("/api/list_all_users", methods=["GET"])
def list_all_users():
    try:
        if not os.path.exists("pin.json"):
            return jsonify({
                "status": "success",
                "users": []
            }), 200
        
        with open("pin.json", "r") as f:
            db = json.load(f)
        
        users = []
        for user in db.get("users", []):
            users.append({
                "username": user.get("username"),
                "display_name": user.get("display_name"),
                "emails": user.get("emails"),
                "face_enrolled": user.get("face_enrolled", False),
                "created_at": user.get("created_at"),
                "role": user.get("role", "user")
            })
        
        return jsonify({
            "status": "success",
            "users": users,
            "count": len(users)
        }), 200
        
    except Exception as e:
        print(f"Error listing users: {e}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@app.route("/api/delete_user", methods=["POST"])
def api_delete_user():
    try:
        if request.is_json:
            data = request.get_json()
            user = data.get("user", "").strip()
        else:
            user = request.form.get("user", "").strip()
        
        print(f"🗑️ Delete request for user: {user}")
        
        if not user:
            return jsonify({"status": "error", "msg": "Missing user"}), 400
        
        user_exists = False
        user_index = None
        
        if os.path.exists("pin.json"):
            with open("pin.json", "r") as f:
                db = json.load(f)
            
            for i, u in enumerate(db.get("users", [])):
                if u.get("username") == user:
                    user_exists = True
                    user_index = i
                    break
        
        if not user_exists:
            return jsonify({"status": "error", "msg": f"User '{user}' does not exist"}), 404
        
        face_folder = os.path.join("known_faces", user)
        if os.path.exists(face_folder):
            import shutil
            shutil.rmtree(face_folder)
            print(f"✅ Deleted face folder: {face_folder}")
        
        if user_index is not None:
            db["users"].pop(user_index)
            
            with open("pin.json", "w") as f:
                json.dump(db, f, indent=4)
            
            print(f"✅ User '{user}' deleted successfully")
            
            return jsonify({
                "status": "ok", 
                "msg": f"User '{user}' deleted successfully"
            })
        else:
            return jsonify({"status": "error", "msg": "User not found in database"}), 404
        
    except Exception as e:
        print(f"Error deleting user: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"status": "error", "msg": f"System error: {str(e)}"}), 500
    
@app.route("/admin/add-user")
def admin_add_user():
    if not session.get("is_admin"):
        return redirect("/mobile")
    return render_template("admin_add_user.html")

@app.route("/api/admin_create_user", methods=["POST"])
def admin_create_user():
    try:
        if not session.get("is_admin"):
            return jsonify({"status": "error", "message": "Unauthorized"}), 403
        
        data = request.get_json()
        username = data.get("username", "").strip().lower()
        email = data.get("email", "").strip().lower()
        pin = data.get("pin", "").strip()
        
        return jsonify({"status": "success", "message": "User created"})
        
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == "__main__":
    import os

    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    port = int(os.environ.get("PORT", 5000))

    if IS_RENDER:
        # On Render, use HTTP
        print("🚀 Running on Render - HTTP mode")
        app.run(host="0.0.0.0", port=port, debug=False)
    else:
        # Local deployment - HTTPS with self-signed certs
        if os.path.exists("cert.pem") and os.path.exists("key.pem"):
            ssl_context = ('cert.pem', 'key.pem')
            print("🔐 HTTPS running at: https://10.190.1.186:5000/mobile")
            print("📍 Local: https://127.0.0.1:5000/mobile")
            app.run(host="0.0.0.0", port=port, debug=False, ssl_context=ssl_context)
        else:
            print("⚠️ No SSL certs found. Run with HTTP only")
            print("🌐 HTTP running at: http://10.190.1.186:5000/mobile")
            app.run(host="0.0.0.0", port=port, debug=False)


def main():
    import os
    import sys
    import webbrowser
    import threading
    import time
    
    # Get the directory where the package is installed
    package_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Change to package directory
    os.chdir(package_dir)
    
    # Import the app
    from web_app import app
    
    def open_browser():
        time.sleep(2)
        webbrowser.open("http://127.0.0.1:5000/mobile")
    
    print("🚀 Starting CyberLock...")
    print("📱 Opening browser in a few seconds...")
    threading.Thread(target=open_browser).start()
    app.run(host="127.0.0.1", port=5000, debug=False)

if __name__ == "__main__":
    main()
