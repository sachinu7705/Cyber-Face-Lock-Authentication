import psutil
import os
import time

LOCKED_APPS = set()

def lock_app(app_name):
    LOCKED_APPS.add(app_name)

def unlock_app(app_name):
    LOCKED_APPS.discard(app_name)

def watcher_loop():
    while True:
        for proc in psutil.process_iter(["pid", "name"]):
            if proc.info["name"] in LOCKED_APPS:
                try:
                    proc.kill()
                except:
                    pass
        time.sleep(1)
