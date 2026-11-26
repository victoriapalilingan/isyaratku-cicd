# Changelog

Format mengikuti [Keep a Changelog](https://keepachangelog.com/id-ID/1.1.0/), versi mengikuti [SemVer](https://semver.org/lang/id/).

## [1.0.0] - belum dirilis

### Keamanan
- CORS backend dibatasi ke `pear123.my.id` dan origin pengembangan lokal (sebelumnya semua origin).
- Script three.js dari CDN diberi Subresource Integrity (SRI).
- Frontend memanggil API lewat proxy Apache `/api/` di server (sebelumnya `127.0.0.1:5000`,
  sehingga fitur prediksi tidak berjalan untuk pengunjung).
- Pipeline DevSecOps (`Jenkinsfile`): secret scan, SAST, SCA, scan IaC, SBOM, deploy staging,
  DAST + uji API, persetujuan release, backup dan rollback otomatis.
- Hardening VPS sebagai kode (`infra/ansible/hardening.yml`).
- Dependabot, `SECURITY.md`, dan dokumen keamanan di `docs/security/`.

## Versi sebelumnya
Riwayat sebelum 1.0.0 hanya tercatat di commit Git (20–29 Oktober 2026), tanpa tag maupun release notes.
