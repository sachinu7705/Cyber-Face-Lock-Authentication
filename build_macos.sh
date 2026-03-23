#!/bin/bash
# Build CyberLock for macOS

echo "Building CyberLock for macOS..."

# Create app bundle structure
mkdir -p CyberLock.app/Contents/{MacOS,Resources}

# Copy Python script
cp web_app.py CyberLock.app/Contents/MacOS/
cp -r templates CyberLock.app/Contents/MacOS/
cp -r static CyberLock.app/Contents/MacOS/
cp -r models CyberLock.app/Contents/MacOS/

# Create Info.plist
cat > CyberLock.app/Contents/Info.plist << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>CyberLock</string>
    <key>CFBundleIdentifier</key>
    <string>com.cyberlock.app</string>
    <key>CFBundleName</key>
    <string>CyberLock</string>
    <key>CFBundleVersion</key>
    <string>1.0</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
</dict>
</plist>
EOF

# Create launcher script
cat > CyberLock.app/Contents/MacOS/CyberLock << 'EOF'
#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"
python3 web_app.py
EOF

chmod +x CyberLock.app/Contents/MacOS/CyberLock

echo "✅ macOS app created: CyberLock.app"