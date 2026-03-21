from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

KNOWN_FACES_DIR = BASE_DIR / "known_faces"
ENCODINGS_FILE = BASE_DIR / "encodings.pkl"
DB_FILE = BASE_DIR / "face_lock.db"
LOGS_DIR = BASE_DIR / "logs"

CAPTURE_COUNT = 5
CAPTURE_DELAY = 0.5
TOLERANCE = 0.5

ADMIN_PIN = "0909"
DEFAULT_PIN = ADMIN_PIN
