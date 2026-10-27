
/* =========================================
   ISYARATKU - PRACTICE
   ========================================= */

(() => {
    "use strict";

    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    const params = new URLSearchParams(window.location.search);

    const requested = (params.get("huruf") || "").toUpperCase();
    let selectedLetter = alphabet.includes(requested) ? requested : null;
    let currentPrediction = null;

    // Stabilisasi tampilan: huruf baru ditampilkan jika muncul
    // minimal STABLE_MIN_VOTES kali dalam STABLE_WINDOW prediksi
    // sukses terakhir. Prediksi mentah CNN tidak diubah.
    const STABLE_WINDOW = 7;
    const STABLE_MIN_VOTES = 4;
    const STABLE_MAX_MISSES = 3;

    // Prediksi dengan confidence di bawah ambang diabaikan: tidak
    // ikut voting dan TIDAK dihitung miss, sehingga huruf stabil
    // tidak hilang hanya karena beberapa frame kurang yakin.
    // Pada 447 citra test (pipeline aplikasi), ambang 0,6
    // menyaring 10 dari 40 prediksi salah dan 5 prediksi benar.
    // Pilot real-time skenario 1 (78 percobaan): jika frame
    // kurang yakin dihitung miss, akurasi 88,5%; jika diabaikan,
    // 93,6% pada frame yang sama.
    const MIN_CONFIDENCE = 0.6;

    function createStabilizer(
        windowSize = STABLE_WINDOW,
        minVotes = STABLE_MIN_VOTES,
        maxMisses = STABLE_MAX_MISSES
    ) {
        let history = [];
        let misses = 0;
        let stable = null;

        function state() {
            const support = stable
                ? history.filter(item => item.letter === stable.letter)
                : [];

            return {
                letter: stable ? stable.letter : null,
                // Rata-rata confidence huruf stabil saat terakhir didukung
                confidence: stable ? stable.confidence : null,
                votes: support.length,
                windowSize: history.length,
                misses
            };
        }

        function addPrediction(letter, confidence) {
            misses = 0;
            history.push({ letter, confidence });

            if (history.length > windowSize) {
                history.shift();
            }

            const counts = {};
            history.forEach(item => {
                counts[item.letter] = (counts[item.letter] || 0) + 1;
            });

            // minVotes > windowSize / 2, sehingga paling banyak
            // satu huruf memenuhi syarat.
            const candidate = Object.keys(counts)
                .find(key => counts[key] >= minVotes);

            if (candidate && (!stable || stable.letter !== candidate)) {
                stable = { letter: candidate, confidence: null };
            }

            if (stable) {
                // Confidence hanya dari prediksi huruf stabil itu sendiri.
                const values = history
                    .filter(item => item.letter === stable.letter)
                    .map(item => item.confidence)
                    .filter(value => typeof value === "number");

                if (values.length) {
                    stable.confidence =
                        values.reduce((sum, value) => sum + value, 0) /
                        values.length;
                }
            }

            return state();
        }

        function addMiss() {
            misses++;

            if (misses >= maxMisses) {
                history = [];
                stable = null;
            }

            return state();
        }

        function reset() {
            history = [];
            misses = 0;
            stable = null;
        }

        return { addPrediction, addMiss, reset, state };
    }

    const stabilizer = createStabilizer();

    // Naik setiap resetSession(). webcam.js mencatat nilainya saat
    // frame diambil; respons dari frame dengan token lama dibuang
    // agar tidak masuk ke sesi atau percobaan yang sudah direset.
    let sessionToken = 0;

    const byId = id => document.getElementById(id);

    const dialog = byId("letterDialog");
    const picker = byId("letterPickerGrid");
    const selectedDisplay = byId("selectedLetter");

    const predictionElement = byId("prediction");
    const predictionDetails = byId("predictionDetails");
    const predictionDescription = byId("predictionDescription");
    const confidenceText = byId("confidenceText");
    const confidenceBar = byId("confidenceBar");
    const predictionMessage = byId("predictionMessage");
    const soundSwitch = byId("soundSwitch");
    const soundSwitchLabel = byId("soundSwitchLabel");
    const soundHint = byId("soundHint");

    // Suara (TTS) hanya membacakan huruf stabil. OFF saat halaman dibuka.
    const ttsSupported =
        "speechSynthesis" in window &&
        typeof window.SpeechSynthesisUtterance === "function";

    let soundOn = false;
    // Huruf stabil yang sedang tampil
    let stableLetter = null;
    // Huruf stabil terakhir yang sudah dibacakan
    let spokenLetter = null;

    const SOUND_WAITING =
        "Suara aktif. Menunggu prediksi stabil untuk dibacakan.";
    const SOUND_FAILED =
        "Suara tidak dapat diputar. Prediksi tetap berjalan.";

    function setSoundHint(text) {
        if (soundHint.textContent !== text) {
            soundHint.textContent = text;
        }
    }

    function cancelSpeech() {
        if (!ttsSupported) {
            return;
        }

        try {
            window.speechSynthesis.cancel();
        } catch (error) {
            // Kegagalan TTS tidak boleh menghentikan prediksi.
        }
    }

    // Suara bahasa Indonesia jika terpasang. Jika tidak ada,
    // browser memilih suara bawaan berdasarkan utterance.lang.
    function findIndonesianVoice() {
        try {
            return window.speechSynthesis.getVoices()
                .find(voice => /^id([-_]|$)/i.test(voice.lang)) || null;
        } catch (error) {
            return null;
        }
    }

    // getVoices() kosong saat halaman dibuka; daftar voice baru
    // terisi setelah event voiceschanged. Voice disimpan agar
    // huruf pertama pun memakai voice Indonesia jika ada.
    let indonesianVoice = null;

    function refreshVoices() {
        indonesianVoice = findIndonesianVoice();
    }

    if (ttsSupported) {
        // Pemanggilan pertama juga memicu pemuatan daftar voice.
        refreshVoices();

        try {
            window.speechSynthesis.addEventListener(
                "voiceschanged",
                refreshVoices
            );
        } catch (error) {
            // Tanpa event: voice tetap dicari saat huruf dibacakan.
        }
    }

    function speakLetter(letter) {
        if (!soundOn || !ttsSupported) {
            return;
        }

        spokenLetter = letter;

        try {
            window.speechSynthesis.cancel();

            // Cukup nama hurufnya, misalnya "A".
            const utterance = new SpeechSynthesisUtterance(letter);

            utterance.lang = "id-ID";
            utterance.rate = 0.85;

            if (!indonesianVoice) {
                refreshVoices();
            }

            if (indonesianVoice) {
                utterance.voice = indonesianVoice;
            }

            utterance.onerror = event => {
                // cancel() juga memicu error; itu bukan kegagalan.
                if (!soundOn ||
                    event.error === "canceled" ||
                    event.error === "interrupted") {
                    return;
                }

                setSoundHint(SOUND_FAILED);
            };

            window.speechSynthesis.speak(utterance);
            setSoundHint("");
        } catch (error) {
            setSoundHint(SOUND_FAILED);
        }
    }

    function renderSoundSwitch() {
        soundSwitch.setAttribute("aria-checked", String(soundOn));
        soundSwitchLabel.textContent = soundOn ? "Suara ON" : "Suara OFF";
    }

    function setSound(enabled) {
        soundOn = Boolean(enabled) && ttsSupported;
        renderSoundSwitch();

        if (!soundOn) {
            cancelSpeech();
            spokenLetter = null;
            setSoundHint("");
            return;
        }

        if (stableLetter) {
            // Huruf stabil yang sedang tampil dibacakan sekali.
            speakLetter(stableLetter);
        } else {
            spokenLetter = null;
            setSoundHint(SOUND_WAITING);
        }
    }

    function renderSelectedLetter() {
        selectedDisplay.textContent = selectedLetter || "Belum dipilih";

        picker.querySelectorAll(".letter-option").forEach(button => {
            const active = button.dataset.letter === selectedLetter;

            button.classList.toggle("is-selected", active);
            button.setAttribute("aria-pressed", String(active));
        });
    }

    function chooseLetter(letter) {
        selectedLetter = alphabet.includes(letter) ? letter : null;

        const url = new URL(window.location.href);

        if (selectedLetter) {
            url.searchParams.set("huruf", selectedLetter);
        } else {
            url.searchParams.delete("huruf");
        }

        window.history.replaceState({}, "", url);
        renderSelectedLetter();
        resetPrediction();

        document.dispatchEvent(new CustomEvent("isyarat:target", {
            detail: { letter: selectedLetter }
        }));
    }

    // Pesan bawaan mengikuti status kamera saat ini.
    function defaultEmptyMessage() {
        return window.IsyaratCamera?.isRunning()
            ? "Tahan gesture di depan kamera sampai prediksi stabil."
            : "Nyalakan kamera untuk mulai mengenali huruf.";
    }

    // Tanpa hasil: hanya satu pesan yang tampil (predictionMessage).
    function resetPrediction(message = defaultEmptyMessage()) {
        currentPrediction = null;

        predictionElement.textContent = "—";
        predictionDescription.textContent = "";
        confidenceText.textContent = "";
        confidenceBar.style.width = "0%";
        predictionDetails.hidden = true;
        predictionMessage.textContent = message;

        stableLetter = null;
        cancelSpeech();

        if (soundOn) {
            setSoundHint(SOUND_WAITING);
        }
    }

    function showPrediction(letter, confidence, confidenceLabel) {
        if (typeof letter !== "string") {
            resetPrediction();
            return;
        }

        const normalized = letter.trim().toUpperCase();

        if (!alphabet.includes(normalized)) {
            resetPrediction();
            return;
        }

        currentPrediction = normalized;
        predictionElement.textContent = normalized;
        predictionDetails.hidden = false;
        predictionDescription.textContent =
            `Gesture tampak seperti ${normalized}`;

        const validConfidence =
            typeof confidence === "number" &&
            Number.isFinite(confidence) &&
            confidence >= 0 &&
            confidence <= 1;

        if (validConfidence) {
            const percent = confidence * 100;
            confidenceText.textContent = confidenceLabel
                ? `${confidenceLabel} ${percent.toFixed(1)}%`
                : `Keyakinan pengenalan ${percent.toFixed(1)}%`;
            confidenceBar.style.width = `${percent}%`;
        } else {
            confidenceText.textContent =
                "Nilai keyakinan tidak tersedia";
            confidenceBar.style.width = "0%";
        }

        if (selectedLetter) {
            predictionMessage.textContent =
                normalized === selectedLetter
                    ? `Hasil prediksi sesuai dengan huruf panduan ${selectedLetter}.`
                    : `Hasil terdeteksi ${normalized}, sedangkan huruf panduan adalah ${selectedLetter}.`;
        } else {
            predictionMessage.textContent =
                `Sistem menghasilkan prediksi huruf ${normalized}.`;
        }
    }

    function showStable(result) {
        showPrediction(
            result.letter,
            result.confidence,
            "Keyakinan rata-rata"
        );

        // Sumber suara hanya huruf stabil yang benar-benar tampil.
        const previousStable = stableLetter;
        stableLetter = currentPrediction;

        // Dipakai praktik-progress.js untuk menandai progres belajar.
        if (stableLetter && stableLetter !== previousStable) {
            document.dispatchEvent(new CustomEvent("isyarat:stable", {
                detail: {
                    letter: stableLetter,
                    target: selectedLetter,
                    confidence: result.confidence
                }
            }));
        }

        if (!soundOn || !stableLetter) {
            return;
        }

        if (stableLetter !== spokenLetter) {
            speakLetter(stableLetter);
        } else if (soundHint.textContent === SOUND_WAITING) {
            // Huruf yang sama tampil lagi setelah tampilan direset.
            setSoundHint("");
        }
    }

    // Respons sukses dari backend
    function handlePrediction(letter, confidence) {
        const normalized = typeof letter === "string"
            ? letter.trim().toUpperCase()
            : "";

        if (!alphabet.includes(normalized)) {
            return;
        }

        if (
            typeof confidence === "number" &&
            confidence < MIN_CONFIDENCE
        ) {
            const state = stabilizer.state();
            const hint =
                "Model kurang yakin dengan gesture ini. " +
                "Perbaiki posisi tangan atau pencahayaan.";

            if (state.letter) {
                // Huruf stabil tetap tampil; hanya diberi petunjuk.
                showStable(state);
                predictionMessage.textContent =
                    `${hint} Menampilkan hasil terakhir ${state.letter}.`;
            } else {
                resetPrediction(hint);
            }

            return state;
        }

        const result = stabilizer.addPrediction(normalized, confidence);

        if (result.letter) {
            showStable(result);
        } else {
            spokenLetter = null;
            resetPrediction(
                "Menstabilkan prediksi. Tahan gesture sebentar."
            );
        }

        // Dipakai mode pengujian untuk mencatat huruf stabil
        return result;
    }

    // Respons no_hand / no_prediction
    function handleNoPrediction(message) {
        const result = stabilizer.addMiss();

        if (result.letter) {
            // Hasil terakhir dipertahankan sementara.
            showStable(result);
            predictionMessage.textContent =
                `${message} Menunggu prediksi baru; ` +
                `menampilkan hasil terakhir ${result.letter}.`;
        } else {
            // Huruf stabil hilang; huruf berikutnya dibacakan lagi.
            spokenLetter = null;
            resetPrediction(message);
        }

        return result;
    }

    // Kamera dihentikan, sesi diulang, atau error backend
    function resetSession(message) {
        stabilizer.reset();
        spokenLetter = null;
        // Frame yang diambil sebelum reset tidak lagi berlaku.
        sessionToken++;
        resetPrediction(message);
    }

    // Siapkan pilihan alfabet A-Z
    alphabet.forEach(letter => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "letter-option";
        button.dataset.letter = letter;
        button.textContent = letter;

        button.addEventListener("click", () => {
            chooseLetter(letter);
            dialog.close();
        });

        picker.appendChild(button);
    });

    byId("selectLetterButton").addEventListener("click", () => {
        dialog.showModal();
    });

    byId("closeLetterDialog").addEventListener("click", () => {
        dialog.close();
    });

    byId("doneLetterButton").addEventListener("click", () => {
        dialog.close();
    });

    byId("clearLetterButton").addEventListener("click", () => {
        chooseLetter(null);
        dialog.close();
    });

    byId("retryButton").addEventListener("click", () => {
        resetSession("Latihan direset. Siapkan gesture kembali.");

        if (window.IsyaratCamera) {
            window.IsyaratCamera.retry();
        }
    });

    // Tombol native: klik, Enter, dan Spasi memicu event yang sama.
    soundSwitch.addEventListener("click", () => {
        setSound(!soundOn);
    });

    if (!ttsSupported) {
        soundSwitch.disabled = true;
        setSoundHint(
            "Browser ini tidak mendukung suara, sehingga huruf tidak dapat dibacakan."
        );
    }

    renderSoundSwitch();

    renderSelectedLetter();
    resetPrediction(
        "Nyalakan kamera untuk mulai mengenali huruf."
    );

    // Interface bagi webcam.js
    window.IsyaratPractice = {
        showPrediction,
        resetPrediction,
        handlePrediction,
        handleNoPrediction,
        resetSession,
        createStabilizer,
        getSelectedLetter: () => selectedLetter,
        chooseLetter,
        getStableState: () => stabilizer.state(),
        getSessionToken: () => sessionToken,
        // Dicatat mode pengujian sebagai konfigurasi sistem
        config: Object.freeze({
            stableWindow: STABLE_WINDOW,
            stableMinVotes: STABLE_MIN_VOTES,
            stableMaxMisses: STABLE_MAX_MISSES,
            minConfidence: MIN_CONFIDENCE
        })
    };

    console.log("IsyaratKu Practice siap.");
})();
