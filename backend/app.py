import sys
import time

import numpy as np
from flask import Flask, jsonify
from flask_cors import CORS

from routes import prediction
from routes.prediction import prediction_bp, get_detector
from services import inference

app = Flask(__name__)

# Mengizinkan frontend berkomunikasi dengan backend
CORS(app)

# Mendaftarkan route prediction
app.register_blueprint(prediction_bp)


@app.route("/")
def home():
    return jsonify({
        "status": "success",
        "message": "ISYARATKU Backend berjalan"
    })


@app.route("/api/health")
def health_check():
    return jsonify({
        "status": "success",
        "message": "Backend ISYARATKU aktif"
    })


def _elapsed_ms(start):
    return round((time.perf_counter() - start) * 1000, 2)


def initialize_services():
    """
    Menyiapkan MediaPipe dan model CNN sebelum
    server menerima request. Error tidak ditangkap
    di sini agar startup gagal secara jelas.

    Output:
        Waktu tiap tahap inisialisasi (ms).
    """

    timings = {}

    # 1. MediaPipe Hand Landmarker
    start = time.perf_counter()
    detector = get_detector()
    timings["mediapipe_init_ms"] = _elapsed_ms(start)

    # Satu deteksi pada frame kosong; hasilnya dibuang.
    start = time.perf_counter()
    detector.detect(np.zeros((480, 640, 3), dtype=np.uint8))
    timings["mediapipe_warmup_ms"] = _elapsed_ms(start)

    # 2. Model CNN, dimuat sekali
    start = time.perf_counter()
    inference.load_model()
    timings["cnn_load_ms"] = _elapsed_ms(start)

    # 3. Warm-up CNN; hasilnya dibuang.
    start = time.perf_counter()
    inference.warm_up()
    timings["cnn_warmup_ms"] = _elapsed_ms(start)

    return timings


def close_services():
    """
    Menutup MediaPipe. Dipanggil sebelum interpreter
    berhenti, karena executor internal MediaPipe sudah
    mati saat callback atexit dijalankan.
    """

    if prediction.hand_detector is not None:
        prediction.hand_detector.close()
        prediction.hand_detector = None


if __name__ == "__main__":

    try:
        startup_timings = initialize_services()
    except Exception as error:
        close_services()
        print(
            f"Backend IsyaratKu gagal dijalankan: {error}",
            file=sys.stderr
        )
        sys.exit(1)

    print("Layanan siap:", startup_timings)

    try:
        app.run(
            host="127.0.0.1",
            port=5000,
            debug=False,
            # Reloader memuat aplikasi dua kali (model ikut dimuat ulang)
            use_reloader=False
        )
    finally:
        close_services()