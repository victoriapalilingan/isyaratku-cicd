
# ==========================================
# ISYARATKU - INFERENCE SERVICE
# MobileNetV2 Alfabet BISINDO A-Z
# ==========================================

import os
import threading
import time

import cv2
import numpy as np
import tensorflow as tf
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input


# ======================================
# 1. KONFIGURASI
# ======================================

PROJECT_ROOT = os.path.abspath(
    os.path.join(
        os.path.dirname(__file__),
        "..",
        ".."
    )
)

MODEL_PATH = os.path.join(
    PROJECT_ROOT,
    "model",
    "isyaratku_final_model.keras"
)

# Ukuran input model (tinggi, lebar).
IMG_SIZE = (224, 224)

# Urutan kelas mengikuti sorted() nama folder
# pada notebook final: indeks 0-25 = A-Z.
CLASS_NAMES = tuple("ABCDEFGHIJKLMNOPQRSTUVWXYZ")

# Padding di setiap sisi, relatif terhadap sisi
# terpanjang kotak tangan. Nilai awal, perlu
# dikalibrasi melalui pengujian webcam.
CROP_PADDING = 0.25

# Crop lebih kecil dari ini dianggap tidak layak.
MIN_CROP_SIZE = 32

# Cara mengisi area crop di luar frame.
BORDER_MODE = cv2.BORDER_REPLICATE


class InferenceError(ValueError):
    """
    Kesalahan input atau preprocessing.
    Atribut code dipakai endpoint untuk
    menentukan pesan respons.
    """

    def __init__(self, code, message):
        super().__init__(message)
        self.code = code


# ======================================
# 2. MEMUAT MODEL (SEKALI)
# ======================================

_model = None
_model_lock = threading.Lock()

# Pemanggilan model dalam mode graph (tf.function).
# Mode eager menjalankan operasi satu per satu
# sehingga jauh lebih lambat; output identik.
_predict_fn = None


def load_model():
    """
    Memuat model sekali, lalu memakai
    instance yang sama untuk request berikutnya.
    """

    global _model, _predict_fn

    if _model is not None:
        return _model

    with _model_lock:

        if _model is None:

            if not os.path.isfile(MODEL_PATH):
                raise FileNotFoundError(
                    f"Model CNN tidak ditemukan: {MODEL_PATH}"
                )

            model = tf.keras.models.load_model(MODEL_PATH)

            expected_input = (None, IMG_SIZE[0], IMG_SIZE[1], 3)
            expected_output = (None, len(CLASS_NAMES))

            if tuple(model.input_shape) != expected_input:
                raise RuntimeError(
                    f"Input model {model.input_shape}, "
                    f"seharusnya {expected_input}."
                )

            if tuple(model.output_shape) != expected_output:
                raise RuntimeError(
                    f"Output model {model.output_shape}, "
                    f"seharusnya {expected_output}."
                )

            # Signature tetap: satu kali tracing,
            # tidak di-trace ulang per request.
            _predict_fn = tf.function(
                lambda batch: model(batch, training=False),
                input_signature=[
                    tf.TensorSpec(
                        shape=(1, IMG_SIZE[0], IMG_SIZE[1], 3),
                        dtype=tf.float32
                    )
                ]
            )

            _model = model

            print("Model MobileNetV2 IsyaratKu berhasil dimuat.")

    return _model


def get_predict_fn():
    """
    Fungsi graph yang dipakai bersama
    oleh warm_up() dan predict().
    """

    load_model()

    return _predict_fn


def warm_up():
    """
    Satu inferensi awal agar request pertama
    tidak menanggung waktu inisialisasi graph.

    Melewati jalur preprocessing yang sama dengan
    predict(). Hasilnya dibuang, tidak pernah
    dikirim sebagai prediksi pengguna.
    """

    predict_fn = get_predict_fn()

    dummy_crop = np.zeros((256, 256, 3), dtype=np.uint8)

    batch = preprocess_crop(dummy_crop)

    # Tracing graph terjadi di sini.
    predict_fn(batch)


# ======================================
# 3. CROPPING BERDASARKAN LANDMARK
# ======================================

def _point_xy(point):
    """
    Menerima landmark dalam bentuk dict
    {"x", "y"} (keluaran get_landmarks)
    atau objek MediaPipe dengan atribut x, y.
    """

    if isinstance(point, dict):
        x, y = point.get("x"), point.get("y")
    else:
        x, y = getattr(point, "x", None), getattr(point, "y", None)

    try:
        x, y = float(x), float(y)
    except (TypeError, ValueError):
        raise InferenceError(
            "invalid_landmarks",
            "Koordinat landmark tidak valid."
        )

    if not (np.isfinite(x) and np.isfinite(y)):
        raise InferenceError(
            "invalid_landmarks",
            "Koordinat landmark tidak valid."
        )

    return x, y


def compute_crop_box(hands, frame_width, frame_height,
                     padding=CROP_PADDING):
    """
    Menghitung kotak crop persegi yang mencakup
    gabungan semua tangan.

    Input:
        hands:
            List tangan, masing-masing list landmark
            dengan koordinat ternormalisasi 0-1.

    Output:
        ((x1, y1, x2, y2), hand_outside)
        Koordinat piksel boleh berada di luar frame;
        bagian tersebut diisi saat crop_hands().
    """

    if not hands:
        raise InferenceError(
            "no_hands",
            "Tidak ada landmark tangan."
        )

    xs = []
    ys = []

    for hand in hands:

        if not hand:
            raise InferenceError(
                "invalid_landmarks",
                "Data landmark tangan kosong."
            )

        for point in hand:
            x, y = _point_xy(point)
            xs.append(x * frame_width)
            ys.append(y * frame_height)

    # Kotak gabungan semua tangan
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)

    center_x = (min_x + max_x) / 2
    center_y = (min_y + max_y) / 2

    # Persegi dari sisi terpanjang + padding
    side = max(max_x - min_x, max_y - min_y)
    side = side * (1 + 2 * padding)

    if side < MIN_CROP_SIZE:
        raise InferenceError(
            "crop_too_small",
            "Area tangan terlalu kecil. Dekatkan tangan ke kamera."
        )

    # Sisi dibulatkan sekali agar crop tetap persegi
    side_px = int(round(side))

    x1 = int(round(center_x - side_px / 2))
    y1 = int(round(center_y - side_px / 2))
    x2 = x1 + side_px
    y2 = y1 + side_px

    # True jika ada landmark di luar frame,
    # artinya sebagian tangan tidak terekam kamera.
    hand_outside = (
        min_x < 0 or min_y < 0
        or max_x > frame_width or max_y > frame_height
    )

    return (x1, y1, x2, y2), hand_outside


def crop_hands(frame_bgr, hands, padding=CROP_PADDING):
    """
    Memotong area tangan berbentuk persegi.

    Jika kotak melewati batas frame, frame diperluas
    dengan BORDER_MODE sehingga crop tetap persegi
    dan tangan tidak terpotong.

    Output:
        crop_bgr, info
    """

    _validate_frame(frame_bgr)

    height, width = frame_bgr.shape[:2]

    (x1, y1, x2, y2), hand_outside = compute_crop_box(
        hands,
        width,
        height,
        padding
    )

    pad_left = max(0, -x1)
    pad_top = max(0, -y1)
    pad_right = max(0, x2 - width)
    pad_bottom = max(0, y2 - height)

    padded = any((pad_left, pad_top, pad_right, pad_bottom))

    if padded:
        frame_bgr = cv2.copyMakeBorder(
            frame_bgr,
            pad_top,
            pad_bottom,
            pad_left,
            pad_right,
            BORDER_MODE
        )

    crop = frame_bgr[
        y1 + pad_top:y2 + pad_top,
        x1 + pad_left:x2 + pad_left
    ]

    if crop.size == 0 or crop.shape[0] != crop.shape[1]:
        raise InferenceError(
            "empty_crop",
            "Hasil crop tangan tidak valid."
        )

    info = {
        "crop_box": [x1, y1, x2, y2],
        "crop_size": int(crop.shape[0]),
        # True jika sebagian crop diisi di luar frame
        "padded_outside_frame": bool(padded),
        # True jika sebagian tangan di luar frame
        "hand_outside_frame": bool(hand_outside)
    }

    return crop, info


# ======================================
# 4. PREPROCESSING
# ======================================

def _validate_frame(frame_bgr):

    if not isinstance(frame_bgr, np.ndarray):
        raise InferenceError(
            "invalid_frame",
            "Frame harus berupa array NumPy."
        )

    if (
        frame_bgr.ndim != 3
        or frame_bgr.shape[2] != 3
        or frame_bgr.size == 0
    ):
        raise InferenceError(
            "invalid_frame",
            "Frame harus berformat BGR (tinggi, lebar, 3)."
        )

    if frame_bgr.dtype != np.uint8:
        raise InferenceError(
            "invalid_frame",
            "Frame harus bertipe uint8."
        )


def preprocess_crop(crop_bgr):
    """
    Sama dengan preprocessing evaluasi notebook final:
    RGB -> resize 224x224 (bilinear) -> float32
    -> mobilenet_v2.preprocess_input [-1, 1].
    Tanpa augmentasi.

    Output:
        Array (1, 224, 224, 3) float32.
    """

    _validate_frame(crop_bgr)

    # BGR (OpenCV) -> RGB
    rgb = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2RGB)

    # Resize memakai tf.image.resize seperti notebook
    resized = tf.image.resize(rgb, IMG_SIZE).numpy()

    image = resized.astype(np.float32)
    image = preprocess_input(image)

    return image[np.newaxis, ...]


# ======================================
# 5. PREDIKSI
# ======================================

def predict(frame_bgr, hands, top_k=3):
    """
    Memprediksi huruf BISINDO dari frame dan landmark.

    Input:
        frame_bgr:
            Frame OpenCV (BGR, uint8).
        hands:
            Keluaran HandDetector.get_landmarks().

    Output:
        {
            "letter": "A",
            "confidence": 0.93,
            "class_index": 0,
            "top_k": [{"letter": ..., "confidence": ...}],
            "inference_ms": ...,
            "crop_box": [x1, y1, x2, y2],
            "crop_size": ...,
            "padded_outside_frame": False,
            "hand_outside_frame": False
        }

    InferenceError dilempar jika input atau
    preprocessing gagal; tidak ada prediksi.
    """

    crop, info = crop_hands(frame_bgr, hands)

    batch = preprocess_crop(crop)

    predict_fn = get_predict_fn()

    # Waktu inferensi model saja
    inference_start = time.perf_counter()

    probabilities = predict_fn(batch).numpy()[0]

    inference_ms = (
        time.perf_counter() - inference_start
    ) * 1000

    order = np.argsort(probabilities)[::-1]
    best = int(order[0])

    return {
        "letter": CLASS_NAMES[best],
        "confidence": float(probabilities[best]),
        "class_index": best,
        "top_k": [
            {
                "letter": CLASS_NAMES[int(index)],
                "confidence": float(probabilities[index])
            }
            for index in order[:top_k]
        ],
        "inference_ms": round(inference_ms, 2),
        **info
    }
