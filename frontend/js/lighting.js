
/* =========================================
   ISYARATKU - LIGHTING
   Deteksi pencahayaan webcam
   ========================================= */

(() => {
    "use strict";

    // Batas kecerahan 0-255
    // Nilai awal, perlu dikalibrasi saat pengujian
    const LIGHTING_THRESHOLDS = {
        dark: 60,
        bright: 200
    };

    const LIGHTING_MESSAGES = {
        gelap: "Pencahayaan terlalu redup. Cari tempat yang lebih terang.",
        normal: "Pencahayaan baik.",
        terang: "Pencahayaan terlalu terang. Kurangi cahaya langsung ke kamera."
    };

    const SAMPLE_WIDTH = 64;
    const SAMPLE_HEIGHT = 48;
    const HISTORY_SIZE = 5;

    let lightingStatus = null;
    let lightingCanvas = null;
    let lightingContext = null;
    let lightingHistory = [];

    // =====================================
    // TAMPILKAN STATUS DI HALAMAN
    // =====================================

    function setLightingStatus(status) {
        const statusElement =
            document.getElementById("lighting-status");

        if (statusElement) {
            statusElement.textContent =
                LIGHTING_MESSAGES[status] || "";

            statusElement.dataset.status = status;
        }

        if (status !== lightingStatus) {
            lightingStatus = status;
            console.log("Status pencahayaan:", status);
        }
    }

    // =====================================
    // MENGUKUR KECERAHAN WEBCAM
    // =====================================

    function measureBrightness(videoElement) {
        if (
            !videoElement ||
            videoElement.readyState < 2 ||
            videoElement.videoWidth === 0 ||
            videoElement.videoHeight === 0
        ) {
            return null;
        }

        if (!lightingCanvas) {
            lightingCanvas = document.createElement("canvas");
            lightingCanvas.width = SAMPLE_WIDTH;
            lightingCanvas.height = SAMPLE_HEIGHT;

            lightingContext = lightingCanvas.getContext(
                "2d",
                { willReadFrequently: true }
            );
        }

        if (!lightingContext) {
            return null;
        }

        lightingContext.drawImage(
            videoElement,
            0,
            0,
            SAMPLE_WIDTH,
            SAMPLE_HEIGHT
        );

        const pixels = lightingContext.getImageData(
            0,
            0,
            SAMPLE_WIDTH,
            SAMPLE_HEIGHT
        ).data;

        let total = 0;
        const pixelCount = pixels.length / 4;

        for (let i = 0; i < pixels.length; i += 4) {
            const red = pixels[i];
            const green = pixels[i + 1];
            const blue = pixels[i + 2];

            total +=
                0.2126 * red +
                0.7152 * green +
                0.0722 * blue;
        }

        return total / pixelCount;
    }

    // =====================================
    // KLASIFIKASI PENCAHAYAAN
    // =====================================

    function classifyBrightness(brightness) {
        if (brightness < LIGHTING_THRESHOLDS.dark) {
            return "gelap";
        }

        if (brightness > LIGHTING_THRESHOLDS.bright) {
            return "terang";
        }

        return "normal";
    }

    // =====================================
    // UPDATE PENCAHAYAAN
    // =====================================

    function updateLighting(videoElement) {
        const brightness = measureBrightness(videoElement);

        if (brightness === null) {
            return null;
        }

        lightingHistory.push(brightness);

        if (lightingHistory.length > HISTORY_SIZE) {
            lightingHistory.shift();
        }

        const smoothed =
            lightingHistory.reduce(
                (total, value) => total + value,
                0
            ) / lightingHistory.length;

        const status = classifyBrightness(smoothed);

        setLightingStatus(status);

        return smoothed;
    }

    // =====================================
    // RESET PENCAHAYAAN
    // =====================================

    function resetLighting() {
        lightingStatus = null;
        lightingHistory = [];

        const statusElement =
            document.getElementById("lighting-status");

        if (statusElement) {
            statusElement.textContent = "";
            delete statusElement.dataset.status;
        }
    }

    // =====================================
    // AKSES DARI WEBCAM.JS
    // =====================================

    window.updateLighting = updateLighting;
    window.resetLighting = resetLighting;
    window.getLightingStatus = () => lightingStatus;

    console.log("IsyaratKu Lighting siap.");
})();
