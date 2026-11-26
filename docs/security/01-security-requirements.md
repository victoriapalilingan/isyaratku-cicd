# Security Requirements IsyaratKu (A1)

> DRAF 19-11-2026 · dokumen susulan · PIC: Victoria Palilingan

Setiap fitur baru wajib memenuhi requirement ini **sebelum** dikembangkan; perubahan requirement dicatat di CHANGELOG.

| ID | Requirement | Kontrol / bukti |
|---|---|---|
| SR-01 | Semua lalu lintas web memakai HTTPS; HTTP dialihkan ke HTTPS | Apache redirect 301 + Let's Encrypt, header HSTS |
| SR-02 | Frame webcam hanya diproses di memori, tidak disimpan di server | `backend/routes/prediction.py` (tidak ada penulisan file) |
| SR-03 | Endpoint `/api/predict` memvalidasi input (ada frame, bukan kosong, gambar valid) | `prediction.py` langkah 1–2; uji API di Jenkinsfile |
| SR-04 | API hanya bisa dipanggil dari origin IsyaratKu | `backend/cors_config.py` + `test_cors.py` |
| SR-05 | Halaman & API admin hanya untuk admin terautentikasi | Basic Auth Apache, CSRF token di `admin/index.php` |
| SR-06 | Query database memakai prepared statement | PDO `EMULATE_PREPARES=false` di `admin/lib.php` |
| SR-07 | Kredensial tidak pernah disimpan di repository | `/etc/isyaratku/db.php`, Jenkins Credentials, secret scan pipeline |
| SR-08 | Database, Flask, dan Jenkins tidak dapat diakses langsung dari internet | Bind `127.0.0.1`, UFW default deny |
| SR-09 | Login server hanya dengan SSH key; brute force diblokir | `sshd_config.d/00-hardening.conf`, fail2ban |
| SR-10 | Kode & dependency di-scan sebelum deploy; build berhenti bila ada temuan Critical | Jenkinsfile stage Secret/SAST/SCA/IaC |
| SR-11 | Perubahan ke `main` lewat Pull Request yang direview | GitHub ruleset |
| SR-12 | Production bisa dikembalikan ke versi sebelumnya | Backup + rollback otomatis di Jenkinsfile |
| SR-13 | Kejadian keamanan memicu alert otomatis | fail2ban/AIDE/Jenkins → Telegram |
