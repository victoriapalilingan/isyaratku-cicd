# Klasifikasi Data (A4)

> DRAF 19-11-2026 · PIC: Victoria Palilingan

| Tingkat | Arti | Aturan |
|---|---|---|
| Publik | Boleh dilihat siapa saja | — |
| Internal | Hanya tim pengembang/penguji | Tidak dipublikasikan, akses login |
| Rahasia | Bocor = sistem bisa diambil alih atau privasi dilanggar | Tidak boleh di repo/log/chat; izin file 600/640; rotasi bila bocor |

| Data | Lokasi | Tingkat | Perlakuan |
|---|---|---|---|
| Halaman, CSS, JS frontend | `/var/www/html/isyaratku` | Publik | — |
| Frame webcam pengguna (wajah/tangan) | Browser → `/api/predict`, hanya di memori | Rahasia (data pribadi) | Hanya via HTTPS, tidak disimpan, tidak di-log |
| Hasil prediksi | Respons API, `localStorage` browser | Internal | Tidak dikirim ke pihak ketiga |
| Data pengujian (`pengujian_percobaan`, kode pengguna) | MySQL | Internal | Hanya via admin terautentikasi |
| Model `.keras` & `hand_landmarker.task` | Repo & server (di luar webroot) | Internal | Tidak disajikan publik |
| Kredensial DB (`/etc/isyaratku/db*.php`) | VPS | Rahasia | `root:www-data 640`, di luar repo |
| `.htpasswd` admin/staging | VPS | Rahasia | Di luar webroot |
| Jenkins Credentials, token GitHub, token Telegram | Jenkins, `/etc/isyaratku/telegram.env` | Rahasia | Jenkins Credentials / file 600 |
| SSH private key | Laptop admin | Rahasia | Tidak pernah dikirim ke server/repo |
| Log server (auth, apache, audit) | `/var/log` | Internal | Di luar webroot, izin 640 |
