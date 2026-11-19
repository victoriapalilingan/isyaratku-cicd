# Release Checklist (E2, E3, E5)

Salin daftar ini ke deskripsi GitHub Release setiap kali merilis versi baru.

```
Versi       : vX.Y.Z            Tanggal:
Build Jenkins: #                Disetujui oleh:

[ ] Semua stage Jenkins lolos (secret, SAST, SCA, IaC, DAST, uji API)
[ ] Laporan reports/ build ini sudah ditinjau (SCA semua tingkat, ZAP)
[ ] Tidak ada temuan Critical terbuka, ATAU ada persetujuan risiko tertulis di vulnerability register
[ ] SBOM (sbom.cdx.json) dilampirkan ke release
[ ] CHANGELOG.md diperbarui
[ ] Tag git vX.Y.Z dibuat dari commit yang dideploy
[ ] Backup production sebelum deploy tersedia (/var/backups/isyaratku/)
```
