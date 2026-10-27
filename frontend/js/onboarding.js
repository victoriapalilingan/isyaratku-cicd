/* =========================================
   ISYARATKU - TUTORIAL (ONBOARDING)
   5 langkah. Selesai atau dilewati ditandai
   onboarded sehingga tidak muncul lagi otomatis.
   ========================================= */

document.addEventListener("DOMContentLoaded", () => {
    "use strict";

    const progress = window.IsyaratProgress;
    const steps = Array.from(document.querySelectorAll(".tour-step"));
    const dots = document.getElementById("tourDots");
    const counter = document.getElementById("tourCounter");
    const prev = document.getElementById("prevStep");
    const next = document.getElementById("nextStep");
    const total = steps.length;
    let index = 0;

    const name = progress.getName();
    if (name) {
        document.getElementById("tourName").textContent = `, ${name}`;
    }

    // Pengguna yang membuka tutorial langsung tercatat sebagai tamu.
    if (!progress.hasProfile()) {
        progress.startGuest();
    }

    if (progress.isGuest()) {
        document.getElementById("tourStorageHint").textContent =
            "Kamu masuk sebagai Tamu, jadi progres hanya bertahan selama " +
            "tab ini terbuka. Tekan “Simpan progres” di dashboard jika " +
            "ingin melanjutkannya nanti.";
    }

    const dotButtons = steps.map((_, i) => {
        const item = document.createElement("li");
        const button = document.createElement("button");
        button.type = "button";
        button.setAttribute("aria-label", `Langkah ${i + 1}`);
        button.addEventListener("click", () => show(i));
        item.appendChild(button);
        dots.appendChild(item);
        return button;
    });

    function finish() {
        progress.setOnboarded();
        window.location.href = "home.html";
    }

    function show(i) {
        index = Math.max(0, Math.min(total - 1, i));

        steps.forEach((step, n) => {
            step.hidden = n !== index;
        });

        dotButtons.forEach((button, n) => {
            button.classList.toggle("is-done", n < index);
            if (n === index) {
                button.setAttribute("aria-current", "step");
            } else {
                button.removeAttribute("aria-current");
            }
        });

        counter.textContent = `Langkah ${index + 1} dari ${total}`;
        prev.disabled = index === 0;
        next.textContent = index === total - 1
            ? "Mulai belajar →"
            : "Lanjut →";

        steps[index].querySelector("h1")?.focus({ preventScroll: true });
    }

    steps.forEach(step => {
        step.querySelector("h1")?.setAttribute("tabindex", "-1");
    });

    prev.addEventListener("click", () => show(index - 1));

    next.addEventListener("click", () => {
        if (index === total - 1) finish();
        else show(index + 1);
    });

    document.getElementById("skipTour").addEventListener("click", event => {
        event.preventDefault();
        finish();
    });

    document.addEventListener("keydown", event => {
        if (event.target.closest("input, textarea")) return;

        if (event.key === "ArrowRight") show(index + 1);
        if (event.key === "ArrowLeft") show(index - 1);
    });

    // Kartu foto miring mengikuti kursor (CSS 3D ringan, tanpa three.js)
    const tiltCard = document.getElementById("tiltCard");
    const reduceMotion =
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (tiltCard && !reduceMotion) {
        tiltCard.addEventListener("pointermove", event => {
            const rect = tiltCard.getBoundingClientRect();
            const x = (event.clientX - rect.left) / rect.width - 0.5;
            const y = (event.clientY - rect.top) / rect.height - 0.5;
            tiltCard.style.setProperty("--ry", `${x * 16}deg`);
            tiltCard.style.setProperty("--rx", `${-y * 16}deg`);
        });

        tiltCard.addEventListener("pointerleave", () => {
            tiltCard.style.removeProperty("--ry");
            tiltCard.style.removeProperty("--rx");
        });
    }

    show(0);
});
