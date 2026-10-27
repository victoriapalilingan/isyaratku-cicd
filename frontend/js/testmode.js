
/* =========================================
   ISYARATKU - MODE PENGUJIAN REAL-TIME
   Bab 3: 8 skenario x 26 huruf x 3 percobaan
   = 624 percobaan. Aktif hanya dengan ?uji=1
   ========================================= */

(() => {
    "use strict";

    const params = new URLSearchParams(window.location.search);

    if (params.get("uji") !== "1") {
        return;
    }

    // =====================================
    // PROTOKOL PENGUJIAN
    // =====================================

    // Waktu bagi pengguna membentuk gesture. Frame
    // pada fase ini tidak dicatat.
    const PREP_MS = 3000;

    // Jendela pencatatan setiap percobaan.
    const TRIAL_MS = 5000;

    // Mode otomatis: lama hasil ditampilkan sebelum
    // percobaan berikutnya dimulai.
    const RESULT_MS = 1800;

    const REPETITIONS = 3;

    const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

    // Sesuai Tabel 6 Skenario Pengujian Sistem Real-Time.
    const SCENARIOS = [
        { id: 1, name: "Kondisi Ideal", lighting: "Terang", background: "Polos", input: "Tangan jelas dan posisi stabil" },
        { id: 2, name: "Pencahayaan Redup", lighting: "Redup", background: "Polos", input: "Tangan jelas" },
        { id: 3, name: "Pencahayaan Normal", lighting: "Normal", background: "Polos", input: "Tangan jelas" },
        { id: 4, name: "Background Kompleks", lighting: "Terang", background: "Kompleks", input: "Tangan jelas" },
        { id: 5, name: "Pencahayaan Redup dan Background Kompleks", lighting: "Redup", background: "Kompleks", input: "Tangan jelas" },
        { id: 6, name: "Variasi Jarak", lighting: "Normal", background: "Polos", input: "Tangan dekat dan jauh dari kamera" },
        { id: 7, name: "Variasi Sudut", lighting: "Normal", background: "Polos", input: "Posisi tangan miring atau bervariasi" },
        { id: 8, name: "Variasi Pengguna", lighting: "Normal", background: "Polos", input: "Berbeda individu" }
    ];

    const STORAGE_KEY = "isyaratku_pengujian_v1";

    // Nama kolom FPS lama -> nama baru. Nilainya tidak berubah;
    // data lama di localStorage dinamai ulang agar kolom CSV
    // tetap konsisten antara percobaan lama dan baru.
    // Harus dideklarasikan sebelum loadTrials() dipanggil.
    const RENAMED_KEYS = {
        fps_pipeline: "fps_klasifikasi",
        fps_semua_respons: "fps_sistem"
    };

    // Konfigurasi tampilan hasil dari practice.js; dicatat
    // pada setiap percobaan agar hasil dapat ditelusuri.
    const SYSTEM = window.IsyaratPractice?.config || {
        stableWindow: null,
        stableMinVotes: null,
        stableMaxMisses: null,
        minConfidence: null
    };

    // =====================================
    // STATE
    // =====================================

    let trials = loadTrials();

    // Frame per percobaan hanya disimpan di memori
    // (bisa puluhan ribu baris, terlalu besar untuk localStorage).
    let sessionFrames = [];

    let phase = "idle"; // idle | prep | recording
    let current = null;
    let phaseTimer = null;
    let tickTimer = null;

    // Mode otomatis: percobaan berjalan berurutan tanpa
    // menekan tombol untuk setiap huruf.
    const auto = { on: false, paused: false };
    let resultTimer = null;

    function migrateTrial(trial) {
        const migrated = {};

        Object.keys(trial).forEach(key => {
            migrated[RENAMED_KEYS[key] || key] = trial[key];
        });

        return migrated;
    }

    function loadTrials() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed.map(migrateTrial) : [];
        } catch (error) {
            return [];
        }
    }

    function saveTrials() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(trials));
            return true;
        } catch (error) {
            setNotice(
                "Data percobaan tidak dapat disimpan di browser. " +
                "Segera ekspor CSV agar data tidak hilang."
            );
            return false;
        }
    }

    // =====================================
    // STATISTIK
    // =====================================

    function mean(values) {
        return values.length
            ? values.reduce((sum, value) => sum + value, 0) / values.length
            : null;
    }

    function percentile(values, p) {
        if (!values.length) return null;

        const sorted = [...values].sort((a, b) => a - b);
        const index = (sorted.length - 1) * p;
        const low = Math.floor(index);
        const high = Math.ceil(index);

        return sorted[low] + (sorted[high] - sorted[low]) * (index - low);
    }

    function round(value, digits = 2) {
        return typeof value === "number" && Number.isFinite(value)
            ? Number(value.toFixed(digits))
            : null;
    }

    // =====================================
    // ELEMEN PANEL
    // =====================================

    const panel = document.createElement("section");
    panel.className = "test-panel";
    panel.setAttribute("aria-label", "Mode pengujian real-time");

    panel.innerHTML = `
        <div class="test-head">
            <div>
                <span class="test-eyebrow">MODE PENGUJIAN · BAB 3</span>
                <h3>Pengujian Sistem Real-Time</h3>
            </div>
            <span class="test-progress" id="testProgress"></span>
        </div>

        <div class="test-form">
            <label>
                Skenario
                <select id="testScenario"></select>
            </label>
            <label>
                Kode pengguna
                <input id="testUser" type="text" maxlength="20"
                       placeholder="mis. P1" autocomplete="off">
            </label>
            <label>
                Huruf target
                <select id="testLetter"></select>
            </label>
            <label>
                Percobaan ke-
                <select id="testRep"></select>
            </label>
        </div>

        <p class="test-scenario-info" id="testScenarioInfo"></p>

        <div class="test-stage" id="testStage" data-phase="idle">
            <span class="test-target" id="testTarget">A</span>
            <div class="test-stage-copy">
                <strong id="testPhaseText">Siap</strong>
                <span id="testPhaseDetail"></span>
            </div>
        </div>

        <div class="test-auto">
            <button type="button" class="primary-button" id="testAuto">
                ▶ Mulai Otomatis
            </button>
            <label class="test-check">
                <input type="checkbox" id="testSpeak">
                Bacakan huruf target
            </label>
            <span class="test-keys">
                <kbd>Spasi</kbd> mulai/jeda · <kbd>R</kbd> ulangi · <kbd>Esc</kbd> berhenti
            </span>
        </div>

        <div class="test-actions">
            <button type="button" class="secondary-button" id="testStart">
                Satu Percobaan
            </button>
            <button type="button" class="secondary-button" id="testCancel" hidden>
                Batalkan
            </button>
            <button type="button" class="secondary-button" id="testUndo">
                Hapus Percobaan Terakhir
            </button>
        </div>

        <p class="test-notice" id="testNotice" role="status"></p>

        <div class="test-last" id="testLast" hidden></div>

        <div class="test-grid-wrap">
            <table class="test-grid" id="testGrid"></table>
        </div>

        <div class="test-summary" id="testSummary"></div>

        <div class="test-actions test-export">
            <button type="button" class="secondary-button" id="exportTrials">
                Ekspor CSV Percobaan
            </button>
            <button type="button" class="secondary-button" id="exportSummary">
                Ekspor CSV Ringkasan Skenario
            </button>
            <button type="button" class="secondary-button" id="exportFrames">
                Ekspor CSV Frame (sesi ini)
            </button>
            <button type="button" class="danger-button" id="testReset">
                Hapus Semua Data
            </button>
        </div>

        <p class="test-footnote">
            Mode otomatis menjalankan percobaan berurutan A–Z (percobaan ke-1,
            lalu ke-2 dan ke-3) sampai skenario selesai, dengan jeda
            ${RESULT_MS / 1000} detik untuk menampilkan hasil.
            Persiapan ${PREP_MS / 1000} detik (tidak dicatat), lalu frame dicatat
            selama ${TRIAL_MS / 1000} detik. Hasil percobaan = huruf stabil
            (≥${SYSTEM.stableMinVotes} dari ${SYSTEM.stableWindow} prediksi
            terakhir dengan keyakinan ≥${Math.round(SYSTEM.minConfidence * 100)}%;
            prediksi di bawah ambang diabaikan, bukan dihitung sebagai frame
            tanpa hasil) yang tampil pada akhir jendela.
            Latency end-to-end diukur sejak frame diambil dari webcam
            sampai hasil tampil di antarmuka. FPS klasifikasi menghitung
            frame yang melewati deteksi dan klasifikasi (status success);
            FPS sistem menghitung semua respons, termasuk tanpa tangan
            dan tanpa prediksi.
        </p>
    `;

    const anchor = document.querySelector(".performance-panel");

    if (anchor) {
        anchor.after(panel);
    } else {
        document.querySelector(".camera-section")?.appendChild(panel);
    }

    document.body.classList.add("test-mode");

    // Hitung mundur besar di atas video kamera, terbaca dari jarak
    // saat pengguna memperagakan gesture.
    const overlay = document.createElement("div");
    overlay.className = "test-overlay";
    overlay.hidden = true;
    overlay.setAttribute("aria-live", "polite");
    overlay.innerHTML = `
        <span class="ov-label" id="ovLabel"></span>
        <span class="ov-letter" id="ovLetter"></span>
        <span class="ov-count" id="ovCount"></span>
        <span class="ov-hint" id="ovHint"></span>
    `;
    document.getElementById("camera-container")?.appendChild(overlay);

    const byId = id => document.getElementById(id);

    const ovLabel = byId("ovLabel");
    const ovLetter = byId("ovLetter");
    const ovCount = byId("ovCount");
    const ovHint = byId("ovHint");

    const autoButton = byId("testAuto");
    const speakCheck = byId("testSpeak");

    const scenarioSelect = byId("testScenario");
    const userInput = byId("testUser");
    const letterSelect = byId("testLetter");
    const repSelect = byId("testRep");
    const scenarioInfo = byId("testScenarioInfo");
    const stage = byId("testStage");
    const targetElement = byId("testTarget");
    const phaseText = byId("testPhaseText");
    const phaseDetail = byId("testPhaseDetail");
    const startButton = byId("testStart");
    const cancelButton = byId("testCancel");
    const undoButton = byId("testUndo");
    const notice = byId("testNotice");
    const lastBox = byId("testLast");
    const grid = byId("testGrid");
    const summaryBox = byId("testSummary");
    const progressElement = byId("testProgress");

    SCENARIOS.forEach(scenario => {
        scenarioSelect.add(
            new Option(`${scenario.id}. ${scenario.name}`, scenario.id)
        );
    });

    ALPHABET.forEach(letter => letterSelect.add(new Option(letter, letter)));

    for (let rep = 1; rep <= REPETITIONS; rep++) {
        repSelect.add(new Option(rep, rep));
    }

    function setNotice(text) {
        notice.textContent = text;
    }

    function selectedScenario() {
        return SCENARIOS.find(
            scenario => scenario.id === Number(scenarioSelect.value)
        );
    }

    function trialsFor(scenarioId) {
        return trials.filter(trial => trial.skenario_id === scenarioId);
    }

    function findTrial(scenarioId, letter, rep) {
        return trials.find(trial =>
            trial.skenario_id === scenarioId &&
            trial.huruf_target === letter &&
            trial.percobaan_ke === rep
        );
    }

    // Huruf dan pengulangan berikutnya yang belum diuji.
    // Urutan: A1, B1, ... Z1, A2, ... (satu putaran A-Z per pengulangan).
    function nextSlot(scenarioId) {
        for (let rep = 1; rep <= REPETITIONS; rep++) {
            for (const letter of ALPHABET) {
                if (!findTrial(scenarioId, letter, rep)) {
                    return { letter, rep };
                }
            }
        }
        return null;
    }

    function goToNextSlot() {
        const slot = nextSlot(selectedScenario().id);

        if (slot) {
            letterSelect.value = slot.letter;
            repSelect.value = slot.rep;
        }

        renderTarget();
    }

    // =====================================
    // RENDER
    // =====================================

    function renderTarget() {
        targetElement.textContent = letterSelect.value;
    }

    function renderScenarioInfo() {
        const scenario = selectedScenario();

        scenarioInfo.textContent =
            `Pencahayaan: ${scenario.lighting} · ` +
            `Latar: ${scenario.background} · ` +
            `Kondisi input: ${scenario.input}`;
    }

    function renderGrid() {
        const scenarioId = selectedScenario().id;

        let html = "<thead><tr><th>Ke-</th>";
        ALPHABET.forEach(letter => {
            html += `<th>${letter}</th>`;
        });
        html += "</tr></thead><tbody>";

        for (let rep = 1; rep <= REPETITIONS; rep++) {
            html += `<tr><th>${rep}</th>`;

            ALPHABET.forEach(letter => {
                const trial = findTrial(scenarioId, letter, rep);
                const isCurrent =
                    letter === letterSelect.value &&
                    rep === Number(repSelect.value);

                let cls = "cell-empty";
                let text = "";
                let title = `${letter} percobaan ${rep}: belum diuji`;

                if (trial) {
                    cls = trial.benar ? "cell-ok" : "cell-bad";
                    text = trial.huruf_hasil || "–";
                    title =
                        `${letter} percobaan ${rep}: hasil ` +
                        `${trial.huruf_hasil || "tidak stabil"}`;
                }

                html +=
                    `<td class="${cls}${isCurrent ? " cell-current" : ""}" ` +
                    `data-letter="${letter}" data-rep="${rep}" ` +
                    `title="${title}">${text}</td>`;
            });

            html += "</tr>";
        }

        grid.innerHTML = html + "</tbody>";
    }

    function scenarioSummary(scenario) {
        const list = trialsFor(scenario.id);
        const correct = list.filter(trial => trial.benar).length;

        const weightedMean = key => {
            const valid = list.filter(
                trial => typeof trial[key] === "number"
            );
            const frames = valid.reduce(
                (sum, trial) => sum + trial.n_frame_pipeline, 0
            );

            return frames
                ? valid.reduce(
                    (sum, trial) => sum + trial[key] * trial.n_frame_pipeline, 0
                ) / frames
                : null;
        };

        return {
            skenario_id: scenario.id,
            skenario: scenario.name,
            jumlah_percobaan: list.length,
            target_percobaan: ALPHABET.length * REPETITIONS,
            benar: correct,
            akurasi_realtime_persen: list.length
                ? round((correct / list.length) * 100)
                : null,
            akurasi_frame_persen: round(
                mean(
                    list
                        .map(trial => trial.akurasi_frame_persen)
                        .filter(value => typeof value === "number")
                )
            ),
            latency_e2e_rata2_ms: round(weightedMean("latency_e2e_rata2_ms")),
            latency_backend_rata2_ms: round(weightedMean("latency_backend_rata2_ms")),
            fps_klasifikasi_rata2: round(
                mean(
                    list
                        .map(trial => trial.fps_klasifikasi)
                        .filter(value => typeof value === "number")
                )
            ),
            fps_sistem_rata2: round(
                mean(
                    list
                        .map(trial => trial.fps_sistem)
                        .filter(value => typeof value === "number")
                )
            ),
            tidak_stabil: list.filter(trial => !trial.huruf_hasil).length
        };
    }

    function renderSummary() {
        const rows = SCENARIOS.map(scenarioSummary);
        const total = trials.length;
        const correct = trials.filter(trial => trial.benar).length;
        const target = SCENARIOS.length * ALPHABET.length * REPETITIONS;

        progressElement.textContent = `${total} / ${target} percobaan`;

        const fmt = (value, suffix = "") =>
            value === null || value === undefined ? "—" : `${value}${suffix}`;

        let html =
            "<table><thead><tr>" +
            "<th>Skenario</th><th>Uji</th><th>Akurasi</th>" +
            "<th>Latency E2E</th><th>FPS klasifikasi</th></tr></thead><tbody>";

        rows.forEach(row => {
            html +=
                `<tr><td>${row.skenario_id}. ${row.skenario}</td>` +
                `<td>${row.jumlah_percobaan}/${row.target_percobaan}</td>` +
                `<td>${fmt(row.akurasi_realtime_persen, "%")}</td>` +
                `<td>${fmt(row.latency_e2e_rata2_ms, " ms")}</td>` +
                `<td>${fmt(row.fps_klasifikasi_rata2)}</td></tr>`;
        });

        html +=
            `<tr class="summary-total"><td>Keseluruhan</td>` +
            `<td>${total}/${target}</td>` +
            `<td>${total ? round((correct / total) * 100) + "%" : "—"}</td>` +
            `<td colspan="2"></td></tr>`;

        summaryBox.innerHTML = html + "</tbody></table>";
    }

    function renderLast(trial) {
        if (!trial) {
            lastBox.hidden = true;
            return;
        }

        lastBox.hidden = false;
        lastBox.dataset.result = trial.benar ? "ok" : "bad";

        const fmt = (value, suffix = "") =>
            value === null ? "—" : `${value}${suffix}`;

        lastBox.innerHTML =
            `<strong>${trial.huruf_target} (ke-${trial.percobaan_ke}) → ` +
            `${trial.huruf_hasil || "tidak stabil"} · ` +
            `${trial.benar ? "Benar" : "Salah"}</strong>` +
            `<span>Latency E2E rata-rata ${fmt(trial.latency_e2e_rata2_ms, " ms")} · ` +
            `FPS klasifikasi ${fmt(trial.fps_klasifikasi)} · ` +
            `FPS sistem ${fmt(trial.fps_sistem)} · ` +
            `${trial.n_frame_pipeline} frame terklasifikasi, ` +
            `${trial.n_frame_tanpa_tangan} tanpa tangan · ` +
            `akurasi per frame ${fmt(trial.akurasi_frame_persen, "%")}</span>`;
    }

    function renderAll() {
        renderScenarioInfo();
        renderTarget();
        renderGrid();
        renderSummary();
    }

    // =====================================
    // ALUR PERCOBAAN
    // =====================================

    // view: prep | recording | ok | bad | paused | hidden
    function showOverlay(view, { label = "", letter = "", count = "", hint = "" } = {}) {
        if (view === "hidden") {
            overlay.hidden = true;
            return;
        }

        overlay.hidden = false;
        overlay.dataset.view = view;
        ovLabel.textContent = label;
        ovLetter.textContent = letter;
        ovCount.textContent = count;
        ovHint.textContent = hint;
    }

    function setPhase(next, text, detail = "") {
        phase = next;
        stage.dataset.phase = next;
        phaseText.textContent = text;
        phaseDetail.textContent = detail;

        renderControls();
    }

    function renderControls() {
        const busy = phase !== "idle";

        startButton.hidden = busy || auto.on;
        cancelButton.hidden = !busy || auto.on;
        undoButton.disabled = busy || (auto.on && !auto.paused);

        autoButton.textContent = !auto.on
            ? "▶ Mulai Otomatis"
            : auto.paused ? "▶ Lanjutkan" : "❚❚ Jeda";

        // Saat dijeda, form boleh diubah (mis. mengisi kode pengguna).
        [scenarioSelect, userInput, letterSelect, repSelect].forEach(element => {
            element.disabled = busy || (auto.on && !auto.paused);
        });
    }

    function clearTimers() {
        clearTimeout(phaseTimer);
        clearInterval(tickTimer);
        phaseTimer = null;
        tickTimer = null;
    }

    function countdown(totalMs, label, view) {
        const endAt = performance.now() + totalMs;
        const letter = current?.letter || "";

        const tick = () => {
            const left = Math.max(0, endAt - performance.now());
            phaseDetail.textContent = `${label} ${(left / 1000).toFixed(1)} s`;

            showOverlay(view, {
                label: view === "prep" ? "Siapkan gesture" : "● Merekam",
                letter,
                count: String(Math.max(1, Math.ceil(left / 1000))),
                hint: view === "prep"
                    ? "Tahan sampai hitungan merekam selesai"
                    : "Tahan gesture"
            });
        };

        tick();
        tickTimer = setInterval(tick, 100);
    }

    function speakTarget(letter) {
        if (!speakCheck.checked || !("speechSynthesis" in window)) {
            return;
        }

        try {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(`Huruf ${letter}`);
            utterance.lang = "id-ID";
            utterance.rate = 0.9;
            window.speechSynthesis.speak(utterance);
        } catch (error) {
            // Suara gagal tidak boleh menghentikan pengujian.
        }
    }

    // replace: ganti percobaan yang sudah ada tanpa konfirmasi
    // (dipakai tombol R). Mengembalikan false jika gagal dimulai.
    function startTrial({ replace = false } = {}) {
        if (phase !== "idle") return false;

        clearTimeout(resultTimer);
        resultTimer = null;

        const fail = message => {
            setNotice(message);
            if (auto.on) pauseAuto(message);
            return false;
        };

        if (!window.IsyaratCamera?.isRunning()) {
            return fail("Aktifkan kamera terlebih dahulu.");
        }

        if (!window.IsyaratCamera.isBackendAvailable()) {
            return fail("Sistem belum terhubung. Tunggu sampai status menampilkan “Sistem siap”.");
        }

        const scenario = selectedScenario();
        const letter = letterSelect.value;
        const rep = Number(repSelect.value);

        if (scenario.id === 8 && !userInput.value.trim()) {
            userInput.disabled = false;
            userInput.focus();
            return fail("Skenario variasi pengguna: isi kode pengguna terlebih dahulu.");
        }

        if (!replace && findTrial(scenario.id, letter, rep)) {
            const replace = window.confirm(
                `Huruf ${letter} percobaan ke-${rep} pada skenario ini ` +
                "sudah ada. Ganti dengan percobaan baru?"
            );

            if (!replace) return false;
        }

        setNotice("");

        current = {
            scenario,
            letter,
            rep,
            user: userInput.value.trim(),
            frames: [],
            startedAt: null
        };

        renderTarget();
        renderGrid();
        setPhase("prep", `Siapkan gesture huruf ${letter}`);
        countdown(PREP_MS, "Pencatatan dimulai dalam", "prep");
        speakTarget(letter);

        phaseTimer = setTimeout(beginRecording, PREP_MS);
        return true;
    }

    function beginRecording() {
        clearTimers();

        // Huruf stabil dari fase persiapan tidak dibawa
        // ke jendela pencatatan.
        window.IsyaratPractice?.resetSession(
            `Pengujian huruf ${current.letter} sedang berlangsung.`
        );

        current.startedAt = performance.now();
        current.startedClock = new Date();

        setPhase("recording", `Merekam huruf ${current.letter}`);
        countdown(TRIAL_MS, "Sisa waktu", "recording");

        phaseTimer = setTimeout(finishTrial, TRIAL_MS);
    }

    function cancelTrial() {
        clearTimers();
        current = null;
        setPhase("idle", "Dibatalkan", "Percobaan tidak disimpan.");
        if (!auto.on) showOverlay("hidden");
    }

    // =====================================
    // MODE OTOMATIS
    // =====================================

    function startAuto() {
        if (auto.on || phase !== "idle") return;

        if (!nextSlot(selectedScenario().id)) {
            setNotice("Skenario ini sudah lengkap. Pilih skenario lain.");
            return;
        }

        goToNextSlot();
        auto.on = true;
        auto.paused = false;
        renderControls();

        if (!startTrial()) return;
        setNotice("Mode otomatis berjalan. Spasi = jeda, Esc = berhenti.");
    }

    // Percobaan yang sedang berjalan dibatalkan (tidak disimpan)
    // lalu diulang dari awal saat dilanjutkan.
    function pauseAuto(reason = "Dijeda.") {
        if (!auto.on || auto.paused) return;

        clearTimeout(resultTimer);
        resultTimer = null;

        if (phase !== "idle") cancelTrial();

        auto.paused = true;
        renderControls();
        setPhase("idle", "Dijeda", reason);
        showOverlay("paused", {
            label: "Dijeda",
            letter: letterSelect.value,
            hint: "Tekan Spasi untuk melanjutkan"
        });
    }

    function resumeAuto() {
        if (!auto.on || !auto.paused) return;

        auto.paused = false;
        renderControls();

        if (startTrial()) {
            setNotice("Mode otomatis dilanjutkan.");
        }
    }

    function stopAuto(message = "Mode otomatis dihentikan.") {
        clearTimeout(resultTimer);
        resultTimer = null;

        const wasRunning = phase !== "idle";

        auto.on = false;
        auto.paused = false;

        if (wasRunning) cancelTrial();

        renderControls();
        showOverlay("hidden");
        setNotice(message);
    }

    // Ulangi percobaan terakhir (mis. gesture terlambat dibentuk).
    function repeatLast() {
        if (phase !== "idle" || !trials.length) return;

        const last = trials[trials.length - 1];

        clearTimeout(resultTimer);
        resultTimer = null;

        scenarioSelect.value = last.skenario_id;
        letterSelect.value = last.huruf_target;
        repSelect.value = last.percobaan_ke;
        renderScenarioInfo();

        if (auto.on) auto.paused = false;
        renderControls();

        startTrial({ replace: true });
    }

    function toggleAuto() {
        if (!auto.on) startAuto();
        else if (auto.paused) resumeAuto();
        else pauseAuto("Dijeda oleh penguji.");
    }

    function onFrame(frame) {
        if (phase !== "recording" || !current) {
            return;
        }

        // Frame yang diambil sebelum jendela dimulai membawa
        // status stabilizer dari fase persiapan, jadi diabaikan.
        if (frame.capturedAt < current.startedAt) {
            return;
        }

        const tMs = performance.now() - current.startedAt;

        if (tMs > TRIAL_MS) {
            return;
        }

        current.frames.push({ ...frame, tMs });
    }

    function finishTrial() {
        clearTimers();

        // Tanpa satu pun respons backend, percobaan tidak sah
        // (bukan prediksi salah) sehingga tidak disimpan.
        if (!current.frames.length) {
            current = null;
            setPhase(
                "idle",
                "Tidak sah",
                "Tidak ada frame yang tercatat. Percobaan tidak disimpan."
            );
            const message =
                "Tidak ada respons backend selama jendela pencatatan. " +
                "Periksa koneksi backend lalu ulangi percobaan.";
            setNotice(message);

            if (auto.on) {
                pauseAuto(message);
            } else {
                showOverlay("hidden");
            }
            return;
        }

        const trial = summarizeTrial(current);

        trials = trials.filter(item => !(
            item.skenario_id === trial.skenario_id &&
            item.huruf_target === trial.huruf_target &&
            item.percobaan_ke === trial.percobaan_ke
        ));

        trials.push(trial);
        saveTrials();

        current.frames.forEach((frame, index) => {
            sessionFrames.push(frameRow(trial, frame, index + 1));
        });

        current = null;

        setPhase(
            "idle",
            trial.benar ? "Benar" : "Salah",
            `Target ${trial.huruf_target}, hasil ${trial.huruf_hasil || "tidak stabil"}`
        );

        renderLast(trial);
        goToNextSlot();
        renderGrid();
        renderSummary();

        showOverlay(trial.benar ? "ok" : "bad", {
            label: trial.benar ? "✓ Benar" : "✗ Salah",
            letter: trial.huruf_target,
            hint: trial.benar
                ? ""
                : `Terbaca: ${trial.huruf_hasil || "tidak stabil"}`
        });

        const done = !nextSlot(trial.skenario_id);

        if (done) {
            const message =
                `Skenario ${trial.skenario_id} selesai (78 percobaan). ` +
                "Ekspor CSV, lalu pilih skenario berikutnya.";

            if (auto.on) {
                resultTimer = setTimeout(() => stopAuto(message), RESULT_MS);
            } else {
                setNotice(message);
                resultTimer = setTimeout(() => showOverlay("hidden"), RESULT_MS);
            }
            return;
        }

        // Mode otomatis: lanjut ke huruf berikutnya setelah jeda hasil.
        resultTimer = setTimeout(() => {
            resultTimer = null;

            if (auto.on && !auto.paused) {
                startTrial();
            } else if (!auto.on) {
                showOverlay("hidden");
            }
        }, RESULT_MS);
    }

    function summarizeTrial(run) {
        const frames = run.frames;

        // Frame yang melewati deteksi + klasifikasi
        const pipeline = frames.filter(frame => frame.status === "success");
        const noHand = frames.filter(frame => frame.status === "no_hand");

        // Hanya frame yang waktu tampilnya benar-benar terukur
        const e2e = pipeline
            .map(frame => frame.e2eMs)
            .filter(value => typeof value === "number");
        const backend = pipeline
            .map(frame => frame.processingMs)
            .filter(value => typeof value === "number");
        const detection = pipeline
            .map(frame => frame.detectionMs)
            .filter(value => typeof value === "number");
        const inference = pipeline
            .map(frame => frame.inferenceMs)
            .filter(value => typeof value === "number");
        const network = pipeline
            .filter(frame => typeof frame.processingMs === "number")
            .map(frame => frame.requestMs - frame.processingMs);

        const rawCorrect = pipeline.filter(
            frame => frame.letter === run.letter
        ).length;

        const lowConfidence = pipeline.filter(frame =>
            typeof frame.confidence === "number" &&
            typeof SYSTEM.minConfidence === "number" &&
            frame.confidence < SYSTEM.minConfidence
        ).length;

        const firstStable = frames.find(frame => frame.stableLetter);
        const lastFrame = frames[frames.length - 1];
        const finalLetter = lastFrame?.stableLetter || null;

        // Distribusi prediksi mentah, mis. "C:12|U:3"
        const counts = {};
        pipeline.forEach(frame => {
            counts[frame.letter] = (counts[frame.letter] || 0) + 1;
        });

        const distribution = Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .map(([letter, count]) => `${letter}:${count}`)
            .join("|");

        return {
            waktu: run.startedClock.toISOString(),
            skenario_id: run.scenario.id,
            skenario: run.scenario.name,
            pencahayaan: run.scenario.lighting,
            latar: run.scenario.background,
            kondisi_input: run.scenario.input,
            status_cahaya_terukur: window.getLightingStatus?.() || "",
            kode_pengguna: run.user,
            huruf_target: run.letter,
            percobaan_ke: run.rep,
            huruf_hasil: finalLetter,
            keyakinan_hasil: round(lastFrame?.stableConfidence ?? null, 4),
            benar: finalLetter === run.letter,
            huruf_stabil_pertama: firstStable?.stableLetter || null,
            waktu_stabil_pertama_ms: round(firstStable?.tMs ?? null, 0),
            n_frame_total: frames.length,
            n_frame_pipeline: pipeline.length,
            n_frame_tanpa_tangan: noHand.length,
            n_frame_keyakinan_rendah: lowConfidence,
            n_frame_latency_terukur: e2e.length,
            akurasi_frame_persen: pipeline.length
                ? round((rawCorrect / pipeline.length) * 100)
                : null,
            distribusi_prediksi: distribution,
            latency_e2e_rata2_ms: round(mean(e2e)),
            latency_e2e_median_ms: round(percentile(e2e, 0.5)),
            latency_e2e_p95_ms: round(percentile(e2e, 0.95)),
            latency_e2e_min_ms: round(e2e.length ? Math.min(...e2e) : null),
            latency_e2e_max_ms: round(e2e.length ? Math.max(...e2e) : null),
            latency_backend_rata2_ms: round(mean(backend)),
            latency_mediapipe_rata2_ms: round(mean(detection)),
            latency_cnn_rata2_ms: round(mean(inference)),
            latency_jaringan_rata2_ms: round(mean(network)),
            // FPS klasifikasi: frame success (deteksi + klasifikasi).
            fps_klasifikasi: round(pipeline.length / (TRIAL_MS / 1000)),
            // FPS sistem (throughput): semua respons valid, termasuk
            // no_hand dan no_prediction.
            fps_sistem: round(frames.length / (TRIAL_MS / 1000)),
            resolusi_frame: lastFrame
                ? `${lastFrame.frameWidth}x${lastFrame.frameHeight}`
                : "",
            durasi_jendela_ms: TRIAL_MS,
            stabilizer: `${SYSTEM.stableMinVotes}/${SYSTEM.stableWindow}`,
            ambang_keyakinan: SYSTEM.minConfidence,
            user_agent: navigator.userAgent
        };
    }

    function frameRow(trial, frame, index) {
        return {
            skenario_id: trial.skenario_id,
            kode_pengguna: trial.kode_pengguna,
            huruf_target: trial.huruf_target,
            percobaan_ke: trial.percobaan_ke,
            frame_ke: index,
            t_ms: round(frame.tMs, 1),
            status: frame.status,
            jumlah_tangan: frame.hands,
            prediksi: frame.letter,
            keyakinan: round(frame.confidence, 4),
            keyakinan_rendah:
                typeof frame.confidence === "number" &&
                typeof SYSTEM.minConfidence === "number"
                    ? frame.confidence < SYSTEM.minConfidence
                    : null,
            huruf_stabil: frame.stableLetter,
            capture_ms: round(frame.captureMs),
            request_ms: round(frame.requestMs),
            backend_ms: round(frame.processingMs),
            mediapipe_ms: round(frame.detectionMs),
            cnn_ms: round(frame.inferenceMs),
            render_ms: round(frame.renderMs),
            e2e_ms: round(frame.e2eMs),
            paint_terukur: frame.paintMeasured
        };
    }

    // =====================================
    // EKSPOR CSV
    // =====================================

    function toCsv(rows) {
        if (!rows.length) return "";

        const headers = Object.keys(rows[0]);

        const escape = value => {
            if (value === null || value === undefined) return "";

            const text = String(value);

            return /[",\n;]/.test(text)
                ? `"${text.replace(/"/g, '""')}"`
                : text;
        };

        return [
            headers.join(","),
            ...rows.map(row => headers.map(key => escape(row[key])).join(","))
        ].join("\n");
    }

    function download(rows, name) {
        if (!rows.length) {
            setNotice("Belum ada data untuk diekspor.");
            return;
        }

        const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

        // BOM agar Excel membaca UTF-8 dengan benar.
        const blob = new Blob(["﻿" + toCsv(rows)], {
            type: "text/csv;charset=utf-8"
        });

        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `isyaratku_${name}_${stamp}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    }

    // =====================================
    // EVENT
    // =====================================

    scenarioSelect.addEventListener("change", () => {
        goToNextSlot();
        renderScenarioInfo();
        renderGrid();
        setNotice("");
    });

    letterSelect.addEventListener("change", () => {
        renderTarget();
        renderGrid();
    });

    repSelect.addEventListener("change", renderGrid);

    grid.addEventListener("click", event => {
        const cell = event.target.closest("td[data-letter]");

        if (!cell || phase !== "idle") return;

        letterSelect.value = cell.dataset.letter;
        repSelect.value = cell.dataset.rep;
        renderTarget();
        renderGrid();
    });

    startButton.addEventListener("click", () => startTrial());
    cancelButton.addEventListener("click", cancelTrial);
    autoButton.addEventListener("click", toggleAuto);

    // Kontrol keyboard agar tangan penguji tetap bebas.
    document.addEventListener("keydown", event => {
        const tag = event.target?.tagName;

        if (
            event.ctrlKey || event.altKey || event.metaKey ||
            ["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(tag) ||
            document.querySelector("dialog[open]")
        ) {
            return;
        }

        if (event.code === "Space") {
            event.preventDefault();
            toggleAuto();
        } else if (event.key === "Escape") {
            if (auto.on) stopAuto();
            else if (phase !== "idle") cancelTrial();
        } else if (event.key === "r" || event.key === "R") {
            repeatLast();
        }
    });

    // Tab ditinggal atau diminimalkan: kamera/animasi tidak
    // berjalan normal, jadi mode otomatis dijeda.
    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) return;

        if (auto.on) {
            pauseAuto("Dijeda karena tab browser ditinggalkan.");
        } else if (phase !== "idle") {
            cancelTrial();
            setNotice("Percobaan dibatalkan karena tab browser ditinggalkan.");
        }
    });

    undoButton.addEventListener("click", () => {
        if (!trials.length) return;

        const last = trials[trials.length - 1];

        if (!window.confirm(
            `Hapus percobaan ${last.huruf_target} ke-${last.percobaan_ke} ` +
            `(skenario ${last.skenario_id})?`
        )) return;

        trials.pop();
        saveTrials();

        sessionFrames = sessionFrames.filter(row => !(
            row.skenario_id === last.skenario_id &&
            row.huruf_target === last.huruf_target &&
            row.percobaan_ke === last.percobaan_ke
        ));

        scenarioSelect.value = last.skenario_id;
        letterSelect.value = last.huruf_target;
        repSelect.value = last.percobaan_ke;

        renderLast(null);
        renderAll();
        setNotice("Percobaan terakhir dihapus.");
    });

    byId("exportTrials").addEventListener("click", () => {
        download(trials, "percobaan");
    });

    byId("exportSummary").addEventListener("click", () => {
        download(SCENARIOS.map(scenarioSummary), "ringkasan_skenario");
    });

    byId("exportFrames").addEventListener("click", () => {
        download(sessionFrames, "frame");
    });

    byId("testReset").addEventListener("click", () => {
        if (!window.confirm(
            "Hapus SEMUA data percobaan yang tersimpan di browser ini? " +
            "Ekspor CSV terlebih dahulu jika masih dibutuhkan."
        )) return;

        trials = [];
        sessionFrames = [];
        saveTrials();
        renderLast(null);
        goToNextSlot();
        renderAll();
        setNotice("Semua data percobaan dihapus.");
    });

    // Kamera berhenti saat merekam: percobaan dibatalkan,
    // mode otomatis dijeda. Listener ini berjalan setelah
    // webcam.js, jadi isRunning() sudah bernilai baru.
    document.getElementById("start-camera")?.addEventListener("click", () => {
        if (window.IsyaratCamera?.isRunning()) return;

        if (auto.on) {
            pauseAuto("Kamera dihentikan.");
        } else if (phase !== "idle") {
            cancelTrial();
            setNotice("Kamera dihentikan, percobaan dibatalkan.");
        }
    });

    // =====================================
    // INISIALISASI
    // =====================================

    goToNextSlot();
    renderAll();

    window.IsyaratTest = {
        onFrame,
        getTrials: () => trials.slice(),
        getFrames: () => sessionFrames.slice(),
        protocol: { PREP_MS, TRIAL_MS, REPETITIONS, SCENARIOS }
    };

    console.log("IsyaratKu Mode Pengujian aktif.");
})();
