# Kebijakan Keamanan IsyaratKu

## Melaporkan kerentanan
Jangan membuka issue publik. Kirim laporan ke pemilik repository (Victoria Palilingan) melalui
GitHub **Security → Report a vulnerability**, atau hubungi langsung pemilik repository.

Sertakan: lokasi (URL/file), langkah reproduksi, dan dampak.

## Target waktu penanganan
| Tingkat | Respons awal | Perbaikan |
|---|---|---|
| Critical | 24 jam | 3 hari |
| High | 3 hari | 14 hari |
| Medium | 7 hari | 30 hari |
| Low | 14 hari | rilis berikutnya |

Proses lengkap: [docs/security/incident-response.md](docs/security/incident-response.md).
Daftar temuan: [docs/security/vulnerability-register.md](docs/security/vulnerability-register.md).

## Kontrol otomatis
Setiap perubahan di `main` melewati pipeline Jenkins (`Jenkinsfile`): secret scan, SAST (Semgrep),
SCA (Trivy), scan IaC (Checkov), SBOM, DAST (OWASP ZAP) di staging, dan persetujuan manual sebelum production.
