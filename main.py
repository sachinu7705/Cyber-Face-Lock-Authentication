#!/usr/bin/env python3
import sys, os, time, csv, datetime
from PyQt6.QtWidgets import (QApplication, QWidget, QVBoxLayout, QHBoxLayout,
                             QLabel, QPushButton, QLineEdit, QListWidget,
                             QSystemTrayIcon, QMenu, QInputDialog, QMessageBox)
from PyQt6.QtGui import QPixmap, QImage, QIcon
from PyQt6.QtCore import QTimer
import cv2, psutil, face_recognition, numpy as np

from face_utils import load_encodings, save_encodings, build_flat, enroll_from_camera, recognize_on_frame
from db import add_user, remove_user, list_users, log_unlock, query_today
from config import ADMIN_PIN, KNOWN_FACES_DIR, LOGS_DIR, CAPTURE_COUNT, CAPTURE_DELAY

# ensure folders
KNOWN_FACES_DIR.mkdir(parents=True, exist_ok=True)
LOGS_DIR.mkdir(parents=True, exist_ok=True)

class FaceLockApp(QWidget):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Face App Lock - Kali")
        self.setGeometry(120, 100, 1000, 720)
        self.layout = QVBoxLayout()
        self.setLayout(self.layout)

        # top row: enrollment + controls
        top = QHBoxLayout()
        self.name_input = QLineEdit(); self.name_input.setPlaceholderText("Name for enrollment")
        self.pin_input = QLineEdit(); self.pin_input.setPlaceholderText("Admin PIN (0909)")
        self.enroll_btn = QPushButton("Enroll (Camera)")
        self.enroll_btn.clicked.connect(self.handle_enroll)
        top.addWidget(self.name_input); top.addWidget(self.pin_input); top.addWidget(self.enroll_btn)
        self.layout.addLayout(top)

        # middle: camera preview + app list
        mid = QHBoxLayout()

        # camera preview
        self.camera_label = QLabel("Camera preview")
        mid.addWidget(self.camera_label, 2)

        # app lock list & controls
        right = QVBoxLayout()
        self.app_list = QListWidget()
        right.addWidget(QLabel("Locked apps (process names)"))
        right.addWidget(self.app_list)
        appadd_row = QHBoxLayout()
        self.add_app_input = QLineEdit(); self.add_app_input.setPlaceholderText("process name")
        self.add_app_btn = QPushButton("Add"); self.add_app_btn.clicked.connect(self.add_app)
        self.remove_app_btn = QPushButton("Remove"); self.remove_app_btn.clicked.connect(self.remove_app)
        appadd_row.addWidget(self.add_app_input); appadd_row.addWidget(self.add_app_btn); appadd_row.addWidget(self.remove_app_btn)
        right.addLayout(appadd_row)
        # quick test buttons
        self.test_block_btn = QPushButton("Simulate Block (Test)"); self.test_block_btn.clicked.connect(self.simulate_block)
        right.addWidget(self.test_block_btn)
        mid.addLayout(right, 1)

        self.layout.addLayout(mid)

        # bottom: logs / actions
        bottom = QHBoxLayout()
        self.export_btn = QPushButton("Export today's CSV"); self.export_btn.clicked.connect(self.export_csv)
        self.refresh_users_btn = QPushButton("Refresh Users"); self.refresh_users_btn.clicked.connect(self.refresh_users)
        self.remove_user_btn = QPushButton("Remove Selected User"); self.remove_user_btn.clicked.connect(self.remove_selected_user)
        bottom.addWidget(self.export_btn); bottom.addWidget(self.refresh_users_btn); bottom.addWidget(self.remove_user_btn)
        self.layout.addLayout(bottom)

        # system tray
        icon_path = str(KNOWN_FACES_DIR / "icon.png")
        # fallback icon if none
        self.tray_icon = QSystemTrayIcon(QIcon(), parent=self)
        tray_menu = QMenu()
        tray_menu.addAction("Open Dashboard", self.show)
        tray_menu.addAction("Quit", QApplication.instance().quit)
        self.tray_icon.setContextMenu(tray_menu)
        self.tray_icon.show()

        # load faces
        self.known_faces = load_encodings()
        self.flat_encs, self.flat_names = build_flat(self.known_faces)

        # camera capture
        self.cap = cv2.VideoCapture(0)
        self.cam_timer = QTimer(); self.cam_timer.timeout.connect(self.update_camera); self.cam_timer.start(30)

        # process monitor timer
        self.locked_apps = []  # list of process names to watch
        self.proc_timer = QTimer(); self.proc_timer.timeout.connect(self.check_locked_apps); self.proc_timer.start(2000)

        # ensure DB users visible
        self.refresh_users()

    # ---------- UI helpers ----------
    def show_message(self, text):
        QMessageBox.information(self, "Face App Lock", text)

    def refresh_users(self):
        self.users = list_users()
        # (name, created_at)
        # no visual list for users here — left for admin expansions

    def remove_selected_user(self):
        rows = self.users
        if not rows:
            self.show_message("No users to remove")
            return
        # ask which to remove
        names = [r[0] for r in rows]
        name, ok = QInputDialog.getItem(self, "Remove user", "Select user to remove:", names, 0, False)
        if ok and name:
            remove_user(name)
            self.known_faces = load_encodings()
            self.flat_encs, self.flat_names = build_flat(self.known_faces)
            self.show_message(f"Removed {name}")

    # ---------- Camera / Enrollment ----------
    def update_camera(self):
        ret, frame = self.cap.read()
        if not ret:
            return
        # show preview
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        h, w, ch = rgb.shape
        qt_img = QImage(rgb.data, w, h, ch * w, QImage.Format.Format_RGB888)
        self.camera_label.setPixmap(QPixmap.fromImage(qt_img))

    def handle_enroll(self):
        name = self.name_input.text().strip()
        pin = self.pin_input.text().strip()
        if not name:
            self.show_message("Enter a name for enrollment")
            return
        if pin != ADMIN_PIN:
            self.show_message("Invalid admin PIN")
            return
        # capture encodings
        cam = cv2.VideoCapture(0)
        encs = enroll_from_camera(cam, name, CAPTURE_COUNT, CAPTURE_DELAY)
        cam.release()
        if encs:
            self.known_faces[name] = encs
            save_encodings(self.known_faces)
            add_user(name)
            self.flat_encs, self.flat_names = build_flat(self.known_faces)
            self.show_message(f"Enrolled {name} ({len(encs)} snapshots)")
            self.name_input.clear()
            self.pin_input.clear()
        else:
            self.show_message("No face detected — try again with different lighting")

    # ---------- App lock list ----------
    def add_app(self):
        appname = self.add_app_input.text().strip()
        if not appname:
            return
        if appname in self.locked_apps:
            self.show_message("Already added")
            return
        self.locked_apps.append(appname)
        self.app_list.addItem(appname)
        self.add_app_input.clear()

    def remove_app(self):
        row = self.app_list.currentRow()
        if row >= 0:
            app = self.app_list.takeItem(row).text()
            if app in self.locked_apps:
                self.locked_apps.remove(app)

    # ---------- Simulate/Export ----------
    def simulate_block(self):
        # simple test: pretend "gedit" started
        test_name = self.locked_apps[0] if self.locked_apps else "gedit"
        self.show_message(f"Simulating detection of {test_name}")
        # call check on that app specifically
        self._block_process_by_name(test_name)

    def export_csv(self):
        today = datetime.date.today().strftime("%Y-%m-%d")
        rows = query_today()
        os.makedirs(str(LOGS_DIR), exist_ok=True)
        with open(str(LOGS_DIR / f"{today}.csv"), "w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["Name", "Unlocks Today"])
            writer.writerows(rows)
        self.show_message(f"Exported logs to logs/{today}.csv")

    # ---------- Process blocking ----------
    def check_locked_apps(self):
        try:
            running = {p.pid: p.name() for p in psutil.process_iter(attrs=['name'])}
        except Exception:
            return
        # if any locked app appears, enforce
        for pid, name in list(running.items()):
            if name in self.locked_apps:
                # verify current face
                authorized, who = self.check_face_once()
                if authorized:
                    log_unlock(who, "Face", name)
                    # allowed; continue
                else:
                    # ask for PIN prompt in GUI thread
                    self._block_process_by_pid(pid, name)

    def _block_process_by_pid(self, pid, name):
        try:
            p = psutil.Process(pid)
            # prompt for PIN (synchronously on GUI)
            pin, ok = QInputDialog.getText(self, "PIN Required", f"Enter admin PIN to allow {name}:",)
            if ok and pin == ADMIN_PIN:
                log_unlock("Admin", "PIN", name)
                return
            # else terminate
            p.terminate()
            log_unlock("Blocked", "AutoKill", name)
            self.tray_icon.showMessage("App blocked", f"{name} was blocked until authentication", msecs=3000)
        except Exception as e:
            print("Block error", e)

    def _block_process_by_name(self, name):
        for p in psutil.process_iter():
            try:
                if p.name() == name:
                    self._block_process_by_pid(p.pid, name)
            except Exception:
                pass

    # ---------- Face detection for one frame ----------
    def check_face_once(self):
        ret, frame = self.cap.read()
        if not ret:
            return False, None
        who, dist = recognize_on_frame(frame, self.flat_encs, self.flat_names)
        if who:
            return True, who
        return False, None

# ------------- Run -------------
if __name__ == "__main__":
    app = QApplication(sys.argv)
    win = FaceLockApp()
    # Start hidden to tray (uncomment if you prefer hidden start)
    # win.hide()
    win.show()
    sys.exit(app.exec())
