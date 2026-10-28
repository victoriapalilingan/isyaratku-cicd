<?php
/* =========================================
   ISYARATKU - FUNGSI BERSAMA ADMIN
   Koneksi database dan utilitas yang dipakai
   halaman rekap (index.php) dan API
   (api/percobaan.php).

   Kredensial database tidak disimpan di repo.
   Dibaca dari /etc/isyaratku/db.php di server
   (bisa diganti lewat env ISYARATKU_DB_CONFIG
   untuk uji lokal).
   ========================================= */

declare(strict_types=1);

// Waktu ditampilkan dalam WITA.
date_default_timezone_set('Asia/Makassar');

const ALPHABET = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
                  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];

// Sesuai Tabel 6 Skenario Pengujian Sistem Real-Time (testmode.js).
const SCENARIOS = [
    1 => 'Kondisi Ideal',
    2 => 'Pencahayaan Redup',
    3 => 'Pencahayaan Normal',
    4 => 'Background Kompleks',
    5 => 'Pencahayaan Redup dan Background Kompleks',
    6 => 'Variasi Jarak',
    7 => 'Variasi Sudut',
    8 => 'Variasi Pengguna',
];

// 26 huruf x 3 percobaan per skenario.
const TRIALS_PER_SCENARIO = 78;

function h($text): string
{
    return htmlspecialchars((string) ($text ?? ''), ENT_QUOTES, 'UTF-8');
}

function db(): PDO
{
    static $pdo = null;

    if ($pdo !== null) {
        return $pdo;
    }

    $path = getenv('ISYARATKU_DB_CONFIG') ?: '/etc/isyaratku/db.php';

    if (!is_readable($path)) {
        throw new RuntimeException('File konfigurasi database tidak ditemukan.');
    }

    $c = require $path;
    $dsn = $c['dsn'] ?? sprintf(
        'mysql:host=%s;dbname=%s;charset=utf8mb4',
        $c['host'],
        $c['name']
    );

    $pdo = new PDO($dsn, $c['user'] ?? null, $c['pass'] ?? null, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);

    return $pdo;
}
