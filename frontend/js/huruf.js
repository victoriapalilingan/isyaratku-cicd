
/* =========================================
   ISYARATKU - TUTORIAL HURUF A-Z
   ========================================= */

document.addEventListener("DOMContentLoaded", () => {

    /* =====================================
       ALPHABET
       ===================================== */

    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

    /* =====================================
       GET SELECTED LETTER
       ===================================== */

    const params = new URLSearchParams(window.location.search);

    const requestedLetter = (params.get("huruf") || "A")
        .trim()
        .toUpperCase();

    const currentLetter = alphabet.includes(requestedLetter)
        ? requestedLetter
        : "A";

    const currentIndex = alphabet.indexOf(currentLetter);

    const previousLetter =
        alphabet[(currentIndex - 1 + alphabet.length) % alphabet.length];

    const nextLetter =
        alphabet[(currentIndex + 1) % alphabet.length];

    /* =====================================
       TUTORIAL DATA A-Z

       Panduan A mengikuti contoh Figma.
       Huruf lain berisi placeholder sementara.
       ===================================== */

    const tutorialData = {};

    // Siapkan semua huruf secara otomatis
    alphabet.forEach(letter => {
        tutorialData[letter] = {
            title: `Pelajari Gesture BISINDO Huruf ${letter}`,

            description:
                `Pelajari cara memperagakan huruf ${letter} ` +
                `dalam alfabet BISINDO melalui panduan berikut. ` +
                `Detail posisi tangan akan ditambahkan setelah diverifikasi.`,

            caption:
                `Perhatikan bentuk dan posisi tangan untuk huruf ${letter}`,

            verified: false,

            steps: [
                {
                    title: "Perhatikan contoh gesture",
                    description:
                        `Amati gambar referensi huruf ${letter} ` +
                        `ketika sudah tersedia.`
                },
                {
                    title: "Pelajari posisi tangan",
                    description:
                        "Panduan posisi jari dan arah telapak " +
                        "sedang disiapkan."
                },
                {
                    title: "Siapkan latihan",
                    description:
                        "Setelah panduan tersedia, ikuti contoh " +
                        "dan lanjutkan ke halaman praktik."
                }
            ]
        };
    });

    // Panduan A: sesuai 165 citra kelas A pada dataset dan
    // Gambar 2-3 Research Project (abjad BISINDO; A versi SIBI
    // berbeda). Arah telapak bervariasi sehingga tidak ditentukan.
    tutorialData.A = {
        title:
            "Bentuk segitiga dengan kedua tangan.",

        description:
            "Huruf A pada BISINDO memakai dua tangan. " +
            "Ujung telunjuk bertemu di atas dan ujung ibu jari " +
            "bertemu di bawah, sehingga terbentuk celah segitiga " +
            "di tengah.",

        caption:
            "Perhatikan pertemuan ujung telunjuk di atas dan ujung ibu jari di bawah",

        // Belum diverifikasi oleh penutur BISINDO
        verified: false,

        steps: [
            {
                title: "Siapkan kedua tangan",
                description:
                    "Angkat kedua tangan di depan tubuh, " +
                    "lalu tekuk jari tengah, jari manis, dan kelingking."
            },
            {
                title: "Pertemukan ujung telunjuk",
                description:
                    "Luruskan telunjuk kedua tangan secara miring " +
                    "hingga ujungnya bersentuhan di atas."
            },
            {
                title: "Pertemukan ujung ibu jari",
                description:
                    "Luruskan ibu jari ke arah dalam hingga ujungnya " +
                    "bersentuhan di bawah, lalu tahan gesture " +
                    "di depan kamera."
            }
        ]
    };

    // Panduan B: sesuai 169 citra kelas B pada dataset dan
    // Gambar 2-3 Research Project. Tangan mana yang tegak
    // bervariasi sehingga tidak ditentukan kiri/kanan.
    tutorialData.B = {
        title:
            "Bentuk huruf B dengan telunjuk tegak dan dua jari mendatar.",

        description:
            "Huruf B pada BISINDO memakai dua tangan. Telunjuk satu " +
            "tangan berdiri tegak sebagai garis lurus huruf B, dan " +
            "telunjuk serta jari tengah tangan lainnya mendatar " +
            "menyentuhnya sebagai dua lengkungan huruf B.",

        caption:
            "Perhatikan telunjuk yang tegak dan dua jari mendatar yang ujungnya menyentuh telunjuk itu",

        // Belum diverifikasi oleh penutur BISINDO
        verified: false,

        steps: [
            {
                title: "Tegakkan satu telunjuk",
                description:
                    "Pada satu tangan, luruskan telunjuk ke atas " +
                    "dan tekuk jari lainnya."
            },
            {
                title: "Datarkan dua jari",
                description:
                    "Pada tangan lainnya, luruskan telunjuk dan " +
                    "jari tengah ke samping dengan sedikit jarak, " +
                    "lalu tekuk jari manis dan kelingking."
            },
            {
                title: "Sentuhkan ke telunjuk tegak",
                description:
                    "Tempelkan ujung kedua jari mendatar ke telunjuk " +
                    "yang tegak sehingga membentuk huruf B, lalu " +
                    "tahan gesture di depan kamera."
            }
        ]
    };

    /* =====================================
       GET HTML ELEMENTS
       ===================================== */

    const displayLetter =
        document.getElementById("displayLetter");

    const letterEyebrow =
        document.getElementById("letterEyebrow");

    const gestureBadge =
        document.getElementById("gestureBadge");

    const gestureImage =
        document.getElementById("gestureImage");

    const gesturePlaceholder =
        document.getElementById("gesturePlaceholder");

    const gestureCaption =
        document.getElementById("gestureCaption");

    const tutorialTitle =
        document.getElementById("tutorialTitle");

    const tutorialDescription =
        document.getElementById("tutorialDescription");

    const tutorialSteps =
        document.getElementById("tutorialSteps");

    const practiceButton =
        document.getElementById("practiceButton");

    const practiceLabel =
        document.getElementById("practiceLabel");

    const previousLink =
        document.getElementById("previousLetter");

    const nextLink =
        document.getElementById("nextLetter");

    const previousLabel =
        document.getElementById("previousLabel");

    const nextLabel =
        document.getElementById("nextLabel");

    /* =====================================
       DISPLAY LETTER
       ===================================== */

    const data = tutorialData[currentLetter];

    displayLetter.textContent = currentLetter;

    letterEyebrow.textContent = `HURUF ${currentLetter}`;

    gestureBadge.textContent = currentLetter;

    tutorialTitle.textContent = data.title;

    tutorialDescription.textContent = data.description;

    gestureCaption.textContent = data.caption;

    document.title =
        `Tutorial Huruf ${currentLetter} - IsyaratKu`;

    /* =====================================
       DISPLAY THREE TUTORIAL STEPS
       ===================================== */

    tutorialSteps.replaceChildren();

    data.steps.forEach((step, index) => {

        const card = document.createElement("div");
        card.className = "step-card";

        const number = document.createElement("span");
        number.className = "step-number";
        number.textContent = index + 1;

        const content = document.createElement("div");
        content.className = "step-text";

        const title = document.createElement("strong");
        title.textContent = step.title;

        const description = document.createElement("p");
        description.textContent = step.description;

        content.appendChild(title);
        content.appendChild(description);

        card.appendChild(number);
        card.appendChild(content);

        tutorialSteps.appendChild(card);
    });

    /* =====================================
       LOAD IMAGE AUTOMATICALLY
       ===================================== */

    gestureImage.alt =
        `Contoh gesture BISINDO huruf ${currentLetter}`;

    gestureImage.onload = () => {
        gestureImage.hidden = false;
        gesturePlaceholder.hidden = true;
    };

    gestureImage.onerror = () => {
        gestureImage.hidden = true;
        gesturePlaceholder.hidden = false;
    };

    gestureImage.src =
        `assets/bisindo/${currentLetter}.jpg`;

    /* =====================================
       PRACTICE BUTTON
       ===================================== */

    practiceButton.href =
        `praktik.html?huruf=${currentLetter}`;

    practiceLabel.textContent =
        `Praktikkan huruf ${currentLetter}`;

    /* =====================================
       PREVIOUS LETTER
       ===================================== */

    previousLink.href =
        `huruf.html?huruf=${previousLetter}`;

    previousLabel.textContent = previousLetter;

    previousLink.setAttribute(
        "aria-label",
        `Lihat tutorial huruf ${previousLetter}`
    );

    /* =====================================
       NEXT LETTER
       ===================================== */

    nextLink.href =
        `huruf.html?huruf=${nextLetter}`;

    nextLabel.textContent = nextLetter;

    nextLink.setAttribute(
        "aria-label",
        `Lihat tutorial huruf ${nextLetter}`
    );

    /* =====================================
       FINISH
       ===================================== */

    console.log(
        `IsyaratKu: Tutorial huruf ${currentLetter} siap.`
    );

});
