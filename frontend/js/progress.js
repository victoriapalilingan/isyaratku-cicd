/* =========================================
   ISYARATKU - PROGRES BELAJAR
   Tanpa akun, tanpa server. Dua mode:

   - saved : "Mulai Belajar". Progres permanen di
             localStorage (isyaratku_progress_v1).
   - guest : "Lanjut sebagai Tamu". Progres sementara
             di sessionStorage, hilang saat tab ditutup.
             Progres tersimpan tidak disentuh sama sekali.
             Bisa dipindahkan menjadi permanen lewat
             "Simpan progres".

   Status per huruf:
   - new       : belum dibuka atau belum dipahami
   - viewed    : pengguna menandai "sudah memahami"
   - practiced : huruf stabil di kamera sama dengan target

   Pada praktik.html?uji=1 progres tidak ditulis, agar
   pengujian tidak mengubah progres belajar.
   ========================================= */

(function () {
    "use strict";

    const STORAGE_KEY = "isyaratku_progress_v1";
    const GUEST_KEY = "isyaratku_guest_v1";
    const VERSION = 1;
    const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    const GROUPS = [
        { id: "A-I", label: "A–I", letters: ALPHABET.slice(0, 9) },
        { id: "J-R", label: "J–R", letters: ALPHABET.slice(9, 18) },
        { id: "S-Z", label: "S–Z", letters: ALPHABET.slice(18) }
    ];

    const readOnly =
        new URLSearchParams(window.location.search).get("uji") === "1";

    // Akses storage bisa melempar error (mode privat, diblokir).
    function storage(type) {
        try {
            return window[type];
        } catch {
            return null;
        }
    }

    const local = storage("localStorage");
    const session = storage("sessionStorage");

    function blank(guest) {
        return {
            version: VERSION,
            nickname: null,
            guest,
            onboarded: false,
            startedAt: new Date().toISOString(),
            lastLetter: null,
            letters: {}
        };
    }

    // Data rusak atau versi lain diabaikan, bukan membuat halaman error.
    function read(store, key) {
        try {
            const raw = store?.getItem(key);
            if (!raw) return null;

            const data = JSON.parse(raw);
            if (
                !data ||
                data.version !== VERSION ||
                typeof data.letters !== "object" ||
                data.letters === null
            ) {
                return null;
            }

            return data;
        } catch {
            return null;
        }
    }

    function write(store, key, data) {
        try {
            store?.setItem(key, JSON.stringify(data));
        } catch {
            // Penyimpanan penuh atau diblokir: progres hanya
            // berlaku selama halaman terbuka.
        }
    }

    function remove(store, key) {
        try {
            store?.removeItem(key);
        } catch {
            // Abaikan; state di memori tetap dikosongkan.
        }
    }

    function notify() {
        document.dispatchEvent(new CustomEvent("isyarat:progress"));
    }

    // Sesi tamu yang aktif di tab ini didahulukan.
    let state = read(session, GUEST_KEY);
    let mode = state ? "guest" : null;

    if (!state) {
        state = read(local, STORAGE_KEY);
        mode = state ? "saved" : null;
    }

    function save() {
        if (readOnly || !state) return;

        if (mode === "guest") write(session, GUEST_KEY, state);
        else write(local, STORAGE_KEY, state);

        notify();
    }

    // Menulis tanpa profil (misalnya membuka huruf.html langsung)
    // dianggap sesi tamu agar progres tersimpan tidak tertimpa.
    function ensure() {
        if (!state) {
            state = blank(true);
            mode = "guest";
        }
        return state;
    }

    function normalize(letter) {
        const value = String(letter || "").trim().toUpperCase();
        return ALPHABET.includes(value) ? value : null;
    }

    function statusOf(letter) {
        const key = normalize(letter);
        return (key && state?.letters[key]?.status) || "new";
    }

    function cleanName(name) {
        return String(name || "").replace(/\s+/g, " ").trim().slice(0, 24);
    }

    function countsOf(data) {
        let learned = 0;
        let practiced = 0;

        ALPHABET.forEach(letter => {
            const status = data?.letters[letter]?.status || "new";
            if (status !== "new") learned++;
            if (status === "practiced") practiced++;
        });

        return { learned, practiced, total: ALPHABET.length };
    }

    const api = {
        ALPHABET,
        GROUPS,
        readOnly,

        hasProfile: () => state !== null,
        isGuest: () => mode === "guest",
        getName: () => state?.nickname || null,
        isOnboarded: () => Boolean(state?.onboarded),

        // "Mulai Belajar": memakai progres tersimpan (jika ada)
        // dan menutup sesi tamu di tab ini.
        startSaved(nickname = "") {
            remove(session, GUEST_KEY);

            const name = cleanName(nickname);
            state = read(local, STORAGE_KEY) || blank(false);
            state.guest = false;
            if (name) state.nickname = name;
            mode = "saved";
            save();
        },

        // "Lanjut sebagai Tamu": sesi sementara; sesi tamu yang
        // masih aktif di tab ini dilanjutkan.
        startGuest() {
            if (mode === "guest" && state) return;

            state = blank(true);
            mode = "guest";
            save();
        },

        // Ringkasan progres tersimpan, juga saat sedang mode tamu.
        savedProfile() {
            const data = read(local, STORAGE_KEY);
            return data
                ? { name: data.nickname || null, ...countsOf(data) }
                : null;
        },

        // Tamu -> permanen. Progres tersimpan sebelumnya diganti.
        saveGuest(nickname = "") {
            if (mode !== "guest" || !state || readOnly) return;

            state.guest = false;
            state.nickname = cleanName(nickname) || null;
            mode = "saved";
            remove(session, GUEST_KEY);
            save();
        },

        setOnboarded() {
            ensure().onboarded = true;
            save();
        },

        statusOf,

        // Dipanggil dari tombol "Saya sudah memahami".
        // Huruf yang sudah dipraktikkan tidak turun status.
        markViewed(letter) {
            const key = normalize(letter);
            if (!key) return;

            const data = ensure();
            const entry = data.letters[key] || {};

            if (entry.status !== "practiced") entry.status = "viewed";
            entry.viewedAt = entry.viewedAt || new Date().toISOString();

            data.letters[key] = entry;
            data.lastLetter = key;
            save();
        },

        // Dipanggil saat huruf stabil sama dengan huruf target.
        markPracticed(letter, confidence) {
            const key = normalize(letter);
            if (!key || readOnly) return;

            const data = ensure();
            const entry = data.letters[key] || {};
            const now = new Date().toISOString();

            entry.status = "practiced";
            entry.viewedAt = entry.viewedAt || now;
            entry.practicedAt = now;

            if (typeof confidence === "number" && Number.isFinite(confidence)) {
                entry.bestConfidence = Math.max(
                    entry.bestConfidence || 0,
                    Math.round(confidence * 1000) / 1000
                );
            }

            data.letters[key] = entry;
            data.lastLetter = key;
            save();
        },

        setLastLetter(letter) {
            const key = normalize(letter);
            if (!key || readOnly) return;

            ensure().lastLetter = key;
            save();
        },

        getLastLetter: () => state?.lastLetter || null,

        // "Dipelajari" = sudah dipahami atau sudah dipraktikkan.
        counts: () => countsOf(state),

        // Huruf berikutnya: yang belum dipahami lebih dulu,
        // lalu yang belum dipraktikkan.
        nextLetter() {
            return (
                ALPHABET.find(letter => statusOf(letter) === "new") ||
                ALPHABET.find(letter => statusOf(letter) !== "practiced") ||
                null
            );
        },

        letterAfter(letter) {
            const index = ALPHABET.indexOf(normalize(letter));
            return index >= 0 && index < ALPHABET.length - 1
                ? ALPHABET[index + 1]
                : null;
        },

        /* ----- UJIAN -----
           Ujian kelompok terbuka jika semua huruf kelompok itu
           sudah dipraktikkan. Ujian campuran ("ALL") terbuka jika
           ketiga kelompok selesai. */

        examLetters(examId) {
            if (examId === "ALL") return ALPHABET.slice();
            return GROUPS.find(group => group.id === examId)?.letters.slice() || [];
        },

        examLabel(examId) {
            if (examId === "ALL") return "Campuran A–Z";
            const group = GROUPS.find(item => item.id === examId);
            return group ? `Kelompok ${group.label}` : "";
        },

        // Huruf yang belum dipraktikkan untuk membuka ujian
        examLocked(examId) {
            return api.examLetters(examId)
                .filter(letter => statusOf(letter) !== "practiced");
        },

        isExamOpen: examId =>
            api.examLetters(examId).length > 0 &&
            api.examLocked(examId).length === 0,

        examResult: examId => state?.exams?.[examId] || null,

        // Hasil ujian penuh (bukan putaran latihan ulang)
        recordExam(examId, { correct, total, wrong }) {
            if (readOnly || !state) return;

            const exams = state.exams || (state.exams = {});
            const previous = exams[examId];

            exams[examId] = {
                last: correct,
                best: Math.max(previous?.best ?? 0, correct),
                total,
                wrong: wrong.slice(),
                at: new Date().toISOString()
            };
            save();
        },

        // Setiap jawaban: salah -> perlu diulang, benar -> dihapus.
        recordAnswer(letter, correct) {
            const key = normalize(letter);
            if (!key || readOnly || !state) return;

            const review = new Set(state.review || []);
            if (correct) review.delete(key);
            else review.add(key);

            state.review = ALPHABET.filter(item => review.has(item));
            save();
        },

        needsReview: letter =>
            Boolean(state?.review?.includes(normalize(letter))),

        reviewLetters: () => (state?.review || []).slice(),

        // Hanya menghapus progres mode yang sedang aktif.
        reset() {
            if (mode === "guest") remove(session, GUEST_KEY);
            else remove(local, STORAGE_KEY);

            state = null;
            mode = null;
            notify();
        }
    };

    // Tab lain mengubah progres tersimpan.
    window.addEventListener("storage", event => {
        if (event.key !== STORAGE_KEY || mode === "guest") return;

        state = read(local, STORAGE_KEY);
        mode = state ? "saved" : null;
        notify();
    });

    window.IsyaratProgress = api;
})();
