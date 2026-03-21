import face_recognition
import cv2
import numpy as np
import pickle
from pathlib import Path
from config import KNOWN_FACES_DIR, ENCODINGS_FILE, CAPTURE_COUNT, CAPTURE_DELAY, TOLERANCE
import time, os

KNOWN_FACES_DIR.mkdir(parents=True, exist_ok=True)

def save_encodings(enc_dict):
    serial = {k: [e.tolist() for e in v] for k, v in enc_dict.items()}
    with open(ENCODINGS_FILE, 'wb') as f:
        pickle.dump(serial, f)

def load_encodings():
    if not ENCODINGS_FILE.exists():
        return {}
    with open(ENCODINGS_FILE, 'rb') as f:
        serial = pickle.load(f)
    return {k: [np.array(e) for e in v] for k, v in serial.items()}

def build_flat(enc_dict):
    flat_encs, flat_names = [], []
    for name, encs in enc_dict.items():
        for e in encs:
            flat_encs.append(e)
            flat_names.append(name)
    return flat_encs, flat_names

def enroll_from_camera(cam, name, count=CAPTURE_COUNT, delay=CAPTURE_DELAY):
    """Capture `count` frames from cam (cv2.VideoCapture) and return their encodings list."""
    person_dir = KNOWN_FACES_DIR / name
    person_dir.mkdir(parents=True, exist_ok=True)
    saved = []
    encs = []
    # ensure cam is open
    if not cam.isOpened():
        cam.open(0)
    for i in range(count):
        ret, frame = cam.read()
        if not ret:
            continue
        ts = int(time.time())
        fname = person_dir / f"{name}_{ts}_{i}.jpg"
        cv2.imwrite(str(fname), frame)
        saved.append(str(fname))
        # detect encoding right away
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        e = face_recognition.face_encodings(rgb)
        if e:
            encs.append(e[0])
        time.sleep(delay)
    return encs

def recognize_on_frame(frame, flat_encs, flat_names, tolerance=TOLERANCE):
    """Return matched name or None, and distance if matched."""
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    locs = face_recognition.face_locations(rgb, model='hog')
    encs = face_recognition.face_encodings(rgb, locs)
    if not encs:
        return None, None
    # choose first face
    enc = encs[0]
    if not flat_encs:
        return None, None
    distances = face_recognition.face_distance(flat_encs, enc)
    best_idx = int(np.argmin(distances))
    if distances[best_idx] <= tolerance:
        return flat_names[best_idx], float(distances[best_idx])
    return None, float(np.min(distances))

# -------------- Web API Helpers (Required by web_app.py) --------------

def enroll_face(name):
    """
    Simple wrapper for web_app.py
    """
    return enroll_from_camera(name)


def identify_face(image, flat_encs=None, flat_names=None):
    """
    Identify a face in an uploaded frame (Flask web version)
    """
    if flat_encs is None or flat_names is None:
        enc_dict = load_encodings()
        flat_encs, flat_names = build_flat(enc_dict)

    rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    locs = face_recognition.face_locations(rgb)
    encs = face_recognition.face_encodings(rgb, locs)

    if not encs:
        return None

    matches = face_recognition.compare_faces(flat_encs, encs[0], TOLERANCE)
    if True in matches:
        return flat_names[matches.index(True)]

    return None
