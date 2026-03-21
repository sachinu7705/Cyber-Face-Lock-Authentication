#!/bin/bash

echo "🚀 Setting up Face Lock Authentication Project..."

# Create virtual environment (optional)
echo "📦 Creating virtual environment..."
python3 -m venv venv
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip

# Install dependencies
echo "📥 Installing dependencies..."
pip install -r requirements.txt

# Create models directory
mkdir -p models
cd models

echo "📥 Downloading dlib models..."

# Download models
wget http://dlib.net/files/dlib_face_recognition_resnet_model_v1.dat.bz2
wget http://dlib.net/files/shape_predictor_68_face_landmarks.dat.bz2

# Extract models
bzip2 -d *.bz2

cd ..

echo "✅ Setup Complete!"
echo "▶️ Run the app using:"
echo "source venv/bin/activate && python web_app.py"