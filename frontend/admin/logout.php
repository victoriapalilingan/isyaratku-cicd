<?php
/* =========================================
   ISYARATKU - LOGOUT ADMIN
   Hanya lewat POST + token CSRF, supaya link
   dari situs lain tidak bisa memaksa logout.
   ========================================= */

declare(strict_types=1);

require __DIR__ . '/lib.php';

start_session();

$token = (string) ($_SESSION['csrf'] ?? '');

if ($_SERVER['REQUEST_METHOD'] !== 'POST'
    || $token === ''
    || !hash_equals($token, (string) ($_POST['csrf'] ?? ''))) {
    header('Location: ./', true, 303);
    exit;
}

auth_log('LOGOUT', (string) ($_SESSION['admin_user'] ?? ''));

// A9: sesi dihancurkan saat logout.
destroy_session();

header('Location: login.php?logout=1', true, 303);
exit;
