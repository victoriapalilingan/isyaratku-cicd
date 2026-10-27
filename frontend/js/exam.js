/* =========================================
   ISYARATKU - MODE UJIAN
   praktik.html?ujian=A-I | J-R | S-Z | ALL

   - Kelompok: semua huruf kelompok, urutan acak.
   - ALL (campuran): 10 huruf acak dari A–Z.
   - Tiap soal: bersiap 3 detik, lalu 10 detik untuk
     memperagakan huruf tanpa foto contoh. Benar jika
     huruf stabil (stabilizer 4/7) sama dengan soal.
   - Setelah selesai, huruf yang salah bisa dilatih
     ulang sampai semuanya benar.

   Kamera, MediaPipe, dan stabilizer dipakai apa adanya.
   Tidak aktif bersama mode pengujian ?uji=1.
   ========================================= */

(function () {
    "use strict";

    const params = new URLSearchParams(window.location.search);
    const examId = (params.get("ujian") || "").toUpperCase();

    if (!examId || params.get("uji") === "1") return;

    const progress = window.IsyaratProgress;
    const practice = window.IsyaratPractice;
    const camera = () => window.IsyaratCamera;

    if (!progress || !practice) return;

    const EXAMS = ["A-I", "J-R", "S-Z", "ALL"];
    const MIXED_QUESTIONS = 10;
    const PREP_MS = 3000;
    const ANSWER_MS = 10000;
    const FEEDBACK_MS = 1600;

    const valid = EXAMS.includes(examId);
    const label = valid ? progress.examLabel(examId) : "";

    document.body.classList.add("exam-mode");
    if (valid) document.title = `Ujian ${label} - IsyaratKu`;

    const heading = document.querySelector(".intro-copy h1");
    const lead = document.querySelector(".intro-copy p");
    if (heading) heading.textContent = valid ? `Ujian ${label}` : "Ujian";
    if (lead) {
        lead.textContent =
            "Peragakan huruf yang muncul tanpa melihat contoh. " +
            "Tahan gesture sampai sistem mengenalinya sebelum waktu habis.";
    }

    /* ----- Elemen ----- */

    const panel = document.createElement("section");
    panel.className = "exam-panel";
    panel.setAttribute("aria-labelledby", "examTitle");
    panel.innerHTML = `
        <div class="exam-head">
            <div>
                <span class="exam-eyebrow">Mode ujian</span>
                <h2 id="examTitle"></h2>
            </div>
            <span class="exam-counter" id="examCounter"></span>
        </div>
        <div class="exam-body" id="examBody" aria-live="polite"></div>
    `;

    document.querySelector(".result-section")?.prepend(panel);

    const overlay = document.createElement("div");
    overlay.className = "exam-overlay";
    overlay.hidden = true;
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
        <span class="exam-ov-label"></span>
        <span class="exam-ov-letter"></span>
        <span class="exam-ov-count"></span>
    `;
    document.getElementById("camera-container")?.appendChild(overlay);

    const title = panel.querySelector("#examTitle");
    const counter = panel.querySelector("#examCounter");
    const body = panel.querySelector("#examBody");
    const ovLabel = overlay.querySelector(".exam-ov-label");
    const ovLetter = overlay.querySelector(".exam-ov-letter");
    const ovCount = overlay.querySelector(".exam-ov-count");

    title.textContent = valid ? `Ujian ${label}` : "Ujian tidak ditemukan";

    /* ----- Status ujian ----- */

    let questions = [];   // huruf putaran ini
    let answers = [];     // { letter, correct, detected }
    let index = 0;
    let round = 1;        // 1 = ujian penuh, >1 = latihan ulang
    let phase = "idle";   // idle | prep | answer | feedback
    let detected = null;
    let token = 0;        // membatalkan timer soal yang sudah lewat
    let tick = null;

    function shuffle(list) {
        const copy = list.slice();
        for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
    }

    function examQuestions() {
        const letters = shuffle(progress.examLetters(examId));
        return examId === "ALL" ? letters.slice(0, MIXED_QUESTIONS) : letters;
    }

    function wait(ms, id) {
        return new Promise((resolve, reject) => {
            setTimeout(() => (id === token ? resolve() : reject()), ms);
        });
    }

    function stopTimers() {
        token++;
        clearInterval(tick);
        tick = null;
    }

    function showOverlay(view, labelText = "", letter = "", count = "") {
        overlay.hidden = view === "hidden";
        overlay.dataset.view = view;
        ovLabel.textContent = labelText;
        ovLetter.textContent = letter;
        ovCount.textContent = count;
    }

    function button(text, className, onClick) {
        const el = document.createElement("button");
        el.type = "button";
        el.className = `btn ${className}`;
        el.textContent = text;
        el.addEventListener("click", onClick);
        return el;
    }

    function link(text, href, className = "btn btn-ghost") {
        const el = document.createElement("a");
        el.className = className;
        el.href = href;
        el.textContent = text;
        return el;
    }

    function paragraph(text, className = "") {
        const el = document.createElement("p");
        if (className) el.className = className;
        el.textContent = text;
        return el;
    }

    function actions(...items) {
        const row = document.createElement("div");
        row.className = "exam-actions";
        row.append(...items);
        return row;
    }

    /* ----- Tampilan ----- */

    function renderLocked() {
        panel.dataset.view = "locked";
        counter.textContent = "🔒 Terkunci";

        if (!valid) {
            body.replaceChildren(
                paragraph("Pilih ujian dari dashboard."),
                actions(link("Ke dashboard", "home.html#ujian", "btn btn-primary"))
            );
            return;
        }

        const missing = progress.examLocked(examId);
        const list = document.createElement("div");
        list.className = "exam-letters";
        missing.forEach(letter => {
            list.appendChild(link(letter, `praktik.html?huruf=${letter}`, "exam-chip"));
        });

        body.replaceChildren(
            paragraph(
                examId === "ALL"
                    ? "Ujian campuran terbuka setelah semua 26 huruf berhasil dipraktikkan."
                    : `Ujian ini terbuka setelah semua huruf ${label} berhasil dipraktikkan.`
            ),
            paragraph(`Masih ${missing.length} huruf lagi. Pilih huruf untuk berlatih:`, "exam-muted"),
            list,
            actions(link("Kembali ke dashboard", "home.html#ujian"))
        );
    }

    function renderIntro(message = "") {
        panel.dataset.view = "intro";
        phase = "idle";
        showOverlay("hidden");

        const count = examId === "ALL"
            ? MIXED_QUESTIONS
            : progress.examLetters(examId).length;
        const result = progress.examResult(examId);
        counter.textContent = `${count} soal`;

        const rules = document.createElement("ul");
        rules.className = "exam-rules";
        [
            `${count} huruf acak dari ${label}, tanpa foto contoh.`,
            "Setiap huruf: 3 detik bersiap, lalu 10 detik untuk memperagakannya.",
            "Benar jika sistem mengenali huruf itu dengan stabil sebelum waktu habis.",
            "Huruf yang salah bisa dilatih ulang setelah ujian selesai."
        ].forEach(text => {
            const item = document.createElement("li");
            item.textContent = text;
            rules.appendChild(item);
        });

        const nodes = [rules];

        if (result) {
            nodes.push(paragraph(
                `Skor terbaik: ${result.best}/${result.total} · terakhir ${result.last}/${result.total}`,
                "exam-best"
            ));
        }

        if (message) nodes.push(paragraph(message, "exam-notice"));

        const start = button("Mulai ujian", "btn-primary", () => beginRound(examQuestions(), 1));
        nodes.push(actions(start, link("Kembali ke dashboard", "home.html#ujian")));

        body.replaceChildren(...nodes);
    }

    function renderRunning() {
        panel.dataset.view = "running";

        const dots = document.createElement("ol");
        dots.className = "exam-dots";
        dots.setAttribute("aria-label", "Soal");

        questions.forEach((letter, i) => {
            const dot = document.createElement("li");
            const answer = answers[i];
            dot.textContent = answer ? letter : i + 1;
            dot.dataset.state = answer
                ? (answer.correct ? "ok" : "bad")
                : i === index ? "current" : "pending";
            dots.appendChild(dot);
        });

        const current = document.createElement("div");
        current.className = "exam-current";
        current.innerHTML = `
            <span class="exam-current-label" id="examPhase"></span>
            <strong class="exam-current-letter" id="examLetter"></strong>
            <div class="exam-timer"><span id="examTimer"></span></div>
        `;

        const stop = button("Hentikan ujian", "btn-quiet", () => {
            stopTimers();
            finishCleanup();
            renderIntro("Ujian dihentikan. Hasilnya tidak disimpan.");
        });

        body.replaceChildren(dots, current, actions(stop));

        counter.textContent = round > 1
            ? `Latihan ulang · ${index + 1}/${questions.length}`
            : `Soal ${index + 1}/${questions.length}`;
    }

    function setCurrent(phaseText, letter, fraction, state) {
        const phaseEl = document.getElementById("examPhase");
        const letterEl = document.getElementById("examLetter");
        const timer = document.getElementById("examTimer");
        if (!phaseEl) return;

        phaseEl.textContent = phaseText;
        letterEl.textContent = letter;
        timer.style.width = `${Math.max(0, Math.min(1, fraction)) * 100}%`;
        panel.querySelector(".exam-current").dataset.state = state;
    }

    function renderPaused(message) {
        panel.dataset.view = "paused";
        showOverlay("paused", "Dijeda", "", "");
        counter.textContent = `Soal ${index + 1}/${questions.length}`;

        body.replaceChildren(
            paragraph(message, "exam-notice"),
            paragraph("Soal yang sedang berjalan akan diulang dari awal.", "exam-muted"),
            actions(
                button("Lanjutkan", "btn-primary", () => resume()),
                button("Hentikan ujian", "btn-quiet", () => {
                    finishCleanup();
                    renderIntro("Ujian dihentikan. Hasilnya tidak disimpan.");
                })
            )
        );
    }

    function renderResult() {
        panel.dataset.view = "result";
        showOverlay("hidden");

        const correct = answers.filter(item => item.correct).length;
        const wrong = answers.filter(item => !item.correct);
        const total = answers.length;

        counter.textContent = round > 1 ? "Latihan ulang selesai" : "Selesai";

        const score = document.createElement("div");
        score.className = "exam-score";
        score.dataset.state = wrong.length ? "partial" : "perfect";
        score.innerHTML = `<strong>${correct}/${total}</strong><span></span>`;
        score.querySelector("span").textContent = wrong.length === 0
            ? round > 1
                ? "Semua huruf yang tadi salah sekarang sudah benar!"
                : "Sempurna! Semua huruf benar."
            : `${wrong.length} huruf perlu dilatih lagi.`;

        const nodes = [score];

        if (wrong.length) {
            const list = document.createElement("ul");
            list.className = "exam-wrong";

            wrong.forEach(item => {
                const row = document.createElement("li");

                const letter = document.createElement("strong");
                letter.textContent = item.letter;

                const note = document.createElement("span");
                note.textContent = item.detected
                    ? `terdeteksi ${item.detected}`
                    : "tidak terdeteksi";

                row.append(
                    letter,
                    note,
                    link("Lihat contoh", `huruf.html?huruf=${item.letter}`, "exam-link")
                );
                list.appendChild(row);
            });

            nodes.push(list);
            nodes.push(actions(
                button(
                    `Latihan huruf yang salah (${wrong.length})`,
                    "btn-primary",
                    () => beginRound(shuffle(wrong.map(item => item.letter)), round + 1)
                ),
                button("Ulangi ujian", "btn-ghost", () => beginRound(examQuestions(), 1)),
                link("Dashboard", "home.html#ujian", "btn btn-quiet")
            ));
        } else {
            nodes.push(actions(
                button("Ulangi ujian", "btn-primary", () => beginRound(examQuestions(), 1)),
                link("Kembali ke dashboard", "home.html#ujian")
            ));
        }

        body.replaceChildren(...nodes);
    }

    /* ----- Jalannya ujian ----- */

    async function ensureCamera() {
        if (camera()?.isRunning()) return true;

        body.replaceChildren(paragraph("Membuka kamera…", "exam-muted"));
        camera()?.start();

        const until = performance.now() + 15000;
        while (performance.now() < until) {
            if (camera()?.isRunning()) return true;
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        return false;
    }

    async function beginRound(letters, roundNumber) {
        stopTimers();

        if (!(await ensureCamera())) {
            renderIntro("Kamera belum aktif. Izinkan akses kamera lalu coba lagi.");
            return;
        }

        questions = letters;
        answers = [];
        index = 0;
        round = roundNumber;

        document.getElementById("camera-container")
            ?.scrollIntoView({ behavior: "smooth", block: "start" });

        runQuestion();
    }

    function countdown(ms, id, onTick) {
        const startedAt = performance.now();
        clearInterval(tick);
        tick = setInterval(() => {
            if (id !== token) return;
            const left = Math.max(0, ms - (performance.now() - startedAt));
            onTick(left);
        }, 100);
        onTick(ms);
    }

    async function runQuestion() {
        const id = ++token;
        const letter = questions[index];
        detected = null;

        renderRunning();

        // Target dipasang agar hasil prediksi dibandingkan dengan soal.
        practice.chooseLetter(letter);
        practice.resetSession(`Bersiap: huruf ${letter}.`);

        try {
            phase = "prep";
            countdown(PREP_MS, id, left => {
                const seconds = Math.ceil(left / 1000);
                showOverlay("prep", "Bersiap", letter, seconds || "");
                setCurrent("Bersiap…", letter, left / PREP_MS, "prep");
            });
            await wait(PREP_MS, id);

            // Stabilizer dimulai ulang tepat saat waktu menjawab mulai,
            // sehingga frame saat bersiap tidak ikut dinilai.
            phase = "answer";
            practice.resetSession(`Peragakan huruf ${letter}.`);

            countdown(ANSWER_MS, id, left => {
                const seconds = Math.ceil(left / 1000);
                showOverlay("answer", "Peragakan", letter, seconds);
                setCurrent("Peragakan huruf", letter, left / ANSWER_MS, "answer");
            });
            await wait(ANSWER_MS, id);

            answer(false);
        } catch {
            // Soal dibatalkan (jawaban benar, jeda, atau dihentikan).
        }
    }

    async function answer(correct) {
        if (phase !== "answer") return;

        const id = ++token;
        clearInterval(tick);
        phase = "feedback";

        const letter = questions[index];
        answers[index] = { letter, correct, detected: correct ? letter : detected };
        progress.recordAnswer(letter, correct);

        showOverlay(
            correct ? "ok" : "bad",
            correct ? "Benar!" : "Waktu habis",
            letter,
            correct ? "✓" : "✗"
        );
        setCurrent(
            correct ? "Benar!" : detected ? `Salah · terdeteksi ${detected}` : "Waktu habis",
            letter,
            0,
            correct ? "ok" : "bad"
        );

        try {
            await wait(FEEDBACK_MS, id);
        } catch {
            return;
        }

        index++;

        if (index < questions.length) {
            runQuestion();
            return;
        }

        completeRound();
    }

    function completeRound() {
        if (round === 1) {
            progress.recordExam(examId, {
                correct: answers.filter(item => item.correct).length,
                total: answers.length,
                wrong: answers.filter(item => !item.correct).map(item => item.letter)
            });
        }

        finishCleanup();
        renderResult();
    }

    function finishCleanup() {
        stopTimers();
        phase = "idle";
        showOverlay("hidden");
        practice.chooseLetter(null);
        practice.resetSession("Mode ujian. Tekan Mulai ujian untuk memulai.");
    }

    function pause(message) {
        if (phase !== "prep" && phase !== "answer" && phase !== "feedback") return;

        // Jawaban yang sudah dinilai tetap disimpan; soal berikutnya
        // dilanjutkan setelah jeda.
        if (phase === "feedback") index++;

        stopTimers();
        phase = "idle";

        if (index >= questions.length) {
            completeRound();
            return;
        }

        renderPaused(message);
    }

    async function resume() {
        if (!(await ensureCamera())) {
            renderPaused("Kamera belum aktif. Izinkan akses kamera lalu coba lagi.");
            return;
        }
        runQuestion();
    }

    /* ----- Event ----- */

    document.addEventListener("isyarat:stable", event => {
        if (phase !== "answer") return;

        const { letter } = event.detail;
        if (letter === questions[index]) {
            answer(true);
        } else {
            detected = letter;
        }
    });

    document.addEventListener("visibilitychange", () => {
        if (document.hidden) pause("Ujian dijeda karena tab browser ditinggalkan.");
    });

    // Listener ini berjalan setelah webcam.js, jadi isRunning()
    // sudah bernilai baru saat tombol kamera ditekan.
    document.getElementById("start-camera")?.addEventListener("click", () => {
        if (!camera()?.isRunning()) pause("Kamera dihentikan.");
    });

    // Tidak boleh mengganti huruf saat ujian.
    const selectButton = document.getElementById("selectLetterButton");
    if (selectButton) selectButton.style.display = "none";

    if (valid && progress.isExamOpen(examId)) {
        practice.chooseLetter(null);
        renderIntro();
    } else {
        renderLocked();
    }
})();
