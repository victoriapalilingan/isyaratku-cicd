/* =========================================
   ISYARATKU - LANDING PAGE
   "Mulai Belajar": nama panggilan (opsional),
   progres disimpan permanen di browser ini.
   "Lanjut sebagai Tamu": langsung masuk, progres
   sementara dan tidak menyentuh progres tersimpan.
   ========================================= */

document.addEventListener("DOMContentLoaded", () => {
    "use strict";

    const progress = window.IsyaratProgress;
    const dialog = document.getElementById("nameDialog");
    const form = document.getElementById("nameForm");
    const input = document.getElementById("nicknameInput");

    function enter() {
        window.location.href = progress.isOnboarded()
            ? "home.html"
            : "tutorial.html";
    }

    document.getElementById("startButton").addEventListener("click", () => {
        input.value = progress.savedProfile()?.name || "";

        if (typeof dialog.showModal === "function") {
            dialog.showModal();
            input.focus();
        } else {
            progress.startSaved();
            enter();
        }
    });

    document.getElementById("nameCancel").addEventListener("click", () => {
        dialog.close();
    });

    form.addEventListener("submit", () => {
        progress.startSaved(input.value);
        enter();
    });

    document.getElementById("guestButton").addEventListener("click", () => {
        progress.startGuest();
        enter();
    });

    // Kartu "Lanjutkan belajar": progres tersimpan, atau sesi tamu
    // yang masih aktif di tab ini.
    function renderResume() {
        const card = document.getElementById("resumeCard");
        const guest = progress.isGuest();
        const saved = progress.savedProfile();

        if (!guest && !saved) {
            card.hidden = true;
            return;
        }

        const { learned, total } = guest ? progress.counts() : saved;
        const name = guest ? null : saved.name;

        document.getElementById("resumeHello").textContent = guest
            ? "Sesi tamu masih aktif di tab ini"
            : name
                ? `Selamat datang kembali, ${name}`
                : "Selamat datang kembali";

        document.getElementById("resumeLabel").textContent =
            `Lanjutkan · ${learned}/${total} huruf dipelajari`;

        document.getElementById("resumeRing").style.setProperty(
            "--value",
            `${Math.round((learned / total) * 360)}deg`
        );

        // Kartu progres tersimpan menutup sesi tamu lalu melanjutkan.
        card.onclick = guest ? null : event => {
            event.preventDefault();
            progress.startSaved();
            const next = progress.nextLetter();
            window.location.href = next ? `huruf.html?huruf=${next}` : "home.html";
        };
        card.href = "home.html";
        card.hidden = false;
    }

    renderResume();
    document.addEventListener("isyarat:progress", renderResume);
});
