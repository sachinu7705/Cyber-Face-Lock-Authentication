#!/bin/bash
# Create release packages

VERSION="1.0.0"
RELEASE_DIR="releases/cyberlock-$VERSION"

echo "📦 Creating release packages for CyberLock $VERSION"

# Create release directory
mkdir -p "$RELEASE_DIR"

# Copy files
cp -r web_app.py templates static models requirements.txt "$RELEASE_DIR/"
cp install.sh README_INSTALL.md "$RELEASE_DIR/"

# Create zip
cd releases
zip -r "cyberlock-$VERSION-linux.zip" "cyberlock-$VERSION"

# Create tarball
tar -czf "cyberlock-$VERSION-linux.tar.gz" "cyberlock-$VERSION"

echo "✅ Release packages created:"
echo "  - cyberlock-$VERSION-linux.zip"
echo "  - cyberlock-$VERSION-linux.tar.gz"