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


/* =====================================
   LOGIN ADMIN (sesi PHP, menggantikan Basic Auth)
   A6 : ID sesi diganti setelah login
   A8 : logout otomatis setelah 15 menit tidak aktif
   A9 : sesi dihancurkan saat logout
   G1 : login, logout, dan login gagal dicatat
   Password tetap dicek ke .htpasswd (bcrypt).
   ===================================== */

const HTPASSWD_FILE = '/etc/isyaratku/.htpasswd';
const AUTH_LOG_FILE = '/var/log/isyaratku/admin-auth.log';
const IDLE_TIMEOUT  = 15 * 60; // detik

function start_session(): void
{
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
}

/**
 * Catat kejadian login/logout ke log di luar webroot.
 * Username dibersihkan agar tidak bisa menyisipkan baris palsu ke log.
 */
function auth_log(string $event, string $user): void
{
    $user = preg_replace('/[^A-Za-z0-9_.-]/', '?', mb_substr($user, 0, 50));
    $line = sprintf(
        "%s %s user=%s ip=%s\n",
        date('c'),
        $event,
        $user === '' ? '-' : $user,
        $_SERVER['REMOTE_ADDR'] ?? '-'
    );

    if (@file_put_contents(AUTH_LOG_FILE, $line, FILE_APPEND | LOCK_EX) === false) {
        error_log('[isyaratku-auth] ' . trim($line));
    }
}

/** Cocokkan username dan password dengan .htpasswd (hanya hash bcrypt yang diterima). */
function check_credentials(string $user, string $password): bool
{
    $lines = @file(HTPASSWD_FILE, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];
    $hash = null;

    foreach ($lines as $line) {
        [$name, $stored] = array_pad(explode(':', $line, 2), 2, '');
        if ($user !== '' && hash_equals($name, $user)) {
            $hash = $stored;
            break;
        }
    }

    // Username tidak ada: tetap jalankan bcrypt agar waktu respons sama.
    $hash ??= '$2y$12$' . str_repeat('a', 53);

    return password_verify($password, $hash) && str_starts_with($hash, '$2y$');
}

/** Hapus isi sesi, cookie sesi, dan file sesi di server. */
function destroy_session(): void
{
    $_SESSION = [];

    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', [
            'expires'  => time() - 42000,
            'path'     => $p['path'],
            'domain'   => $p['domain'],
            'secure'   => $p['secure'],
            'httponly' => $p['httponly'],
            'samesite' => $p['samesite'] ?: 'Lax',
        ]);
    }

    session_destroy();
}

/**
 * Wajib login. Dipanggil di awal setiap halaman/API admin.
 * $api = true: balas JSON 401, bukan redirect ke halaman login.
 */
function require_login(bool $api = false): void
{
    start_session();

    $user = (string) ($_SESSION['admin_user'] ?? '');
    $reason = '';

    if ($user === '') {
        $reason = 'login';
    } elseif (time() - (int) ($_SESSION['last_activity'] ?? 0) > IDLE_TIMEOUT) {
        auth_log('LOGOUT_IDLE', $user);
        destroy_session();
        $reason = 'timeout';
    }

    if ($reason === '') {
        $_SESSION['last_activity'] = time();
        return;
    }

    if ($api) {
        http_response_code(401);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['status' => 'error', 'message' => 'Belum login admin.']);
        exit;
    }

    header('Location: login.php' . ($reason === 'timeout' ? '?timeout=1' : ''), true, 303);
    exit;
}
