# Peta Routing & Definisi Role (OWASP B1, B3, B6)

> Disusun 23-11-2026 dari konfigurasi Apache `pear123.my.id` dan kode di repo ini.

## Role
| Role | Siapa | Cara autentikasi | Boleh |
|---|---|---|---|
| **Publik** | Pengunjung / pelajar BISINDO | Tanpa login | Halaman belajar & praktik, `POST /api/predict`, `GET /api/health`. Progres belajar hanya di `localStorage` browser sendiri |
| **Admin** | Pengelola data pengujian (tim IsyaratKu) | Login PHP `admin/login.php` (sesi PHP, password bcrypt di `/etc/isyaratku/.htpasswd`, idle 15 menit) | Semua di `/admin/`: lihat rekap, ubah tanda valid/catatan, hapus percobaan, ekspor CSV, simpan hasil Mode Uji |
| **Admin CI/CD** | Pemilik sistem (`admin` di Jenkins) | Login Jenkins + matrix security | Menjalankan & mengubah pipeline di `/jenkins/` |

Tidak ada akun pengguna publik, sehingga tidak ada data milik satu pengguna yang bisa dibaca pengguna lain.

## Routing
| URL | Ditangani oleh | Method | Role | Kontrol akses |
|---|---|---|---|---|
| `/`, `/*.html`, `/css/*`, `/js/*` | Apache (file statis `frontend/`) | GET | Publik | `Options -Indexes`; file `.sh/.bak/.env/...` ditolak |
| `/api/health` | Flask `app.py` → `health_check` | GET | Publik | Proxy ke `127.0.0.1:5000` |
| `/api/predict` | Flask `routes/prediction.py` → `predict` | POST | Publik | Validasi frame; maks 5 MB (Apache 403, Flask 413); CORS allowlist |
| `/admin/` (`index.php`) | PHP | GET (rekap, filter, `?export=csv`), POST `action=update\|delete` | Admin | `require_login()` + token CSRF + prepared statement |
| `/admin/login.php`, `/admin/logout.php` | PHP | GET/POST (login), POST + CSRF (logout) | Publik → Admin | Token CSRF, `session_regenerate_id`, log `admin-auth.log` |
| `/admin/api/percobaan.php` | PHP | POST JSON `action=save\|delete` | Admin | `require_login(true)` (401 JSON) + wajib `application/json` + validasi `trialKey()` |
| `/jenkins/*` | Jenkins (proxy `127.0.0.1:9090`) | GET/POST | Admin CI/CD | Login Jenkins, anonim 403 |
| `/jenkins/github-webhook/` | Jenkins GitHub plugin | POST | GitHub | Hanya memicu build job yang terdaftar |
| `/_errors/403.html`, `/_errors/404.html` | Apache | GET | Publik | Halaman error kustom |
