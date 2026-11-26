# Threat Model IsyaratKu — STRIDE (A2)

> DRAF 19-11-2026 · dokumen susulan · PIC: Victoria Palilingan

## Alur data & batas kepercayaan
```
[Browser pengguna] --HTTPS--> [Apache :443] --> file statis frontend
        |                         |--> /api/  --proxy--> [Gunicorn/Flask 127.0.0.1:5000] (MediaPipe + CNN)
        |                         |--> /admin/ (Basic Auth) --> [PHP] --PDO--> [MySQL 127.0.0.1:3306]
        |                         '--> /jenkins/ --> [Jenkins]
[Developer] --git push--> [GitHub] --webhook--> [Jenkins] --rsync--> /var/www/...
[Admin] --SSH key :9765--> [VPS Ubuntu 22.04]
```
Batas kepercayaan: internet ↔ Apache; Apache ↔ layanan lokal; GitHub ↔ Jenkins; Jenkins ↔ webroot.

## Ancaman
| # | Komponen | STRIDE | Ancaman | Kontrol | Status |
|---|---|---|---|---|---|
| T1 | `/api/predict` | DoS | Upload frame besar/berulang menghabiskan CPU model | Validasi input, lock inferensi; **perlu** batas ukuran body & rate limit | Sebagian |
| T2 | `/api/predict` | Tampering | File bukan gambar untuk memicu bug decoder | `cv2.imdecode` + respons 400 | Terkendali |
| T3 | `/api/predict` | Info disclosure | Origin lain membaca hasil prediksi | CORS allowlist (SR-04) | Diperbaiki (PR) |
| T4 | Admin PHP | Spoofing | Tebak password Basic Auth | fail2ban `apache-auth` | Rencana |
| T5 | Admin PHP | Tampering | CSRF / SQL injection pada CRUD | Token CSRF, prepared statement | Terkendali |
| T6 | MySQL | Info disclosure | Akses langsung port 3306 | bind 127.0.0.1, UFW | Terkendali |
| T7 | SSH | Spoofing | Brute force password | Key-only, fail2ban (SR-09) | Rencana |
| T8 | Jenkins | Elevation | Akses UI/port 9090 lalu menjalankan script di server | Tutup 9090, matrix authorization | Rencana |
| T9 | GitHub | Tampering | Push langsung ke `main` = deploy tanpa review | Ruleset + PR review | Rencana |
| T10 | Pipeline | Tampering | Dependency berbahaya/rentan | SCA Trivy, Dependabot | Rencana |
| T11 | Frontend | Tampering | CDN three.js dimodifikasi | SRI | Diperbaiki (PR) |
| T12 | Server | Repudiation | Perubahan konfigurasi tanpa jejak | auditd, AIDE | Rencana |
