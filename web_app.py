# web_app.py — now including Locked Apps system
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

# FORCE LOCAL MODE (no Docker / no cloud)
IS_CLOUD = False

# Import face libraries (needed for your app)
import cv2
import dlib
import face_recognition
from flask import redirect, url_for, session

import os


app = Flask(__name__)
FACE_DB = "face_db.json"


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
mail = Mail(app)   # ✅ REQUIRED


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
detector = dlib.get_frontal_face_detector()
sp = dlib.shape_predictor("models/shape_predictor_68_face_landmarks.dat")
facerec = dlib.face_recognition_model_v1("models/dlib_face_recognition_resnet_model_v1.dat")
# ------------------------------
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
# Utility: Save Faces
# ------------------------------
def save_encoding_and_images(name, frames, encodings):
    if IS_CLOUD:
        return  # skip in cloud

    folder = f"known_faces/{name}"
    os.makedirs(folder, exist_ok=True)

    for i, frame in enumerate(frames):
        cv2.imwrite(
            f"{folder}/{name}_{i+1}.jpg",
            cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
        )

    final_enc = np.mean(encodings, axis=0)
    np.save(f"{folder}/{name}.npy", final_enc)

def verify_face_logic(image_data):
    try:
        # 1. Load the enrolled (authorized) face
        authorized_image = face_recognition.load_image_file("data/enrolled_user.jpg")
        authorized_encoding = face_recognition.face_encodings(authorized_image)[0]

        # 2. Decode the image sent from the browser
        header, encoded = image_data.split(",", 1)
        nparr = np.frombuffer(base64.b64decode(encoded), np.uint8)
        live_frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        # 3. Encode the live frame
        rgb_frame = cv2.cvtColor(live_frame, cv2.COLOR_BGR2RGB)
        live_encodings = face_recognition.face_encodings(rgb_frame)

        if len(live_encodings) > 0:
            # 4. Compare faces (TOLERANCE 0.6 is standard; 0.5 is stricter)
            results = face_recognition.compare_faces([authorized_encoding], live_encodings[0], tolerance=0.6)
            return results[0]
        return False
    except Exception as e:
        print(f"Error: {e}")
        return False

#get linux installed apps

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
                desktop_id = file  # filename is unique
                exec_cmd = config.get("Desktop Entry", "Exec", fallback=None)
                icon = config.get("Desktop Entry", "Icon", fallback="🖥️")
                category = config.get("Desktop Entry", "Categories", fallback="Other")
                category = category.split(";")[0]

                apps.append({
                     "id": desktop_id.replace(".desktop",""),  # unique, clean
                    "exec": exec_cmd,
                    "name": name,
                    "icon": "🖥️",
                    "category": category
                })
            except Exception:
                pass

    return apps



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
            user["pin"] = new_pin
            break

    with open("pin.json", "w") as f:
        json.dump(db, f, indent=2)

def load_pin(email=None):
    if not os.path.exists(PIN_FILE):
        return None

    data = json.load(open(PIN_FILE))

    # NEW STRUCTURE (users list)
    if "users" in data:
        if email:
            for user in data["users"]:
                if user.get("email") == email:
                    return user.get("pin")
        else:
            # fallback: return first user's pin
            return data["users"][0].get("pin") if data["users"] else None

    # OLD STRUCTURE (fallback)
    return data.get("pin")


def extract_desktop_icon(icon_name):
    """
    Find icon file from Linux icon themes.
    Return path to copied PNG in static/app_icons/.
    """

    if not icon_name:
        return "/static/app_icons/generic.png"

    target_dir = "static/app_icons"
    os.makedirs(target_dir, exist_ok=True)

    # Already cached?
    for ext in ["png", "svg", "xpm"]:
        cached = f"{target_dir}/{icon_name}.{ext}"
        if os.path.exists(cached):
            return f"/static/app_icons/{icon_name}.{ext}"

    # Search in system icon directories
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
        # return empty structure if file missing
        return {"users": []}

def save_accounts(accounts):
    with open("accounts.json", "w") as f:
        json.dump(accounts, f, indent=2)

def find_user(accounts, email):
    return next((u for u in accounts.get("users", []) if u.get("email") == email), None)

def email_exists(email):
    """Check if email exists in accounts.json"""
    try:
        with open("accounts.json", "r") as f:
            accounts = json.load(f)
        
        # Check if email exists in users list
        for user in accounts.get("users", []):
            if user.get("email", "").lower() == email.lower():
                return True
        
        # Also check config/email.txt for backward compatibility
        email_file = "config/email.txt"
        if os.path.exists(email_file):
            with open(email_file, "r") as f:
                saved_email = f.read().strip().lower()
                if saved_email == email.lower():
                    return True
        
        return False
        
    except FileNotFoundError:
        # Create accounts.json if it doesn't exist
        with open("accounts.json", "w") as f:
            json.dump({"users": []}, f)
        return False
    except Exception as e:
        print(f"Error checking email: {e}")
        return False


def get_stored_pin():
    try:
        with open('pin.json', 'r') as f:
            data = json.load(f)
            return str(data.get('pin'))
    except (FileNotFoundError, json.JSONDecodeError):
        return "1234"  # Fallback default if file is missing


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
    return jsonify({"exists": pin_exists()})
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

#####################
###########################
##################################
#########################################
################################################
######################################################3

@app.route("/logout")
def logout():
    try:
        session.clear()  # safely clear unlock status
    except:
        pass

    return redirect("/mobile")

@app.route("/create_pin")
def create_pin_page():
    if os.path.exists("pin.json"):
        with open("pin.json", "r") as f:
            data = json.load(f)
            if data.get("pin"):
                return redirect("/mobile")   # 🔒 block access

    return render_template("create_pin.html")

@app.route("/api/send_create_otp", methods=["POST"])
def send_create_otp():
    data = request.json
    email = data.get("email")

    # reuse your existing OTP logic
    return request_reset()


@app.route("/api/verify_create_otp", methods=["POST"])
def verify_create_otp():
    data = request.get_json() or {}

    email = data.get("email")
    code = data.get("code")

    db = load_users()

    if db.get("reset_code") != code:
        return jsonify({"message": "Invalid OTP"}), 400

    db["temp_email"] = email
    save_users(db)

    return jsonify({"message": "OTP verified"})

@app.route("/api/launch_app", methods=["POST"])
def launch_app():
    data = request.get_json() or {}
    appid = data.get("app")

    if not appid:
        return jsonify({"status": "error", "msg": "Missing app id"}), 400

    # Desktop file search paths
    desktop_dirs = [
        "/usr/share/applications",
        "/usr/local/share/applications",
        os.path.expanduser("~/.local/share/applications")
    ]

    desktop_file = None

    # Search .desktop file
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

    # Extract Exec command
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

    # 🚀 DETACHED launcher — avoids "suspended (tty input)"
    try:
        subprocess.Popen(
            shlex.split(exec_cmd),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            stdin=subprocess.DEVNULL,
            preexec_fn=os.setsid     # FULL DETACH
        )
        return jsonify({"status": "ok", "msg": f"Launched {appid}"})
    except Exception as e:
        return jsonify({"status": "error", "msg": str(e)}), 500


@app.route("/api/system_lock_app", methods=["POST"])
def system_lock_app():
    import os

    data = request.get_json()
    appid = data.get("app_id")
    name = data.get("app_name", appid)
    icon = data.get("icon", "")

    if not appid:
        return {"status": "error", "msg": "No app_id provided"}

    # Create directory
    target_dir = os.path.expanduser("~/.local/share/applications")
    os.makedirs(target_dir, exist_ok=True)

    # Final path
    target_file = os.path.join(target_dir, f"{appid}.lock.desktop")

    # Desktop file content
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

    data = request.get_json()
    appid = data.get("app_id")

    target_file = os.path.expanduser(f"~/.local/share/applications/{appid}.lock.desktop")

    if os.path.exists(target_file):
        os.remove(target_file)
        os.system("update-desktop-database ~/.local/share/applications")
        return {"status": "ok", "msg": f"{appid} unlocked system-wide"}

    return {"status": "ok", "msg": "No system lock file found"}


@app.route("/api/enroll_from_camera", methods=["POST"])
def api_enroll_from_camera():



    name = (request.form.get("name") or "").strip()
    pin = request.form.get("pin")
    images = request.form.getlist("images[]") or []
    single_img = request.form.get("image")

    if single_img and not images:
        images = [single_img]

    if pin != load_pin():
        return jsonify({"status": "error", "msg": "Invalid PIN"}), 400

    if not name:
        return jsonify({"status": "error", "msg": "Name required"}), 400

    if not images:
        return jsonify({"status": "error", "msg": "No images received"}), 400

    frames = []
    encodings = []

    for data_url in images:
        try:
            header, encoded = data_url.split(",", 1)
            img_bytes = base64.b64decode(encoded)
            img = Image.open(BytesIO(img_bytes)).convert("RGB")
            frame = np.array(img)

            dets = detector(frame, 1)
            if len(dets) == 0:
                continue

            shape = sp(frame, dets[0])
            descriptor = facerec.compute_face_descriptor(frame, shape)
            enc = np.array(descriptor)

            encodings.append(enc)
            frames.append(frame)

        except Exception as e:
            print("Enroll error:", e)

    if len(encodings) == 0:
        return jsonify({"status": "error", "msg": "No face detected"}), 400

    save_encoding_and_images(name, frames, encodings)

    return jsonify({
        "status": "ok",
        "msg": f"User '{name}' enrolled."
    })

@app.route("/mobile/dashboard")
def mobile_dashboard():
    # Only allow if unlocked
    if not session.get("unlocked"):
        return "Access denied", 403
    return render_template("mobile_dashboard.html")

@app.route("/api/list_apps")
def api_list_apps():
    apps = get_linux_apps()
    return jsonify({"status": "ok", "apps": apps})

@app.route("/api/create_pin", methods=["POST"])
def api_create_pin():
    data = request.get_json() or {}

    email = (data.get("email") or "").strip().lower()
    new_pin = data.get("pin")

    if not email or not new_pin:
        return jsonify({"msg": "Missing data"}), 400

    # 🔹 Load existing users
    if os.path.exists("pin.json"):
        with open("pin.json", "r") as f:
            db = json.load(f)
    else:
        db = {"users": []}

    # 🔹 Check duplicate email
    for user in db.get("users", []):
        if user.get("email") == email:
            return jsonify({
                "msg": "Email already exists"
            }), 400

    # ✅ Add new user
    db["users"].append({
        "email": email,
        "pin": new_pin
    })

    with open("pin.json", "w") as f:
        json.dump(db, f, indent=2)

    return jsonify({"msg": "PIN created successfully"})
@app.route("/api/send_otp", methods=["POST"])
def send_otp():
    # send email OTP
    return {"success": True}

@app.route("/api/verify_otp", methods=["POST"])
def verify_otp():
    # check OTP
    return {"success": True}

@app.route("/api/verify_pin", methods=["POST"])
def api_verify_pin():
    data = request.get_json()

    email = data.get("email", "").strip().lower()
    pin = data.get("pin")

    with open("pin.json", "r") as f:
        db = json.load(f)

    if email not in db.get("emails", []):
        return jsonify({"status": "error", "msg": "Email not registered"}), 400

    if db.get("pin") == pin:
        return jsonify({"status": "ok"})

    return jsonify({"status": "error", "msg": "Invalid PIN"}), 400
# ---------------------- EMAIL PASSWORD RESET ----------------------


reset_codes = {}   # email → code

import json



    

@app.route("/api/verify_reset_code", methods=["POST"])
def verify_reset_code():
    data = request.get_json() or {}
    code = (data.get("code") or "").strip()

    with open("pin.json", "r") as f:
        pin_data = json.load(f)

    if pin_data.get("reset_code") != code:
        return jsonify({"message": "Invalid code"}), 400

    return jsonify({"message": "Code verified"}), 200

@app.route("/api/set_new_pin", methods=["POST"])
def set_new_pin():
    data = request.get_json() or {}
    new_pin = data.get("new_pin")

    if not new_pin or len(new_pin) != 4:
        return jsonify({"status": "error", "msg": "Invalid PIN"}), 400

    try:
        with open("pin.json", "r") as f:
            db = json.load(f)
    except:
        return jsonify({"status": "error", "msg": "Database error"}), 500

    # ✅ UPDATE GLOBAL PIN
    db["pin"] = new_pin

    with open("pin.json", "w") as f:
        json.dump(db, f, indent=2)

    return jsonify({"status": "ok", "msg": "PIN updated"})
# ---------- Get PIN (single-user or by email) ----------
# WARNING: exposing PIN over GET is insecure; we provide it for local-only usage.


@app.route("/api/get_pin")
def get_pin():
    with open("pin.json", "r") as f:
        pin_data = json.load(f)
    return jsonify({"pin": pin_data.get("pin")})


@app.route("/api/reset_main_pin", methods=["POST"])
def api_reset_main_pin():
    data = request.get_json()
    new_pin = data.get("pin")

    if not new_pin:
        return jsonify({"status": "error", "msg": "PIN required"}), 400

    save_pin(new_pin)
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
    
    # allowed keys: pin (bool), face (bool)
    pin = payload.get("pin")
    face = payload.get("face")

    # normalize booleans (could be "true"/"false" from forms)
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

    # Linux .desktop files
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


@app.route("/api/unlock_from_camera", methods=["POST"])
def api_unlock_from_camera():


    data_url = request.form.get("image")
    if not data_url:
        return jsonify({"status": "error", "msg": "No image"}), 400

    try:
        header, encoded = data_url.split(",", 1)
        img = Image.open(BytesIO(base64.b64decode(encoded))).convert("RGB")
        frame = np.array(img)
    except:
        return jsonify({"status": "error", "msg": "Bad image"}), 400

    dets = detector(frame, 1)
    if len(dets) == 0:
        return jsonify({"status": "error", "msg": "No face"}), 400

    shape = sp(frame, dets[0])
    encoding = np.array(facerec.compute_face_descriptor(frame, shape))

    best_match = None
    best_dist = 0.6

    if os.path.exists("known_faces"):
        for person in os.listdir("known_faces"):
            enc_path = f"known_faces/{person}/{person}.npy"
            if not os.path.exists(enc_path):
                continue

            known_enc = np.load(enc_path)
            dist = np.linalg.norm(known_enc - encoding)

            if dist < best_dist:
                best_dist = dist
                best_match = person

    if best_match:
        return jsonify({"status": "ok", "user": best_match})

    return jsonify({"status": "error", "msg": "Unknown face"}), 400


@app.route("/api/set_apps", methods=["POST"])
def api_set_apps():
    user = request.form.get("user")
    raw = request.form.getlist("apps[]")

    if not user:
        return jsonify({"status": "error", "msg": "Missing user"}), 400

    # decode JSON objects
    apps = [json.loads(a) for a in raw]

    db = load_apps()
    db[user] = apps
    save_apps(db)

    return jsonify({"status": "ok", "msg": "Apps saved"})

# 2. Get locked apps for a user
@app.route("/api/get_apps/<user>")
def api_get_apps(user):
    db = load_apps()
    return jsonify({
        "status": "ok",
        "apps": db.get(user, [])
    })

# 3. Face unlock for opening an app
@app.route("/api/open_app_face", methods=["POST"])
def api_open_app_face():
    appname = request.form.get("appname")
    data_url = request.form.get("image")

    # Reuse unlock logic
    resp = api_unlock_from_camera()
    if resp[1] != 200:
        return resp

    user = resp[0].json["user"]

    # Check app permission
    db = load_apps()
    user_apps = db.get(user, [])

    if appname not in user_apps:
        return jsonify({"status": "error", "msg": "App not assigned to this user"}), 403

    return jsonify({"status": "ok", "user": user})

# 4. Password fallback
@app.route("/api/open_app_password", methods=["POST"])
def api_open_app_password():
    password = request.form.get("password")
    appname = request.form.get("appname")

    email = request.form.get("email")

    if password == load_pin(email):
        return jsonify({"status": "ok"})
        return jsonify({"status": "ok"})


    return jsonify({"status": "error", "msg": "Wrong password"})

# check old Security PIN
@app.route("/api/check_old_pin", methods=["POST"])
def api_check_old_pin():
    old_pin = request.form.get("old_pin", "").strip()

    if not old_pin:
        return jsonify({"status": "error", "msg": "Enter old PIN"})

    try:
        with open("pin.json", "r") as f:
            db = json.load(f)
    except:
        return jsonify({"status": "error", "msg": "Database error"})

    # ✅ check global PIN
    if old_pin == db.get("pin"):
        return jsonify({"status": "ok", "msg": "Old PIN verified"})
    else:
        return jsonify({"status": "error", "msg": "Incorrect old PIN"})

# ------------------------------
#  CHANGE SECURITY PIN
# ------------------------------
@app.route("/api/change_pin", methods=["POST"])
def api_change_pin():
    old_pin = request.form.get("old_pin")
    new_pin = request.form.get("new_pin")

    pin_file = "config/pin.txt"
    os.makedirs("config", exist_ok=True)

    # Create pin.txt if missing
    with open(pin_file, "w") as f:
        f.write(load_pin() or "0000")


    with open(pin_file, "r") as f:
        stored_pin = f.read().strip()

    if old_pin != stored_pin:
        return jsonify({"status": "error", "msg": "Old PIN incorrect"}), 400

    if len(new_pin) < 4:
        return jsonify({"status": "error", "msg": "PIN must be at least 4 digits"}), 400

    with open(pin_file, "w") as f:
        f.write(new_pin)

    return jsonify({"status": "ok", "msg": "PIN updated successfully!"})

#reset Security PIN
@app.route("/api/reset_pin", methods=["POST"])
def api_reset_pin():
    new_pin = request.form.get("pin", "").strip()

    if not new_pin or len(new_pin) != 4:
        return jsonify({"status": "error", "msg": "PIN must be 4 digits"}), 400

    try:
        with open("pin.json", "r") as f:
            db = json.load(f)
    except:
        return jsonify({"status": "error", "msg": "Database missing"}), 500

    # ✅ update global PIN
    db["pin"] = new_pin

    with open("pin.json", "w") as f:
        json.dump(db, f, indent=2)

    return jsonify({"status": "ok", "msg": "PIN updated successfully"})

# reset Security PIN - send reset code via emailreset_tokens = {}   # email → {code, expires}
@app.route("/api/send_reset_email", methods=["POST"])
def api_send_reset_email():
    email = request.form.get("email")

    if not email:
        return jsonify({"status":"error","msg":"Email required"}), 400

    # generate OTP
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

# verify and change Security PIN WITH EMAIL CODE
@app.route("/api/verify_email_code", methods=["POST"])
def api_verify_email_code():
    email = request.form.get("email")
    code = request.form.get("code")

    if not email or not code:
        return jsonify({"status":"error","msg":"Missing data"}), 400

    if email not in reset_tokens:
        return jsonify({"status":"error","msg":"No reset request found"}), 400

    entry = reset_tokens[email]

    # expiration
    if time.time() > entry["expires"]:
        del reset_tokens[email]
        return jsonify({"status":"error","msg":"Code expired"}), 400

    # match code
    if code != entry["code"]:
        return jsonify({"status":"error","msg":"Invalid code"}), 400

    # success → allow PIN reset
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


@app.route("/api/list_users")
def list_users():
    base = "known_faces"
    if not os.path.exists(base):
        return jsonify({"status": "ok", "users": []})

    users = []
    for name in os.listdir(base):
        if os.path.isdir(os.path.join(base, name)):
            users.append(name)

    return jsonify({"status": "ok", "users": users})


@app.route("/api/get_all_users")
def api_get_all_users():
    base = "known_faces"
    if not os.path.exists(base):
        return jsonify({"users": []})

    users = []
    for name in os.listdir(base):
        if os.path.isdir(os.path.join(base, name)):
            users.append(name)

    return jsonify({"users": users})



@app.route("/api/delete_user", methods=["POST"])
def api_delete_user():
    user = request.form.get("user")

    if not user:
        return jsonify({"status": "error", "msg": "Missing user"}), 400

    folder = os.path.join("known_faces", user)

    if not os.path.exists(folder):
        return jsonify({"status": "error", "msg": "User does not exist"}), 404

    # delete all images + encoding
    for f in os.listdir(folder):
        os.remove(os.path.join(folder, f))

    os.rmdir(folder)

    return jsonify({"status": "ok", "msg": f"User '{user}' deleted"})




@app.route("/api/register_email", methods=["POST"])
def register_email():
    email = request.form.get("email", "").strip().lower()

    if not email:
        return jsonify({"status": "error", "msg": "Email required"}), 400

    try:
        with open("pin.json", "r") as f:
            db = json.load(f)
    except:
        db = {}

    # ensure structure
    if "emails" not in db:
        db["emails"] = []

    if "pin" not in db:
        db["pin"] = "1234"

    # add email if not exists
    if email not in db["emails"]:
        db["emails"].append(email)

    with open("pin.json", "w") as f:
        json.dump(db, f, indent=2)

    return jsonify({"status": "ok", "msg": "Email registered"})

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

@app.route("/api/get_saved_email")
def get_saved_email():
    try:
        with open("pin.json", "r") as f:
            db = json.load(f)

        return jsonify({
            "status": "ok",
            "emails": db.get("emails", [])
        })

    except Exception as e:
        return jsonify({"status": "error", "msg": str(e)})

@app.route("/api/delete_saved_email", methods=["POST"])
def delete_saved_email():
    data = request.get_json()
    email = data.get("email")

    if not email:
        return jsonify({"status": "error", "msg": "Email required"}), 400

    try:
        with open("accounts.json", "r") as f:
            accounts = json.load(f)

        accounts["users"] = [
            u for u in accounts.get("users", [])
            if u.get("email") != email
        ]

        with open("accounts.json", "w") as f:
            json.dump(accounts, f, indent=2)

        return jsonify({"status": "ok", "msg": "Email deleted"})

    except Exception as e:
        return jsonify({"status": "error", "msg": str(e)}), 500



# Path to the authorized user's face image (enrolled during setup)
ENROLLED_FACE_PATH = "data/enrolled_user.jpg"

@app.route('/api/verify-face', methods=['POST'])
def verify_face():

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

# Add this to your Python backend
# In a real app, '1234' would be retrieved from your database
STORED_PIN = "1234" 
@app.route('/api/verify-pin', methods=['POST'])
def verify_pin():
    data = request.json
    email = data.get("email", "").strip().lower()
    user_input_pin = str(data.get('pin'))

    with open("pin.json", "r") as f:
        db = json.load(f)

    for user in db.get("users", []):
        if user.get("email") == email and user.get("pin") == user_input_pin:
            return jsonify({"status": "success"})

    return jsonify({"status": "fail", "message": "Incorrect PIN"})
 
@app.route("/api/request_reset", methods=["POST"])
def request_reset():
    data = request.get_json() or {}

    email = (data.get("email") or "").strip().lower()
    mode = data.get("mode", "reset")

    # -----------------------------
    # LOAD DATA
    # -----------------------------
    if not os.path.exists("pin.json"):
        return jsonify({"message": "No users found"}), 400

    with open("pin.json", "r") as f:
        pin_data = json.load(f)

    users = pin_data.get("users", [])
    # Check in pin.json
    user = next((u for u in users if u.get("email") == email), None)

    # If not found, check accounts.json
    if not user:
        try:
            with open("accounts.json", "r") as f:
                accounts = json.load(f)
        except:
            accounts = {"users": []}

        if "users" not in accounts:
            accounts["users"] = []

        user = next((u for u in accounts["users"] if u.get("email") == email), None)

    # Final validation
    if not user:
        return jsonify({"message": "Email not registered"}), 400
    # -----------------------------
    # VALIDATION
    # -----------------------------
    if mode == "reset":
        if not user:
            return jsonify({"message": "Email not registered"}), 400

    elif mode == "create":
        if user:
            return jsonify({"message": "Email already has PIN"}), 400

    # -----------------------------
    # GENERATE OTP
    # -----------------------------
    otp = "{:06d}".format(random.randint(0, 999999))

    pin_data["reset_code"] = otp
    pin_data["temp_email"] = email

    # -----------------------------
    # SAVE
    # -----------------------------
    with open("pin.json", "w") as f:
        json.dump(pin_data, f, indent=2)

    # -----------------------------
    # SEND EMAIL
    # -----------------------------
    msg = Message(
        subject="CyberLock OTP Code",
        recipients=[email],
        sender=app.config['MAIL_DEFAULT_SENDER']
    )
    msg.body = f"Your OTP is: {otp}"
    mail.send(msg)

    return jsonify({"message": "OTP sent!"}), 200

@app.route("/api/verify-face-js", methods=["POST"])
def verify_face_js():
    data = request.json
    incoming = np.array(data.get("descriptor"))

    db = load_faces()

    for name, desc_list in db.items():
        for d in desc_list:
            known = np.array(d)

            dist = np.linalg.norm(known - incoming)

            if dist < 0.5:  # threshold
                return jsonify({"status": "success", "user": name})

    return jsonify({"status": "fail"})
    
@app.route("/api/save-face", methods=["POST"])
def save_face():
    data = request.json

    name = data.get("name")
    descriptors = data.get("descriptors")

    db = load_faces()
    db[name] = descriptors

    save_faces(db)

    return jsonify({"status": "ok", "msg": "Face saved!"})
# HTTPS SERVER
# ------------------------------
if __name__ == "__main__":
    import os

    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    port = int(os.environ.get("PORT", 5000))

    ssl_context = (
        os.path.join(BASE_DIR, "cert/10.190.1.186.pem"),
        os.path.join(BASE_DIR, "cert/10.190.1.186-key.pem")
    )

    print("🔐 HTTPS running at: https://10.190.1.186:5000/mobile")

    app.run(host="0.0.0.0", port=5000, debug=True, ssl_context=ssl_context)
