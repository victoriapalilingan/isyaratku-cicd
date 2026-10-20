
/* ==========================================
   ISYARATKU - BELAJAR ALFABET
   ========================================== */

document.addEventListener("DOMContentLoaded", () => {

    const grid = document.getElementById("alphabetGrid");
    const searchInput = document.getElementById("searchAlphabet");
    const filterButtons = document.querySelectorAll(".filter");
    const emptyState = document.getElementById("emptyAlphabet");
    const resetButton = document.getElementById("resetFilter");

    if (!grid) {
        console.error("alphabetGrid tidak ditemukan.");
        return;
    }

    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    let activeFilter = "all";

    // Icon placeholder, bukan gesture BISINDO
    const placeholderIcon = `
        <svg viewBox="0 0 24 24"
             fill="none"
             stroke="currentColor"
             stroke-width="1.5"
             stroke-linecap="round"
             stroke-linejoin="round"
             aria-hidden="true">
            <rect x="4" y="4" width="16" height="16" rx="3"/>
            <circle cx="9" cy="9" r="1.5"/>
            <path d="M5 17l5-5 3 3 2-2 4 4"/>
        </svg>
    `;

    function createCard(letter) {
        const card = document.createElement("a");

        card.className = "alphabet-card";
        card.href = `huruf.html?huruf=${letter}`;
        card.dataset.letter = letter;
        card.setAttribute(
            "aria-label",
            `Pelajari gesture BISINDO huruf ${letter}`
        );

        // Header
        const header = document.createElement("div");
        header.className = "card-header";

        const title = document.createElement("strong");
        title.textContent = letter;

        const arrow = document.createElement("span");
        arrow.className = "card-arrow";
        arrow.textContent = "↗";
        arrow.setAttribute("aria-hidden", "true");

        header.append(title, arrow);

        // Image
        const gesture = document.createElement("div");
        gesture.className = "gesture-image";

        const placeholder = document.createElement("div");
        placeholder.className = "gesture-placeholder";

        placeholder.innerHTML = placeholderIcon;

        const label = document.createElement("span");
        label.textContent = "Gambar gesture";
        placeholder.appendChild(label);

        const img = document.createElement("img");
        img.alt = `Gesture BISINDO huruf ${letter}`;
        // Tanpa loading="lazy": gambar yang masih hidden tidak
        // pernah dimuat oleh browser, sehingga event load tidak
        // terjadi dan placeholder tidak pernah diganti.
        img.hidden = true;

        img.addEventListener("load", () => {
            img.hidden = false;
            placeholder.hidden = true;
        });

        img.addEventListener("error", () => {
            img.hidden = true;
            placeholder.hidden = false;
        });

        img.src = `assets/bisindo/${letter}.jpg`;

        gesture.append(placeholder, img);

        // Hover
        const overlay = document.createElement("div");
        overlay.className = "card-overlay";

        const detail = document.createElement("span");
        detail.className = "detail-label";
        detail.textContent = "Lihat detail";

        overlay.appendChild(detail);

        card.append(header, gesture, overlay);

        return card;
    }

    // Render cards
    function renderCards() {
        const fragment = document.createDocumentFragment();

        alphabet.forEach(letter => {
            fragment.appendChild(createCard(letter));
        });

        grid.replaceChildren(fragment);
    }

    // Filter
    function matchesFilter(letter) {
        if (activeFilter === "all") return true;

        const [start, end] = activeFilter.split("-");

        return letter >= start && letter <= end;
    }

    // Search + filter
    function updateCards() {
        const keyword = searchInput
            ? searchInput.value.trim().toUpperCase()
            : "";

        const cards = grid.querySelectorAll(".alphabet-card");
        let visibleCount = 0;

        cards.forEach(card => {
            const letter = card.dataset.letter;

            const matchSearch =
                keyword === "" || letter.includes(keyword);

            const visible =
                matchSearch && matchesFilter(letter);

            card.hidden = !visible;

            if (visible) visibleCount++;
        });

        if (emptyState) {
            emptyState.hidden = visibleCount > 0;
        }
    }

    if (searchInput) {
        searchInput.addEventListener("input", updateCards);
    }

    // Filter button events
    filterButtons.forEach(button => {
        button.addEventListener("click", () => {
            activeFilter = button.dataset.filter || "all";

            filterButtons.forEach(item => {
                const selected = item === button;
                item.classList.toggle("active", selected);
                item.setAttribute("aria-pressed", String(selected));
            });

            updateCards();
        });
    });

    // Reset
    if (resetButton) {
        resetButton.addEventListener("click", () => {
            activeFilter = "all";

            if (searchInput) searchInput.value = "";

            filterButtons.forEach(button => {
                const selected = button.dataset.filter === "all";

                button.classList.toggle("active", selected);
                button.setAttribute("aria-pressed", String(selected));
            });

            updateCards();
        });
    }

    renderCards();
    updateCards();

    console.log("IsyaratKu - Belajar Alfabet berhasil dimuat.");
});
