# Prosedur Incident Response (H4)

> DRAF 19-11-2026 · Penanggung jawab insiden: Victoria Palilingan

## 1. Deteksi
Sumber: alert Telegram (fail2ban, AIDE, build Jenkins gagal), laporan pengguna, temuan scan.
Catat waktu, sumber, dan gejala di vulnerability register.

## 2. Klasifikasi
Tentukan tingkat (Critical/High/Medium/Low) — SLA di [SECURITY.md](../../SECURITY.md).

## 3. Isolasi (pilih yang relevan)
```bash
sudo fail2ban-client set sshd banip <IP>            # blokir IP penyerang
sudo ufw deny from <IP>                              # blokir permanen
sudo systemctl stop jenkins                          # hentikan deploy otomatis
sudo a2dissite pear123.my.id-le-ssl && sudo systemctl reload apache2   # maintenance darurat
```

## 4. Pemulihan
Rollback ke backup production terakhir yang sehat:
```bash
ls -1t /var/backups/isyaratku/
sudo tar xzf /var/backups/isyaratku/isyaratku-<NOMOR_BUILD>.tgz -C /var/www/html/isyaratku
```
Jika kredensial mungkin bocor: ganti password MySQL (`/etc/isyaratku/db.php`), `.htpasswd`, token GitHub & Telegram
di Jenkins Credentials, dan hapus SSH key yang tidak dikenal dari `~/.ssh/authorized_keys`.

## 5. Investigasi
```bash
sudo grep -E 'Accepted|Failed' /var/log/auth.log | tail -50
sudo ausearch -k apache_conf -k sshd_conf -k app_secret --start recent
sudo tail -100 /var/log/apache2/access.log
sudo cat /var/log/aide-check.log
```

## 6. Pelaporan & perbaikan
Dalam 3 hari: tulis ringkasan (kronologi, dampak, akar masalah, perbaikan) di vulnerability register,
tambahkan pencegahan ke pipeline/konfigurasi, dan evaluasi di review bulanan.
