/* =========================================
   ISYARATKU - HEADER BERSAMA
   Menampilkan nama (atau "Tamu") dan jumlah
   huruf yang sudah dipelajari di header.
   ========================================= */

(function () {
    "use strict";

    function renderUser() {
        const chip = document.getElementById("siteUser");
        const progress = window.IsyaratProgress;
        if (!chip || !progress) return;

        if (!progress.hasProfile()) {
            chip.replaceChildren();
            return;
        }

        const name = progress.getName() || "Tamu";
        const { learned, total } = progress.counts();

        const avatar = document.createElement("span");
        avatar.className = "site-avatar";
        avatar.setAttribute("aria-hidden", "true");
        avatar.textContent = name.charAt(0).toUpperCase();

        const label = document.createElement("span");
        label.textContent = name;

        const guest = progress.isGuest();
        const count = document.createElement("small");
        count.textContent = guest
            ? `${learned}/${total} · sementara`
            : `${learned}/${total}`;

        chip.classList.toggle("is-guest", guest);
        chip.setAttribute(
            "aria-label",
            `${name}, ${learned} dari ${total} huruf dipelajari` +
            `${guest ? ", progres sementara belum disimpan" : ""}. Lihat progres`
        );
        chip.replaceChildren(avatar, label, count);
    }

    document.addEventListener("isyarat:progress", renderUser);
    document.addEventListener("DOMContentLoaded", renderUser);
})();
