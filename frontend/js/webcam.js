
/* =========================================
   ISYARATKU - WEBCAM
   Camera + MediaPipe + Lighting + Performance
   ========================================= */

(() => {
    "use strict";

    const API_URL = "http://127.0.0.1:5000/api/predict";

    const SEND_MAX_WIDTH = 640;
    const JPEG_QUALITY = 0.7;
    const RETRY_DELAY_MS = 1500;
    const REQUEST_TIMEOUT_MS = 8000;

    // Rentang penghitungan FPS dalam milidetik.
    const FPS_WINDOW_MS = 1000;

    const byId = id => document.getElementById(id);

    // =====================================
    // ELEMEN HALAMAN
    // =====================================

    const video = byId("webcam");
    const overlay = byId("overlay");
    const cameraContainer = byId("camera-container");
    const cameraButton = byId("start-camera");

    const cameraStatus = byId("cameraStatus");
    const aiStatus = byId("aiStatus");

    const cameraError = byId("cameraError");
    const lightingElement = byId("lighting-status");

    // Elemen metrik performa.
    const metricDetection = byId("metricDetection");
    const metricProcessing = byId("metricProcessing");
    const metricRequest = byId("metricRequest");
    const metricFps = byId("metricFps");

    // =====================================
    // CANVAS
    // =====================================

    const captureCanvas = document.createElement("canvas");
    const captureContext = captureCanvas.getContext("2d");

    const HAND_CONNECTIONS = [
        [0, 1], [1, 2], [2, 3], [3, 4],
        [0, 5], [5, 6], [6, 7], [7, 8],
        [5, 9], [9, 10], [10, 11], [11, 12],
        [9, 13], [13, 14], [14, 15], [15, 16],
        [13, 17], [17, 18], [18, 19], [19, 20],
        [0, 17]
    ];

    // =====================================
    // STATE
    // =====================================

    let stream = null;
    let running = false;
    let starting = false;
    let sessionId = 0;

    let lightingTimer = null;
    let activeRequest = null;
    let backendAvailable = false;

    // Perhitungan FPS klasifikasi (respons success).
    let fpsWindowStart = 0;
    let fpsFrameCount = 0;

    const sleep = ms =>
        new Promise(resolve => setTimeout(resolve, ms));

    // =====================================
    // LATENCY END-TO-END
    // Sejak frame diambil dari webcam sampai hasil
    // tampil pada antarmuka. Callback requestAnimationFrame
    // berjalan tepat sebelum browser menggambar ulang
    // halaman, sehingga dipakai sebagai waktu tampil.
    // Tidak di-await agar loop prediksi tidak tertunda.
    // =====================================

    // Jika halaman tidak sedang digambar (jendela diminimalkan
    // atau tertutup), requestAnimationFrame tidak dipanggil.
    // Frame tetap dicatat, tetapi ditandai paintMeasured=false
    // dan tidak dipakai untuk statistik latency.
    const PAINT_FALLBACK_MS = 250;

    function reportFrame(timing, result, stable) {
        const test = window.IsyaratTest;

        if (!test || typeof test.onFrame !== "function") {
            return;
        }

        let reported = false;

        const report = paintMeasured => {
            if (reported) return;
            reported = true;

            const displayedAt = performance.now();

            test.onFrame({
                paintMeasured,
                // Waktu frame diambil (performance.now), agar mode
                // uji dapat menolak frame dari fase persiapan.
                capturedAt: timing.frameStart,
                status: result.status,
                letter: result.letter || null,
                confidence:
                    typeof result.confidence === "number"
                        ? result.confidence
                        : null,
                hands: Array.isArray(result.hands)
                    ? result.hands.length
                    : 0,
                stableLetter: stable?.letter || null,
                stableConfidence: stable?.confidence ?? null,
                frameWidth: timing.frameWidth,
                frameHeight: timing.frameHeight,
                captureMs: timing.captureEnd - timing.frameStart,
                requestMs: timing.responseEnd - timing.captureEnd,
                processingMs: result.processing_ms ?? null,
                detectionMs: result.detection_ms ?? null,
                inferenceMs: result.inference_ms ?? null,
                renderMs: paintMeasured
                    ? displayedAt - timing.responseEnd
                    : null,
                e2eMs: paintMeasured
                    ? displayedAt - timing.frameStart
                    : null,
                timestamp: Date.now()
            });
        };

        requestAnimationFrame(() => report(true));
        setTimeout(() => report(false), PAINT_FALLBACK_MS);
    }

    // =====================================
    // PENGUKURAN PERFORMA
    // =====================================

    function resetMetrics() {
        fpsWindowStart = 0;
        fpsFrameCount = 0;

        if (metricDetection) {
            metricDetection.textContent = "—";
        }

        if (metricProcessing) {
            metricProcessing.textContent = "—";
        }

        if (metricRequest) {
            metricRequest.textContent = "—";
        }

        if (metricFps) {
            metricFps.textContent = "—";
        }
    }

    function updateMetrics(result, requestMs, countForFps) {
        // Waktu inferensi MediaPipe dari backend.
        if (metricDetection) {
            metricDetection.textContent =
                typeof result.detection_ms === "number"
                    ? `${result.detection_ms.toFixed(2)} ms`
                    : "—";
        }

        // Waktu pemrosesan endpoint backend.
        if (metricProcessing) {
            metricProcessing.textContent =
                typeof result.processing_ms === "number"
                    ? `${result.processing_ms.toFixed(2)} ms`
                    : "—";
        }

        // Waktu fetch + parsing JSON di browser.
        if (metricRequest) {
            metricRequest.textContent =
                `${requestMs.toFixed(2)} ms`;
        }

        // FPS klasifikasi: hanya frame yang melewati pipeline
        // penuh (deteksi + klasifikasi, status success). Respons
        // no_hand/no_prediction tidak dihitung. Sama dengan
        // fps_klasifikasi pada mode pengujian.
        if (!countForFps) {
            return;
        }

        const now = performance.now();

        if (fpsWindowStart === 0) {
            fpsWindowStart = now;
            fpsFrameCount = 0;
        }

        fpsFrameCount++;

        const elapsed = now - fpsWindowStart;

        if (elapsed >= FPS_WINDOW_MS) {
            const fps =
                fpsFrameCount / (elapsed / 1000);

            if (metricFps) {
                metricFps.textContent = fps.toFixed(1);
            }

            fpsWindowStart = now;
            fpsFrameCount = 0;
        }
    }

    // =====================================
    // STATUS KAMERA DAN BACKEND
    // =====================================

    function setCameraStatus(message, state = "") {
        if (!cameraStatus) return;

        cameraStatus.classList.remove(
            "is-active",
            "is-pending"
        );

        if (state) {
            cameraStatus.classList.add(state);
        }

        cameraStatus.innerHTML = "";

        const dot = document.createElement("span");
        dot.className = "status-dot";

        cameraStatus.append(
            dot,
            document.createTextNode(message)
        );
    }

    // Pesan kosong menyembunyikan badge: status sistem
    // belum diketahui sebelum ada respons dari server.
    function setBackendStatus(available, message, state = "") {
        backendAvailable = available;

        if (!aiStatus) return;

        aiStatus.classList.remove(
            "is-ready",
            "is-pending",
            "is-error"
        );

        if (state) {
            aiStatus.classList.add(state);
        }

        aiStatus.textContent = message;
        aiStatus.hidden = !message;
    }

    function showPredictionMessage(message) {
        window.IsyaratPractice?.resetPrediction(message);
    }

    function showError(message) {
        if (!cameraError) return;

        cameraError.textContent = message;
        cameraError.hidden = false;
    }

    function clearError() {
        if (!cameraError) return;

        cameraError.textContent = "";
        cameraError.hidden = true;
    }

    // =====================================
    // LANDMARK MEDIAPIPE
    // =====================================

    function clearOverlay() {
        if (!overlay) return;

        const ctx = overlay.getContext("2d");

        ctx.clearRect(
            0,
            0,
            overlay.width,
            overlay.height
        );
    }

    function drawLandmarks(hands) {
        if (!overlay || !video) return;

        clearOverlay();

        if (!Array.isArray(hands) || !video.videoWidth) {
            return;
        }

        overlay.width = video.videoWidth;
        overlay.height = video.videoHeight;

        const ctx = overlay.getContext("2d");

        ctx.lineWidth = 2;
        ctx.strokeStyle = "#00e676";
        ctx.fillStyle = "#00e676";

        hands.forEach(hand => {
            if (!Array.isArray(hand) || hand.length < 21) {
                return;
            }

            const points = hand.map(point => ({
                x: point.x * overlay.width,
                y: point.y * overlay.height
            }));

            // Gambar garis penghubung.
            HAND_CONNECTIONS.forEach(([a, b]) => {
                if (
                    !Number.isFinite(points[a]?.x) ||
                    !Number.isFinite(points[a]?.y) ||
                    !Number.isFinite(points[b]?.x) ||
                    !Number.isFinite(points[b]?.y)
                ) {
                    return;
                }

                ctx.beginPath();
                ctx.moveTo(points[a].x, points[a].y);
                ctx.lineTo(points[b].x, points[b].y);
                ctx.stroke();
            });

            // Gambar titik tangan.
            points.forEach(point => {
                if (
                    !Number.isFinite(point.x) ||
                    !Number.isFinite(point.y)
                ) {
                    return;
                }

                ctx.beginPath();
                ctx.arc(
                    point.x,
                    point.y,
                    3,
                    0,
                    Math.PI * 2
                );
                ctx.fill();
            });
        });
    }

    // =====================================
    // MENGAMBIL FRAME
    // =====================================

    function captureFrame() {
        if (
            !video ||
            video.readyState < 2 ||
            !video.videoWidth
        ) {
            return Promise.resolve(null);
        }

        const scale = Math.min(
            1,
            SEND_MAX_WIDTH / video.videoWidth
        );

        captureCanvas.width = Math.round(
            video.videoWidth * scale
        );

        captureCanvas.height = Math.round(
            video.videoHeight * scale
        );

        // Gambar asli: mirror hanya pada CSS.
        captureContext.drawImage(
            video,
            0,
            0,
            captureCanvas.width,
            captureCanvas.height
        );

        return new Promise(resolve => {
            captureCanvas.toBlob(
                resolve,
                "image/jpeg",
                JPEG_QUALITY
            );
        });
    }

    // =====================================
    // PEMERIKSAAN PENCAHAYAAN
    // =====================================

    function stopLighting() {
        if (lightingTimer !== null) {
            clearInterval(lightingTimer);
            lightingTimer = null;
        }
    }

    function startLighting() {
        stopLighting();

        if (typeof window.updateLighting !== "function") {
            console.warn(
                "lighting.js belum tersedia atau tidak dimuat."
            );

            if (lightingElement) {
                lightingElement.textContent =
                    "Pemeriksaan pencahayaan tidak tersedia.";
            }

            return;
        }

        window.resetLighting?.();

        window.updateLighting(video);

        lightingTimer = setInterval(() => {
            if (running && video.readyState >= 2) {
                window.updateLighting(video);
            }
        }, 500);
    }

    // =====================================
    // LOOP DETEKSI BACKEND
    // =====================================

    async function predictLoop(id) {
        while (running && id === sessionId) {
            let timeoutId = null;
            let controller = null;

            try {
                // Frame diterima dari webcam (awal latency end-to-end).
                const frameStart = performance.now();

                // Sesi stabilizer saat frame diambil.
                const frameToken =
                    window.IsyaratPractice?.getSessionToken?.();

                const blob = await captureFrame();

                const captureEnd = performance.now();

                if (!running || id !== sessionId) {
                    break;
                }

                if (!blob) {
                    await sleep(100);
                    continue;
                }

                const data = new FormData();
                data.append("frame", blob, "frame.jpg");

                controller = new AbortController();
                activeRequest = controller;

                timeoutId = setTimeout(
                    () => controller.abort(),
                    REQUEST_TIMEOUT_MS
                );

                // Mulai mengukur request frontend.
                const requestStart = performance.now();

                const timing = {
                    frameStart,
                    captureEnd,
                    responseEnd: null,
                    frameWidth: captureCanvas.width,
                    frameHeight: captureCanvas.height
                };

                const response = await fetch(API_URL, {
                    method: "POST",
                    body: data,
                    signal: controller.signal
                });

                if (!response.ok) {
                    const httpError = new Error(
                        `Backend merespons HTTP ${response.status}`
                    );

                    // Server terhubung, tetapi gagal memproses.
                    httpError.httpStatus = response.status;

                    throw httpError;
                }

                const result = await response.json();

                // Durasi fetch sampai JSON selesai dibaca.
                timing.responseEnd = performance.now();

                const requestMs =
                    timing.responseEnd - requestStart;

                if (!running || id !== sessionId) {
                    break;
                }

                // resetSession() dipanggil selama request berjalan
                // (mis. awal perekaman mode uji): hasil frame lama
                // tidak boleh memengaruhi stabilizer, tampilan,
                // maupun data percobaan sesi baru.
                if (
                    frameToken !== undefined &&
                    frameToken !== window.IsyaratPractice?.getSessionToken?.()
                ) {
                    continue;
                }

                clearError();

                const hands = Array.isArray(result.hands)
                    ? result.hands
                    : [];

                drawLandmarks(hands);

                if (result.status === "error") {
                    setBackendStatus(
                        false,
                        "Sistem mengalami kesalahan",
                        "is-error"
                    );

                    resetMetrics();

                    window.IsyaratPractice?.resetSession(
                        "Server gagal memproses gambar kamera. " +
                        "Hasil prediksi belum tersedia."
                    );

                } else {
                    const fullPipeline =
                        result.status === "success";

                    updateMetrics(result, requestMs, fullPipeline);

                    let stable = null;

                    if (
                        result.letter &&
                        /^[A-Z]$/i.test(result.letter)
                    ) {
                        const confidence =
                            typeof result.confidence === "number"
                                ? result.confidence
                                : null;

                        setBackendStatus(
                            true,
                            "Sistem siap",
                            "is-ready"
                        );

                        // Ditampilkan setelah stabilisasi di practice.js
                        stable = window.IsyaratPractice?.handlePrediction(
                            result.letter,
                            confidence
                        );

                    } else {
                        const modelMissing =
                            result.status === "model_not_ready";

                        setBackendStatus(
                            true,
                            modelMissing
                                ? "Model belum tersedia"
                                : "Sistem siap",
                            modelMissing ? "is-error" : "is-ready"
                        );

                        // no_prediction membawa alasan dari server,
                        // misalnya tangan terlalu kecil.
                        stable = window.IsyaratPractice?.handleNoPrediction(
                            hands.length
                                ? result.message ||
                                  "Tangan terdeteksi, tetapi huruf belum dapat dikenali."
                                : "Tangan belum terdeteksi. Pastikan seluruh tangan terlihat di kamera."
                        );
                    }

                    reportFrame(timing, result, stable);
                }

            } catch (error) {
                if (!running || id !== sessionId) {
                    break;
                }

                clearOverlay();
                resetMetrics();

                // Bedakan server error, timeout, dan gagal koneksi.
                // Loop mencoba lagi otomatis setelah RETRY_DELAY_MS.
                if (
                    error.httpStatus ||
                    error.name === "SyntaxError"
                ) {
                    setBackendStatus(
                        false,
                        "Sistem mengalami kesalahan",
                        "is-error"
                    );

                    window.IsyaratPractice?.resetSession(
                        "Hasil prediksi belum tersedia karena server mengalami kesalahan."
                    );

                    showError(
                        "Server mengalami kesalahan" +
                        (error.httpStatus
                            ? ` (HTTP ${error.httpStatus})`
                            : "") +
                        ". Periksa terminal backend. " +
                        "Sistem mencoba lagi otomatis."
                    );

                } else if (error.name === "AbortError") {
                    setBackendStatus(
                        false,
                        "Sistem tidak merespons",
                        "is-error"
                    );

                    window.IsyaratPractice?.resetSession(
                        "Hasil prediksi belum tersedia karena server tidak merespons."
                    );

                    showError(
                        "Server tidak merespons dalam " +
                        `${REQUEST_TIMEOUT_MS / 1000} detik. ` +
                        "Sistem mencoba lagi otomatis."
                    );

                } else {
                    setBackendStatus(
                        false,
                        "Tidak dapat terhubung ke sistem",
                        "is-error"
                    );

                    window.IsyaratPractice?.resetSession(
                        "Hasil prediksi belum tersedia karena sistem tidak dapat dihubungi."
                    );

                    showError(
                        "Tidak dapat terhubung ke sistem. " +
                        "Pastikan backend Flask berjalan di port 5000. " +
                        "Sistem mencoba lagi otomatis."
                    );
                }

                console.warn("Predict:", error.message);

                await sleep(RETRY_DELAY_MS);

            } finally {
                if (timeoutId !== null) {
                    clearTimeout(timeoutId);
                }

                // Jangan hapus referensi request sesi baru.
                if (activeRequest === controller) {
                    activeRequest = null;
                }
            }
        }
    }

    // =====================================
    // MULAI KAMERA
    // =====================================

    async function startWebcam() {
        if (running || starting) return;

        starting = true;

        const id = ++sessionId;

        clearError();
        resetMetrics();

        cameraButton.disabled = true;
        cameraButton.textContent = "Membuka Kamera...";

        setCameraStatus(
            "Mengaktifkan kamera",
            "is-pending"
        );

        showPredictionMessage(
            "Mengaktifkan kamera. Izinkan akses kamera jika browser meminta."
        );

        try {
            if (!navigator.mediaDevices?.getUserMedia) {
                throw new Error(
                    "Browser tidak mendukung webcam atau koneksi tidak aman."
                );
            }

            const newStream =
                await navigator.mediaDevices.getUserMedia({
                    audio: false,
                    video: {
                        width: { ideal: 640 },
                        height: { ideal: 480 },
                        facingMode: "user"
                    }
                });

            if (id !== sessionId) {
                newStream.getTracks().forEach(
                    track => track.stop()
                );
                return;
            }

            stream = newStream;
            video.srcObject = stream;

            await video.play();

            if (id !== sessionId) return;

            running = true;

            cameraContainer.classList.add(
                "camera-active"
            );

            setCameraStatus(
                "Kamera aktif",
                "is-active"
            );

            setBackendStatus(
                false,
                "Menghubungkan ke sistem",
                "is-pending"
            );

            showPredictionMessage(
                "Kamera aktif. Menghubungkan ke sistem…"
            );

            startLighting();
            predictLoop(id);

        } catch (error) {
            console.error("Webcam:", error);

            stopWebcam();

            showPredictionMessage(
                "Kamera tidak dapat dinyalakan. Lihat keterangan di bawah area kamera."
            );

            const messages = {
                NotAllowedError:
                    "Izin kamera ditolak. Izinkan kamera melalui pengaturan browser.",
                NotFoundError:
                    "Perangkat kamera tidak ditemukan.",
                NotReadableError:
                    "Kamera sedang digunakan aplikasi lain."
            };

            showError(
                messages[error.name] ||
                "Kamera tidak dapat dibuka: " +
                error.message
            );

        } finally {
            starting = false;
            cameraButton.disabled = false;

            cameraButton.textContent = running
                ? "Hentikan Kamera"
                : "Mulai Kamera";
        }
    }

    // =====================================
    // HENTIKAN KAMERA
    // =====================================

    function stopWebcam() {
        ++sessionId;
        running = false;

        if (activeRequest) {
            activeRequest.abort();
            activeRequest = null;
        }

        stopLighting();
        window.resetLighting?.();
        resetMetrics();

        if (lightingElement) {
            lightingElement.textContent = "";
            delete lightingElement.dataset.status;
        }

        if (stream) {
            stream.getTracks().forEach(
                track => track.stop()
            );
            stream = null;
        }

        if (video) {
            video.pause();
            video.srcObject = null;
        }

        cameraContainer.classList.remove(
            "camera-active"
        );

        setCameraStatus("Kamera belum aktif");

        // Tanpa kamera, status server tidak diketahui.
        setBackendStatus(false, "");

        cameraButton.textContent = "Mulai Kamera";

        clearOverlay();

        window.IsyaratPractice?.resetSession(
            "Kamera dihentikan. Nyalakan kamera untuk melanjutkan."
        );
    }

    // =====================================
    // COBA LAGI
    // =====================================

    function retry() {
        clearError();
        clearOverlay();
        resetMetrics();

        if (running) {
            // Mengganti sesi permintaan tanpa
            // menghentikan kamera ataupun pencahayaan.
            const id = ++sessionId;

            activeRequest?.abort();

            // Riwayat stabilisasi sesi lama tidak dipakai lagi.
            window.IsyaratPractice?.resetSession(
                "Latihan direset. Siapkan gesture kembali."
            );

            setBackendStatus(
                false,
                "Menghubungkan ke sistem",
                "is-pending"
            );

            predictLoop(id);

        } else {
            window.IsyaratPractice?.resetSession(
                "Nyalakan kamera untuk mulai mengenali huruf."
            );
        }
    }

    // =====================================
    // EVENT LISTENERS
    // =====================================

    cameraButton.addEventListener("click", () => {
        if (running) {
            stopWebcam();
        } else {
            startWebcam();
        }
    });

    window.addEventListener(
        "pagehide",
        stopWebcam
    );

    // =====================================
    // GLOBAL API
    // =====================================

    window.IsyaratCamera = {
        start: startWebcam,
        stop: stopWebcam,
        retry,
        isRunning: () => running,
        isBackendAvailable: () => backendAvailable
    };

    console.log(
        "IsyaratKu Webcam + Performance siap."
    );
})();
