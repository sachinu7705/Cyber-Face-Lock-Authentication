#!/bin/bash

case "$1" in
    start)
        echo "Starting CyberLock..."
        cd /home/sachin/Videos/face-lock-project
        source venv/bin/activate
        nohup gunicorn -w 4 -b 0.0.0.0:5000 web_app:app > app.log 2>&1 &
        echo "CyberLock started on https://10.190.1.186:5000/mobile"
        ;;
    stop)
        echo "Stopping CyberLock..."
        pkill -f gunicorn
        echo "CyberLock stopped"
        ;;
    restart)
        $0 stop
        sleep 2
        $0 start
        ;;
    status)
        if pgrep -f gunicorn > /dev/null; then
            echo "CyberLock is running"
            ps aux | grep gunicorn | grep -v grep
        else
            echo "CyberLock is not running"
        fi
        ;;
    logs)
        tail -f app.log
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|logs}"
        exit 1
        ;;
esac
