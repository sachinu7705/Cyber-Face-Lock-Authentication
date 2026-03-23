#!/bin/bash
cd /home/sachin/Videos/face-lock-project
source venv/bin/activate

# Kill any existing gunicorn processes
pkill -f gunicorn

# Wait a moment
sleep 2

# Start new instance
nohup gunicorn -w 4 -b 0.0.0.0:5000 web_app:app > app.log 2>&1 &

echo "CyberLock started on https://10.190.1.186:5000/mobile"

