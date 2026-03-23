# 🔐 Face Lock Authentication System

> A modern **Face Recognition Authentication System** built with Python, Flask, OpenCV, and dlib — replacing traditional passwords with secure biometric access.

---

## ✨ Highlights

* 🔓 Passwordless Authentication (Face Unlock)
* 📸 Real-time Face Detection & Recognition
* 🔐 Secure Web Interface (HTTPS Supported)
* 👤 User Enrollment System
* 🔑 PIN Backup Authentication
* 🌐 Mobile-Friendly UI

---

## 📦 Tech Stack

* Python 3
* Flask
* OpenCV
* dlib
* face_recognition

---

## 🚀 Quick Start (Best Method)

### 1️⃣ Clone Repository

```bash
git clone https://github.com/sachinu7705/Face-Lock-Authentication.git
cd Face-Lock-Authentication
```

---

### 2️⃣ Setup Virtual Environment

```bash
python3 -m venv venv
```

Activate:

**Linux / Kali**

```bash
source venv/bin/activate
```

**Windows**

```bash
venv\Scripts\activate
```

---

### 3️⃣ Install Dependencies

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

---

### 4️⃣ Setup Models (Auto Download)

```bash
python setup.py
```

✔ Installs dependencies
✔ Downloads required AI models

---

## ▶️ Run the Application

### Recommended

```bash
python run.py
```

---

### Alternative

```bash
python web_app.py
```

---

## 🌐 Access the Application

Open in browser:

```
https://localhost:5000/mobile
```

Or:

```
https://<your-ip>:5000/mobile
```

---

## ⚡ One-Command Setup (Linux / Kali)

```bash
chmod +x setup.sh
./setup.sh
```

---

## 🧹 Reset / Fix Installation

If something breaks:

```bash
rm -rf venv
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

---

## 📁 Project Structure

```
Face-Lock-Authentication/
│── web_app.py          # Main Flask app
│── run.py              # Quick start runner
│── setup.py            # Auto setup script
│── setup.sh            # Linux setup script
│── requirements.txt    # Dependencies
│── models/             # Face recognition models
│── static/             # CSS/JS
│── templates/          # HTML files
│── face_lock.db        # Database
```

---

## ⚠️ Important Notes

* First run may take time (model download)
* Webcam is required
* Use HTTPS for secure access

---

## 🚫 .gitignore (Recommended)

```
venv/
models/
__pycache__/
*.dat
*.pkl
*.db
```

---

## 🔮 Future Enhancements

* 📱 Mobile App Integration
* ☁️ Cloud Authentication
* 🧠 Liveness Detection (Anti-spoofing)
* 🔐 Multi-Factor Authentication

---

## 👨‍💻 Author

**Sachin**

---

## ⭐ Support

If you like this project:

⭐ Star the repository
🍴 Fork it
📢 Share with others

---

## 📜 License

This project is open-source and available under the MIT License.

---
# Cyber-Face-Lock-Authentication
# Cyber-Face-Lock-Authentication
