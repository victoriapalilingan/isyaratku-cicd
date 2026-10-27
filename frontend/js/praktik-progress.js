/* =========================================
   ISYARATKU - PROGRES DI HALAMAN PRAKTIK
   Huruf stabil == huruf target -> status
   "Dipraktikkan" + tombol huruf berikutnya.
   Tidak aktif sama sekali pada ?uji=1.
   ========================================= */

(function () {
    "use strict";

    const progress = window.IsyaratProgress;
    const practice = window.IsyaratPractice;

    // Mode ujian (?ujian=) punya penilaian sendiri di exam.js.
    const examMode = new URLSearchParams(window.location.search).has("ujian");

    if (!progress || !practice || progress.readOnly || examMode) return;

    const byId = id => document.getElementById(id);

    const card = byId("targetCard");
    const photo = byId("targetPhoto");
    const letterEl = byId("targetLetter");
    const guide = byId("targetGuide");
    const statusEl = byId("targetStatus");
    const success = byId("practiceSuccess");
    const successTitle = byId("successTitle");
    const successText = byId("successText");
    const nextButton = byId("nextLetterButton");

    const STATUS_TEXT = {
        new: "Belum",
        viewed: "Dipahami",
        practiced: "Dipraktikkan"
    };

    let nextLetter = null;

    function renderTarget() {
        const target = practice.getSelectedLetter();

        success.hidden = true;
        card.hidden = !target;
        if (!target) return;

        letterEl.textContent = target;
        guide.href = `huruf.html?huruf=${target}`;

        const status = progress.statusOf(target);
        statusEl.dataset.status = status;
        statusEl.textContent = STATUS_TEXT[status];

        photo.hidden = true;
        photo.alt = `Contoh gesture huruf ${target}`;
        photo.onload = () => { photo.hidden = false; };
        photo.onerror = () => { photo.hidden = true; };
        photo.src = `assets/bisindo/${target}.jpg`;

        progress.setLastLetter(target);
    }

    function showSuccess(letter) {
        nextLetter = progress.letterAfter(letter);

        successTitle.textContent = `Berhasil! Huruf ${letter} dikenali.`;
        successText.textContent = nextLetter
            ? "Tersimpan di progresmu. Siap lanjut?"
            : "Tersimpan di progresmu. Kamu sudah sampai huruf Z!";

        nextButton.textContent = nextLetter
            ? `Huruf berikutnya: ${nextLetter} →`
            : "Lihat progres →";

        success.hidden = false;
    }

    document.addEventListener("isyarat:stable", event => {
        const { letter, target, confidence } = event.detail;
        if (!target || letter !== target) return;

        progress.markPracticed(letter, confidence);
        renderTarget();
        showSuccess(letter);
    });

    document.addEventListener("isyarat:target", renderTarget);

    // Ganti target tanpa memuat ulang halaman, sehingga kamera tetap
    // menyala. Sesi direset agar frame huruf lama tidak terbawa.
    nextButton.addEventListener("click", () => {
        if (!nextLetter) {
            window.location.href = "home.html#progres";
            return;
        }

        practice.chooseLetter(nextLetter);
        practice.resetSession(
            `Huruf target sekarang ${nextLetter}. Siapkan gesture-nya.`
        );
    });

    renderTarget();
})();
