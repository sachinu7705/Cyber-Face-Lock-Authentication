import os
import urllib.request
import bz2

MODELS = {
    "dlib_face_recognition_resnet_model_v1.dat": "http://dlib.net/files/dlib_face_recognition_resnet_model_v1.dat.bz2",
    "shape_predictor_68_face_landmarks.dat": "http://dlib.net/files/shape_predictor_68_face_landmarks.dat.bz2"
}

MODELS_DIR = "models"


def download_and_extract(url, output_path):
    compressed_path = output_path + ".bz2"

    print(f"⬇️ Downloading {os.path.basename(output_path)}...")
    urllib.request.urlretrieve(url, compressed_path)

    print("📦 Extracting...")
    with bz2.BZ2File(compressed_path) as fr, open(output_path, "wb") as fw:
        fw.write(fr.read())

    os.remove(compressed_path)
    print(f"✅ Saved: {output_path}")


def ensure_models():
    os.makedirs(MODELS_DIR, exist_ok=True)

    for filename, url in MODELS.items():
        file_path = os.path.join(MODELS_DIR, filename)

        if not os.path.exists(file_path):
            download_and_extract(url, file_path)
        else:
            print(f"✔ {filename} already exists")