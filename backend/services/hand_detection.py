
# ==========================================
# ISYARATKU - HAND DETECTION SERVICE
# MediaPipe Hand Landmarker
# ==========================================

import os
import cv2
import mediapipe as mp


class HandDetector:

    def __init__(self):

        # ==================================
        # 1. LOKASI MODEL
        # ==================================

        project_root = os.path.abspath(
            os.path.join(
                os.path.dirname(__file__),
                "..",
                ".."
            )
        )

        model_path = os.path.join(
            project_root,
            "model",
            "hand_landmarker",
            "hand_landmarker.task"
        )

        if not os.path.isfile(model_path):
            raise FileNotFoundError(
                f"Model MediaPipe tidak ditemukan: {model_path}"
            )

        # ==================================
        # 2. KONFIGURASI MEDIAPIPE
        # ==================================

        base_options = mp.tasks.BaseOptions(
            model_asset_path=model_path
        )

        options = mp.tasks.vision.HandLandmarkerOptions(
            base_options=base_options,
            running_mode=mp.tasks.vision.RunningMode.IMAGE,
            num_hands=2,
            min_hand_detection_confidence=0.5,
            min_hand_presence_confidence=0.5,
            min_tracking_confidence=0.5
        )

        # Membuat detector
        self.hand_landmarker = (
            mp.tasks.vision.HandLandmarker.create_from_options(
                options
            )
        )

        # Hubungan antara 21 titik tangan
        self.connections = [
            (0, 1), (1, 2), (2, 3), (3, 4),
            (0, 5), (5, 6), (6, 7), (7, 8),
            (5, 9), (9, 10), (10, 11), (11, 12),
            (9, 13), (13, 14), (14, 15), (15, 16),
            (13, 17), (17, 18), (18, 19), (19, 20),
            (0, 17)
        ]

        print("MediaPipe Hand Landmarker berhasil dimuat.")

    # ======================================
    # 3. DETEKSI TANGAN
    # ======================================

    def detect(self, frame):
        """
        Input:
            Frame OpenCV dalam format BGR.

        Output:
            annotated_frame:
                Frame dengan landmark tangan.

            results:
                Hasil deteksi MediaPipe.
        """

        if frame is None or frame.size == 0:
            raise ValueError("Frame tidak valid.")

        # BGR -> RGB
        rgb_frame = cv2.cvtColor(
            frame,
            cv2.COLOR_BGR2RGB
        )

        # MediaPipe membutuhkan data RGB
        # yang tersimpan secara kontigu.
        rgb_frame = rgb_frame.copy()

        mp_image = mp.Image(
            image_format=mp.ImageFormat.SRGB,
            data=rgb_frame
        )

        # Deteksi menggunakan MediaPipe
        results = self.hand_landmarker.detect(mp_image)

        # Salinan agar gambar input asli
        # tidak dimodifikasi.
        annotated_frame = frame.copy()

        height, width = annotated_frame.shape[:2]

        # Gambar landmark pada salinan frame
        for hand_landmarks in results.hand_landmarks:

            points = []

            for landmark in hand_landmarks:

                x = int(landmark.x * width)
                y = int(landmark.y * height)

                points.append((x, y))

            # Menggambar garis tangan
            for start, end in self.connections:

                cv2.line(
                    annotated_frame,
                    points[start],
                    points[end],
                    (0, 255, 0),
                    2
                )

            # Menggambar 21 titik tangan
            for x, y in points:

                cv2.circle(
                    annotated_frame,
                    (x, y),
                    4,
                    (0, 255, 0),
                    -1
                )

        return annotated_frame, results

    # ======================================
    # 4. LANDMARK UNTUK FRONTEND
    # ======================================

    def get_landmarks(self, results):
        """
        Mengubah hasil MediaPipe menjadi
        koordinat JSON untuk frontend.

        Format:
        [
            [
                {"x": ..., "y": ..., "z": ...},
                ... 21 titik
            ]
        ]
        """

        hands = []

        if not results.hand_landmarks:
            return hands

        for hand_landmarks in results.hand_landmarks:

            points = []

            for landmark in hand_landmarks:

                points.append({
                    "x": float(landmark.x),
                    "y": float(landmark.y),
                    "z": float(landmark.z)
                })

            hands.append(points)

        return hands

    # ======================================
    # 5. CLOSE DETECTOR
    # ======================================

    def close(self):
        """
        Menutup MediaPipe Hand Landmarker.
        """

        self.hand_landmarker.close()
