import os

print("📦 Installing dependencies...")
os.system("pip install -r requirements.txt")

print("📥 Setting up models...")
from utils.model_downloader import ensure_models
ensure_models()

print("✅ Setup complete! Run: python run.py")