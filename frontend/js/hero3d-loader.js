/* =========================================
   ISYARATKU - PEMUAT VISUAL 3D
   three.js dan hero3d.js baru dimuat setelah
   pengunjung berinteraksi (gerak mouse, sentuh,
   scroll, atau tekan tombol), supaya halaman
   awal ringan. Sebelum itu, kartu statis
   (hero-fallback) yang tampil.
   ========================================= */

(function () {
    "use strict";

    if (!document.getElementById("hero3d")) return;

    const EVENTS = ["pointermove", "pointerdown", "touchstart", "keydown", "scroll", "wheel"];
    let started = false;

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    function start() {
        if (started) return;
        started = true;
        EVENTS.forEach(name => window.removeEventListener(name, start));

        loadScript("https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js")
            .then(() => loadScript("./js/hero3d.js?v=20261126"))
            .catch(() => {
                /* Gagal dimuat: kartu statis tetap tampil */
            });
    }

    EVENTS.forEach(name =>
        window.addEventListener(name, start, { once: true, passive: true })
    );
})();