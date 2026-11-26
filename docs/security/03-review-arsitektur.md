# Review Keamanan Arsitektur (A3)

> DRAF 19-11-2026 · reviewer: Victoria Palilingan · bukti: `audit/bukti/` (lokal, tidak di-commit)

Arsitektur: monolitik di satu VPS Ubuntu 22.04.5 — Apache 2.4.52 sebagai pintu masuk tunggal,
Flask/Gunicorn dan MySQL 8.0.46 hanya di localhost, Jenkins 2.580.1 di server yang sama.

| Komponen | Temuan saat review | Keputusan |
|---|---|---|
| Apache | HTTPS + redirect OK; tanpa security header; versi terlihat di header `Server` | Tambah `zz-hardening.conf` |
| Flask/Gunicorn | Listen `127.0.0.1:5000` (baik); frontend memanggil `127.0.0.1` sehingga fitur tidak jalan di server; CORS `*` | Proxy `/api/`, CORS allowlist |
| PHP admin | Basic Auth, CSRF, PDO prepared, kredensial di `/etc/isyaratku` | Pertahankan |
| MySQL | bind `127.0.0.1`, tidak ada rule UFW | Pertahankan |
| Jenkins | Port 9090 terbuka ke internet (HTTP), juga di `/jenkins/` | Tutup 9090, hanya via HTTPS |
| SSH | Port 9765 terbuka ke semua IP, login password, tanpa fail2ban | Key-only + fail2ban |
| Satu VPS untuk app + CI | Kompromi Jenkins = kompromi production | Diterima (biaya); mitigasi lewat hardening Jenkins |
| Environment | Hanya production | Tambah staging terpisah |
