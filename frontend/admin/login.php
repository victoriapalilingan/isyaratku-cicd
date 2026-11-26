<?php
/* =========================================
   ISYARATKU - LOGIN ADMIN
   Menggantikan Basic Auth Apache.
   Password dicek ke /etc/isyaratku/.htpasswd (bcrypt).
   ========================================= */

declare(strict_types=1);

require __DIR__ . '/lib.php';

start_session();

// Sudah login: langsung ke halaman rekap.
if (!empty($_SESSION['admin_user'])) {
    header('Location: ./', true, 303);
    exit;
}

if (empty($_SESSION['login_csrf'])) {
    $_SESSION['login_csrf'] = bin2hex(random_bytes(32));
}

$error = '';
$user = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $user = trim((string) ($_POST['username'] ?? ''));
    $password = (string) ($_POST['password'] ?? '');

    if (!hash_equals($_SESSION['login_csrf'], (string) ($_POST['csrf'] ?? ''))) {
        $error = 'Sesi kedaluwarsa. Silakan coba lagi.';
    } elseif (check_credentials($user, $password)) {
        // A6: ID sesi baru setelah login (mencegah session fixation).
        session_regenerate_id(true);
        unset($_SESSION['login_csrf']);
        $_SESSION['admin_user'] = $user;
        $_SESSION['last_activity'] = time();
        auth_log('LOGIN_OK', $user);

        header('Location: ./', true, 303);
        exit;
    } else {
        auth_log('LOGIN_FAILED', $user);
        sleep(1); // memperlambat percobaan tebak password
        $error = 'Username atau password salah.';
    }
}

$notice = '';
if (isset($_GET['timeout'])) {
    $notice = 'Sesi berakhir karena tidak ada aktivitas selama 15 menit. Silakan login lagi.';
} elseif (isset($_GET['logout'])) {
    $notice = 'Anda sudah logout.';
}
?>
<!DOCTYPE html>
<html lang="id">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="noindex, nofollow">

    <title>Login Admin – IsyaratKu</title>

    <link rel="stylesheet" href="../css/theme.css">
    <link rel="stylesheet" href="admin.css">
</head>

<body>

    <header class="admin-header">
        <a href="../index.html" class="admin-brand">isyaratku<span>.</span></a>
        <span class="admin-badge">Admin</span>
    </header>

    <main class="admin-main login-main">
        <section class="card login-card">
            <h2>Login Admin</h2>

            <?php if ($error !== ''): ?>
                <p class="alert alert-error" role="alert"><?= h($error) ?></p>
            <?php elseif ($notice !== ''): ?>
                <p class="alert alert-success" role="status"><?= h($notice) ?></p>
            <?php endif; ?>

            <form method="post" class="login-form">
                <input type="hidden" name="csrf" value="<?= h($_SESSION['login_csrf']) ?>">

                <label class="field">
                    <span>Username</span>
                    <input type="text" name="username" value="<?= h($user) ?>"
                           required maxlength="50" autocomplete="username" autofocus>
                </label>

                <label class="field">
                    <span>Password</span>
                    <input type="password" name="password" required autocomplete="current-password">
                </label>

                <button type="submit" class="btn btn-primary">Masuk</button>
            </form>
        </section>
    </main>

</body>

</html>
