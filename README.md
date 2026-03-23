# 🔐 CyberLock - Face Recognition Authentication System

A modern **Face Recognition Authentication System** built with Python, Flask, OpenCV, and dlib — replacing traditional passwords with secure biometric authentication.

---

## ✨ Features

* 🔓 Face Recognition Unlock (Passwordless login)
* 📸 Real-time Face Detection & Recognition
* 🔐 Secure Web Interface (HTTPS support)
* 👥 Multi-user support (separate face data)
* 🔑 4-digit PIN backup authentication
* 📧 Email OTP verification system
* 📱 Mobile-friendly cyberpunk UI
* 🚀 App launcher for installed apps
* 🔒 Lock & protect sensitive applications

---

## 📦 Tech Stack

**Backend**

* Python 3.10+
* Flask

**Face Recognition**

* OpenCV
* dlib
* face_recognition

**Frontend**

* HTML5, CSS3, JavaScript

**Security**

* bcrypt hashing
* OTP email verification

**Database**

* JSON-based storage

**Deployment**

* Gunicorn, Nginx, Docker

---

## 📋 Requirements

* Python 3.10+
* Webcam
* Minimum 4GB RAM
* 500MB free disk space
* OS: Linux / Windows / macOS

---

## 🚀 Installation

### ⚡ Quick Install (Linux/Kali)

```bash
curl -sSL https://raw.githubusercontent.com/sachinu7705/Cyber-Face-Lock-Authentication/main/install.sh | bash
```

---

### 🛠️ Manual Installation

#### 1️⃣ Clone Repository

```bash
git clone https://github.com/sachinu7705/Cyber-Face-Lock-Authentication.git
cd Cyber-Face-Lock-Authentication
```

#### 2️⃣ Setup Virtual Environment

```bash
python3 -m venv venv
```

Activate:

* Linux/macOS:

```bash
source venv/bin/activate
```

* Windows:

```bash
venv\Scripts\activate
```

---

#### 3️⃣ Install Dependencies

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

---

#### 4️⃣ Run Application

```bash
python web_app.py
```

---

## 🌐 Access the App

* Local:

```
http://127.0.0.1:5000/mobile
```

* Network:

```
http://<your-ip>:5000/mobile
```

Find IP:

```bash
hostname -I
```

---

## 📱 First-Time Setup

### 1. Create Account

* Visit: `/create_pin`
* Enter username & email
* Verify OTP
* Set 4-digit PIN

### 2. Enroll Face

* Visit: `/mobile/enroll`
* Enter username + PIN
* Capture face from multiple angles

### 3. Unlock System

* Visit: `/mobile/unlock`
* Use face recognition or PIN

---

## 🔧 Useful Commands

### Start App

```bash
source venv/bin/activate
python web_app.py
```

### Run in Background

```bash
nohup python web_app.py > app.log 2>&1 &
```

### View Logs

```bash
tail -f app.log
```

### Stop App

```
Ctrl + C
```

---

## 🐛 Troubleshooting

### Camera Not Working

* Check webcam connection
* Allow browser permissions
* Close other apps using camera

### Face Not Recognized

* Improve lighting
* Center face properly
* Re-enroll with multiple angles

### Email Not Sending

* Check spam folder
* Verify Gmail app password
* Check `.env` config

### Port Already in Use

```bash
sudo lsof -i :5000
sudo kill -9 <PID>
```

### Module Errors

```bash
pip install -r requirements.txt
```

---

## 📁 Project Structure

```
Cyber-Face-Lock-Authentication/
│── web_app.py
│── requirements.txt
│── install.sh
│── start_cyberlock.sh
│── .env
│── pin.json
│── known_faces/
│── static/
│── templates/
│── models/
```

---

## 🔒 Security Features

* ✅ bcrypt PIN hashing
* ✅ Encrypted face data
* ✅ Duplicate face prevention
* ✅ OTP email verification
* ✅ Rate limiting protection
* ✅ Secure session handling

---

## 🚀 Deployment

### Local Network

```bash
python web_app.py
```

### Gunicorn

```bash
gunicorn -w 4 -b 0.0.0.0:5000 web_app:app
```

### Docker

```bash
docker build -t cyberlock .
docker run -p 5000:5000 --device /dev/video0 cyberlock
```

---

## 📦 Build Executable

### Linux/macOS

```bash
pip install pyinstaller
pyinstaller --onefile web_app.py
```

### Windows

```bash
pyinstaller --onefile --windowed web_app.py
```

---

## 🔧 Environment Variables

Create `.env` file:

```
SECRET_KEY=your-secret-key
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-app-password
DEBUG=False
```

---

## ⚠️ Important Notes

* First run may download face models
* Webcam required for recognition
* Use HTTPS in production
* Backup `pin.json` and `known_faces/`

---

## 🔮 Future Enhancements

* 📱 Mobile App
* ☁️ Cloud Sync
* 🧠 Liveness Detection
* 🔐 Multi-factor Authentication
* 🎤 Voice Authentication

---

## 👨‍💻 Author

**Sachin**
GitHub: https://github.com/sachinu7705

---

## 🤝 Contributing

```bash
Fork → Clone → Create Branch → Commit → Push → Pull Request
```

---

## ⭐ Support

If you like this project:

* ⭐ Star the repo
* 🍴 Fork it
* 📢 Share it

---

## 📜 License

MIT License

---

## 🙏 Acknowledgments

* OpenCV
* dlib
* Flask community

---

> Your face is your password — make it secure 🔐
