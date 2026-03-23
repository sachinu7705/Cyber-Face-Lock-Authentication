#!/bin/bash
cd /home/sachin/Videos/face-lock-project
source venv/bin/activate
export DEBUG=False
echo "Starting CyberLock with Gunicorn..."
gunicorn -w 4 -b 0.0.0.0:5000 web_app:app

