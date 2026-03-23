#!/bin/bash
# CyberLock Installation Script

echo "🔐 CyberLock Installation Script"
echo "================================"
echo ""

# Check Python version
python_version=$(python3 --version 2>&1 | grep -Po '(?<=Python )\d+\.\d+')
if [[ $(echo "$python_version >= 3.10" | bc) -ne 1 ]]; then
    echo "❌ Python 3.10 or higher is required. You have Python $python_version"
    exit 1
fi
echo "✅ Python $python_version detected"

# Create installation directory
INSTALL_DIR="$HOME/.cyberlock"
echo "📁 Installing to: $INSTALL_DIR"

# Create directory
mkdir -p "$INSTALL_DIR"
cp -r . "$INSTALL_DIR/"

cd "$INSTALL_DIR" || exit

# Create virtual environment
echo "🐍 Creating virtual environment..."
python3 -m venv venv
source venv/bin/activate

# Install dependencies
echo "📦 Installing dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# Create necessary directories
mkdir -p known_faces models static/app_icons config

# Generate SSL certificates (optional)
echo "🔐 Generating SSL certificates..."
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/CN=localhost" 2>/dev/null

# Create desktop entry
echo "🖥️ Creating desktop shortcut..."
cat > ~/.local/share/applications/cyberlock.desktop << EOF
[Desktop Entry]
Name=CyberLock
Comment=Face Recognition Security System
Exec=$INSTALL_DIR/venv/bin/python $INSTALL_DIR/start.py
Icon=$INSTALL_DIR/static/icon.png
Terminal=false
Type=Application
Categories=Security;Utility;
EOF

# Create start script
cat > "$INSTALL_DIR/start.py" << 'EOF'
#!/usr/bin/env python3
import os
import sys
import webbrowser
import threading
import time

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import and run the app
from web_app import app

def open_browser():
    time.sleep(2)
    webbrowser.open("http://127.0.0.1:5000/mobile")

if __name__ == "__main__":
    print("🚀 Starting CyberLock...")
    print("📱 Opening browser in a few seconds...")
    threading.Thread(target=open_browser).start()
    app.run(host="127.0.0.1", port=5000, debug=False)
EOF

chmod +x "$INSTALL_DIR/start.py"

echo ""
echo "✅ Installation complete!"
echo ""
echo "To start CyberLock:"
echo "  $INSTALL_DIR/venv/bin/python $INSTALL_DIR/start.py"
echo ""
echo "Or click the CyberLock icon in your applications menu."
echo ""