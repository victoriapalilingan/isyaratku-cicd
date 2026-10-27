/* =========================================
   ISYARATKU - DASHBOARD BELAJAR
   ========================================= */

document.addEventListener("DOMContentLoaded", () => {
    "use strict";

    const progress = window.IsyaratProgress;
    const byId = id => document.getElementById(id);

    const STATUS_LABEL = {
        new: "belum dipelajari",
        viewed: "sudah dipahami",
        practiced: "berhasil dipraktikkan"
    };

    // Lingkaran SVG: panjang busur sesuai porsi huruf.
    function setRing(circle, value, total) {
        const length = 2 * Math.PI * Number(circle.getAttribute("r"));
        circle.style.strokeDasharray = `${length}`;
        circle.style.strokeDashoffset = `${length * (1 - value / total)}`;
    }

    function renderGroups() {
        const container = byId("groups");
        const fragment = document.createDocumentFragment();

        progress.GROUPS.forEach(group => {
            const done = group.letters
                .filter(letter => progress.statusOf(letter) !== "new").length;

            const card = document.createElement("article");
            card.className = "group";

            const head = document.createElement("div");
            head.className = "group-head";

            const title = document.createElement("h3");
            title.textContent = `Kelompok ${group.label}`;

            const count = document.createElement("span");
            count.textContent = `${done}/${group.letters.length}`;

            head.append(title, count);

            const bar = document.createElement("div");
            bar.className = "progress-bar";
            const fill = document.createElement("span");
            fill.style.width = `${(done / group.letters.length) * 100}%`;
            bar.appendChild(fill);

            const tiles = document.createElement("div");
            tiles.className = "group-tiles";

            group.letters.forEach(letter => {
                const status = progress.statusOf(letter);
                const tile = document.createElement("a");
                tile.className = "letter-tile";
                tile.href = `huruf.html?huruf=${letter}`;
                const review = progress.needsReview(letter);
                tile.dataset.status = status;
                tile.dataset.review = String(review);
                tile.textContent = letter;
                tile.title = `Huruf ${letter}: ${STATUS_LABEL[status]}` +
                    (review ? ", perlu diulang (salah saat ujian)" : "");
                tile.setAttribute("aria-label", tile.title);
                tiles.appendChild(tile);
            });

            card.append(head, bar, tiles);
            fragment.appendChild(card);
        });

        container.replaceChildren(fragment);
    }

    function render() {
        const { learned, practiced, total } = progress.counts();
        const name = progress.getName();
        const next = progress.nextLetter();

        // Tamu tidak disapa "Tamu"; cukup "Halo".
        byId("dashGreeting").textContent = name ? `Halo, ${name}` : "Halo";

        let summary;
        if (learned === 0) {
            summary = "Mulai dari huruf A. Lihat contohnya, pahami, lalu praktikkan.";
        } else if (!next) {
            summary = "Luar biasa! Semua 26 huruf sudah berhasil dipraktikkan. Ulangi kapan saja untuk menjaga ingatan.";
        } else {
            summary = `Kamu sudah mempelajari ${learned} huruf dan berhasil mempraktikkan ${practiced}. Lanjutkan dari huruf ${next}.`;
        }
        byId("dashSummary").textContent = summary;

        const target = next || progress.getLastLetter() || "A";
        const nextIsNew = next && progress.statusOf(next) === "new";

        byId("continueLink").href = `huruf.html?huruf=${target}`;
        byId("continueLabel").textContent = next
            ? `${learned === 0 ? "Mulai" : "Lanjut"}: huruf ${next}`
            : "Ulangi alfabet";
        byId("practiceLink").href = `praktik.html?huruf=${target}`;
        byId("practiceLink").textContent = `Praktik huruf ${target}`;
        // Huruf yang belum dipahami sebaiknya dipelajari dulu.
        byId("practiceLink").hidden = Boolean(nextIsNew);

        byId("ringValue").textContent = learned;
        setRing(byId("ringLearned"), learned, total);
        setRing(byId("ringPracticed"), practiced, total);

        byId("statLearned").textContent = learned;
        byId("statPracticed").textContent = practiced;
        byId("statLeft").textContent = total - learned;

        const guest = progress.isGuest();

        byId("guestBanner").hidden = !guest;
        byId("storageWho").textContent = guest
            ? "Mode Tamu (sementara)."
            : name
                ? `Progres milik ${name}.`
                : "Progres tersimpan.";
        byId("storageText").textContent = guest
            ? "Progres ini hilang saat tab ditutup. Tekan “Simpan progres” agar bisa dilanjutkan nanti."
            : "Progres tersimpan di browser ini saja. Menghapus data browser atau berganti perangkat akan memulai dari awal.";
        byId("resetInfo").textContent = guest
            ? "Progres tamu di tab ini akan dihapus. Progres tersimpan lain di browser ini tidak terpengaruh."
            : "Status 26 huruf dan nama panggilan di browser ini akan dihapus. Tindakan ini tidak dapat dibatalkan.";
        byId("resetButton").disabled = !progress.hasProfile();

        renderGroups();
        renderExams();
    }

    // Kartu ujian: terkunci (sisa huruf) atau terbuka (skor terbaik)
    function renderExams() {
        const container = byId("exams");
        const fragment = document.createDocumentFragment();

        ["A-I", "J-R", "S-Z", "ALL"].forEach(examId => {
            const open = progress.isExamOpen(examId);
            const missing = progress.examLocked(examId).length;
            const result = progress.examResult(examId);

            const card = document.createElement(open ? "a" : "div");
            card.className = "exam-card";
            card.dataset.open = String(open);
            if (open) card.href = `praktik.html?ujian=${examId}`;

            const icon = document.createElement("span");
            icon.className = "exam-card-icon";
            icon.setAttribute("aria-hidden", "true");
            icon.textContent = open ? (result ? "★" : "▶") : "🔒";

            const name = document.createElement("strong");
            name.textContent = examId === "ALL"
                ? "Ujian Campuran"
                : `Ujian ${progress.examLabel(examId).replace("Kelompok ", "")}`;

            const info = document.createElement("span");
            if (!open) {
                info.textContent = examId === "ALL"
                    ? `Selesaikan ${missing} huruf lagi di semua kelompok`
                    : `Praktikkan ${missing} huruf lagi`;
            } else if (result) {
                info.textContent = `Skor terbaik ${result.best}/${result.total}`;
            } else {
                info.textContent = examId === "ALL"
                    ? "10 huruf acak dari A–Z"
                    : `${progress.examLetters(examId).length} huruf acak · siap`;
            }

            card.append(icon, name, info);
            fragment.appendChild(card);
        });

        container.replaceChildren(fragment);

        // Huruf yang salah saat ujian
        const review = progress.reviewLetters();
        byId("reviewNote").hidden = review.length === 0;

        const letters = document.createDocumentFragment();
        review.forEach(letter => {
            const chip = document.createElement("a");
            chip.href = `huruf.html?huruf=${letter}`;
            chip.textContent = letter;
            chip.setAttribute("aria-label", `Ulangi huruf ${letter}`);
            letters.appendChild(chip);
        });
        byId("reviewLetters").replaceChildren(letters);
    }

    // Simpan progres tamu menjadi permanen
    const saveDialog = byId("saveDialog");
    const saveWarning = byId("saveWarning");

    byId("saveGuestButton").addEventListener("click", () => {
        const saved = progress.savedProfile();

        // Hanya satu progres tersimpan per browser; beri tahu jika diganti.
        saveWarning.hidden = !saved;
        if (saved) {
            saveWarning.textContent =
                `Browser ini sudah menyimpan progres ${saved.name || "lain"} ` +
                `(${saved.learned}/${saved.total}). Progres itu akan diganti ` +
                "dengan progres tamu ini.";
        }

        byId("saveConfirm").textContent = saved ? "Ganti dan simpan" : "Simpan";
        byId("saveNameInput").value = "";
        // Esc tidak mengubah returnValue; kosongkan agar aksi lama tidak terulang.
        saveDialog.returnValue = "";
        saveDialog.showModal();
        byId("saveNameInput").focus();
    });

    byId("saveCancel").addEventListener("click", () => {
        saveDialog.close("cancel");
    });

    saveDialog.addEventListener("close", () => {
        if (saveDialog.returnValue === "save") {
            progress.saveGuest(byId("saveNameInput").value);
        }
    });

    const dialog = byId("resetDialog");

    byId("resetButton").addEventListener("click", () => {
        dialog.returnValue = "";
        dialog.showModal();
    });

    dialog.addEventListener("close", () => {
        if (dialog.returnValue === "reset") {
            progress.reset();
        }
    });

    document.addEventListener("isyarat:progress", render);
    render();
});
