# Jadwal Evaluasi Keamanan (H3, H5)

> DRAF 19-11-2026 · PIC: Victoria Palilingan

| Frekuensi | Kegiatan | Bukti yang disimpan |
|---|---|---|
| Otomatis harian | unattended-upgrades (patch keamanan OS), cek AIDE 03:30 | `/var/log/unattended-upgrades/`, `/var/log/aide-check.log` |
| Otomatis tiap build | Secret, SAST, SCA, IaC, DAST di Jenkins | Artifact `reports/` tiap build |
| Mingguan | Tinjau & merge PR Dependabot | PR di GitHub |
| Bulanan | Tinjau alert Telegram, `fail2ban-client status`, log auth, vulnerability register | Catatan review di register |
| Per rilis | Isi [release-checklist.md](release-checklist.md) | Release notes GitHub |
| Per semester | Audit ulang dengan Lecture24 Checklist + pentest di staging | PDF audit & laporan pentest |

Riwayat evaluasi:
| Tanggal | Jenis | Hasil |
|---|---|---|
| 19-11-2026 | Audit DevSecOps pertama (Lecture24) | Skor sementara 7%; temuan V-01 s.d. V-09 |
