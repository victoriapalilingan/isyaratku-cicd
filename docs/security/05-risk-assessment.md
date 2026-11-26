# Risk Assessment (A5)

> DRAF 19-11-2026 · PIC: Victoria Palilingan

Skor risiko = Kemungkinan (1–3) × Dampak (1–3): 7–9 **Critical/High**, 4–6 **Medium**, 1–3 **Low**.

## Penilaian kondisi saat ini (hasil audit 19-11-2026)
| Risiko | K | D | Skor | Penanganan |
|---|---|---|---|---|
| Brute force SSH (password, tanpa fail2ban, port terbuka) | 3 | 3 | 9 | Key-only + fail2ban (V-01) |
| Jenkins terbuka di 9090 tanpa HTTPS | 2 | 3 | 6 | Tutup port (V-02) |
| Kode masuk production tanpa review | 2 | 3 | 6 | Ruleset + PR (V-03) |
| Dependency rentan tidak terdeteksi | 2 | 2 | 4 | SCA + Dependabot |
| Clickjacking/MIME sniffing (tanpa header) | 2 | 2 | 4 | Security header (V-04) |
| Perubahan file server tidak terdeteksi | 2 | 2 | 4 | auditd + AIDE (V-06) |

## Template wajib untuk setiap fitur baru (isi SEBELUM implementasi)
```
Fitur        :
Tanggal      :            Penilai:
Data yang disentuh (lihat 04-klasifikasi-data.md):
Endpoint/komponen baru:
Ancaman STRIDE yang relevan:
| Risiko | K | D | Skor | Kontrol |
Keputusan    : lanjut / lanjut dengan kontrol / tunda
```
Simpan sebagai `docs/security/risk/<tanggal>-<fitur>.md` dan tautkan di Pull Request fitur tersebut.
