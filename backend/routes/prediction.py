
# ==========================================
# ISYARATKU - PREDICTION API
# Flask + OpenCV + MediaPipe + MobileNetV2
# ==========================================

import threading
import time

import cv2
import numpy as np

from flask import Blueprint, jsonify, request, current_app
from services import inference
from services.hand_detection import HandDetector


prediction_bp = Blueprint("prediction", __name__)

# Detector dipakai kembali untuk seluruh request.
hand_detector = None
detector_lock = threading.Lock()

# Satu inferensi CNN pada satu waktu.
inference_lock = threading.Lock()


def get_detector():
    global hand_detector

    if hand_detector is None:
        hand_detector = HandDetector()

    return hand_detector


def build_response(status, message, **fields):
    """
    Struktur respons yang sama untuk semua status.

    status:
        success       : huruf berhasil diprediksi
        no_hand       : tidak ada tangan, CNN tidak dijalankan
        no_prediction : tangan ada, tetapi preprocessing gagal
        error         : request tidak valid / kesalahan internal
    """

    response = {
        "status": status,
        "message": message,
        "detected": False,
        "letter": None,
        "confidence": None,
        "top_k": [],
        "hands": [],
        "error_code": None,
        "detection_ms": None,
        "inference_ms": None,
        "processing_ms": None
    }

    response.update(fields)

    return response


def error_response(message, status_code=400, error_code="invalid_request"):
    return jsonify(
        build_response(
            "error",
            message,
            error_code=error_code
        )
    ), status_code


def elapsed_ms(start):
    return round((time.perf_counter() - start) * 1000, 2)


@prediction_bp.route("/api/predict", methods=["POST"])
def predict():

    # Waktu pemrosesan mulai dari fungsi endpoint.
    request_start = time.perf_counter()

    # ======================================
    # 1. VALIDASI FRAME
    # ======================================

    if "frame" not in request.files:
        return error_response(
            "Frame tidak ditemukan dalam request."
        )

    uploaded_frame = request.files["frame"]

    if not uploaded_frame.filename:
        return error_response(
            "Nama file frame tidak tersedia."
        )

    image_bytes = uploaded_frame.read()

    if not image_bytes:
        return error_response(
            "Frame yang dikirim kosong."
        )

    # ======================================
    # 2. DECODE GAMBAR
    # ======================================

    try:
        image_array = np.frombuffer(
            image_bytes,
            dtype=np.uint8
        )

        frame = cv2.imdecode(
            image_array,
            cv2.IMREAD_COLOR
        )

        if frame is None:
            return error_response(
                "Gambar tidak valid atau tidak bisa dibaca."
            )

    except (ValueError, cv2.error):
        return error_response(
            "Gagal membaca frame webcam."
        )

    # ======================================
    # 3. DETEKSI MEDIAPIPE
    # ======================================

    try:
        with detector_lock:

            detector = get_detector()

            # Waktu inferensi detektor saja.
            detection_start = time.perf_counter()

            _, results = detector.detect(frame)

            detection_ms = elapsed_ms(detection_start)

            # Ubah landmark menjadi format JSON.
            hands = detector.get_landmarks(results)

    except Exception:
        current_app.logger.exception(
            "Kesalahan saat deteksi MediaPipe."
        )

        return error_response(
            "Terjadi kesalahan internal saat mendeteksi tangan.",
            500,
            "detection_failed"
        )

    # ======================================
    # 4. TANPA TANGAN: CNN TIDAK DIJALANKAN
    # ======================================

    if not hands:
        return jsonify(
            build_response(
                "no_hand",
                "Tidak ada tangan terdeteksi. "
                "Posisikan tangan di depan kamera.",
                detection_ms=detection_ms,
                processing_ms=elapsed_ms(request_start)
            )
        ), 200

    # ======================================
    # 5. KLASIFIKASI MOBILENETV2
    # ======================================

    try:
        with inference_lock:
            result = inference.predict(frame, hands)

    except inference.InferenceError as error:

        # Bukan kesalahan server: frame berikutnya
        # tetap diproses seperti biasa.
        return jsonify(
            build_response(
                "no_prediction",
                str(error),
                detected=True,
                hands=hands,
                error_code=error.code,
                detection_ms=detection_ms,
                processing_ms=elapsed_ms(request_start)
            )
        ), 200

    except Exception:
        current_app.logger.exception(
            "Kesalahan saat inferensi MobileNetV2."
        )

        return error_response(
            "Terjadi kesalahan internal saat memprediksi huruf.",
            500,
            "inference_failed"
        )

    # ======================================
    # 6. KIRIM RESPONS
    # ======================================

    return jsonify(
        build_response(
            "success",
            f"Huruf {result['letter']} terdeteksi.",
            detected=True,
            letter=result["letter"],
            confidence=result["confidence"],
            top_k=result["top_k"],
            hands=hands,
            detection_ms=detection_ms,
            inference_ms=result["inference_ms"],
            processing_ms=elapsed_ms(request_start),
            crop_box=result["crop_box"],
            padded_outside_frame=result["padded_outside_frame"],
            hand_outside_frame=result["hand_outside_frame"]
        )
    ), 200
