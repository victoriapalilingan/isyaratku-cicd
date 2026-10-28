<?php
/* =========================================
   ISYARATKU - REKAP PENGUJIAN REAL-TIME (CRUD)
   Create : otomatis dari testmode.js lewat api/percobaan.php
   Read   : rekap akurasi per skenario + daftar percobaan
   Update : tandai valid/tidak valid dan beri catatan
   Delete : hapus percobaan yang gagal agar bisa diulang

   Halaman ini dikunci Basic Auth Apache
   (/etc/apache2/conf-available/isyaratku-admin.conf).
   ========================================= */

declare(strict_types=1);

require __DIR__ . '/lib.php';

session_start();

if (empty($_SESSION['csrf'])) {
    $_SESSION['csrf'] = bin2hex(random_bytes(32));
}
$csrf = $_SESSION['csrf'];

function flash(string $type, string $message): void
{
    $_SESSION['flash'] = ['type' => $type, 'message' => $message];
}

// Pola Post/Redirect/Get; filter yang aktif tetap dipertahankan.
function redirect(string $query = ''): void
{
    header('Location: ' . strtok($_SERVER['REQUEST_URI'], '?') . $query, true, 303);
    exit;
}

// MySQL mengembalikan DECIMAL dan AVG() sebagai string,
// jadi nilai numerik dalam bentuk teks juga diterima.
function pct($value): string
{
    return is_numeric($value) ? number_format((float) $value, 1, ',', '.') . '%' : '–';
}

function ms($value): string
{
    return is_numeric($value) ? number_format((float) $value, 0, ',', '.') . ' ms' : '–';
}


/* =====================================
   FILTER (dari query string)
   ===================================== */

$filter = [
    'skenario' => isset(SCENARIOS[(int) ($_GET['skenario'] ?? 0)]) ? (int) $_GET['skenario'] : 0,
    'pengguna' => trim((string) ($_GET['pengguna'] ?? '')),
    'status'   => in_array($_GET['status'] ?? '', ['valid', 'tidak'], true) ? $_GET['status'] : '',
];

$where = [];
$params = [];

if ($filter['skenario']) {
    $where[] = 'skenario_id = :skenario';
    $params['skenario'] = $filter['skenario'];
}
if ($filter['pengguna'] !== '') {
    $where[] = 'kode_pengguna = :pengguna';
    $params['pengguna'] = $filter['pengguna'];
}
if ($filter['status'] !== '') {
    $where[] = 'valid = :valid';
    $params['valid'] = $filter['status'] === 'valid' ? 1 : 0;
}

$whereSql = $where ? 'WHERE ' . implode(' AND ', $where) : '';
$filterQuery = http_build_query(array_filter($filter));


try {

    /* =====================================
       UPDATE / DELETE
       ===================================== */

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {

        $back = (string) ($_POST['back'] ?? '');
        $back = $back !== '' ? '?' . $back : '';

        if (!hash_equals($csrf, (string) ($_POST['csrf'] ?? ''))) {
            flash('error', 'Sesi kedaluwarsa. Silakan ulangi.');
            redirect($back);
        }

        $id = (int) ($_POST['id'] ?? 0);
        $action = $_POST['action'] ?? '';

        if ($action === 'update') {
            $note = trim((string) ($_POST['catatan'] ?? ''));

            if (mb_strlen($note) > 500) {
                flash('error', 'Catatan maksimal 500 karakter.');
                redirect('?edit=' . $id . ($back ? '&' . substr($back, 1) : ''));
            }

            $stmt = db()->prepare(
                'UPDATE pengujian_percobaan SET valid = :valid, catatan = :catatan WHERE id = :id'
            );
            $stmt->execute([
                'valid'   => isset($_POST['valid']) ? 1 : 0,
                'catatan' => $note === '' ? null : $note,
                'id'      => $id,
            ]);
            flash('success', 'Percobaan berhasil diperbarui.');
            redirect($back);
        }

        if ($action === 'delete') {
            $stmt = db()->prepare('DELETE FROM pengujian_percobaan WHERE id = :id');
            $stmt->execute(['id' => $id]);
            flash(
                $stmt->rowCount() ? 'success' : 'error',
                $stmt->rowCount()
                    ? 'Percobaan dihapus. Ulangi percobaan ini di mode pengujian.'
                    : 'Data tidak ditemukan.'
            );
            redirect($back);
        }
    }


    /* =====================================
       EXPORT CSV (Read)
       ===================================== */

    if (($_GET['export'] ?? '') === 'csv') {
        $stmt = db()->prepare(
            "SELECT * FROM pengujian_percobaan $whereSql
             ORDER BY skenario_id, kode_pengguna, huruf_target, percobaan_ke"
        );
        $stmt->execute($params);

        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="isyaratku_pengujian_server_' . date('Ymd_His') . '.csv"');

        $out = fopen('php://output', 'w');
        fwrite($out, "\xEF\xBB\xBF");

        $header = null;
        while ($row = $stmt->fetch()) {
            // Kolom asli dari testmode.js + kolom admin.
            $full = json_decode((string) $row['data_lengkap'], true) ?: [];
            $line = $full + ['valid' => $row['valid'], 'catatan' => $row['catatan']];

            if ($header === null) {
                $header = array_keys($line);
                fputcsv($out, $header);
            }
            fputcsv($out, array_map(
                fn ($key) => is_bool($line[$key] ?? null) ? (int) $line[$key] : ($line[$key] ?? ''),
                $header
            ));
        }
        fclose($out);
        exit;
    }


    /* =====================================
       READ: REKAP PER SKENARIO
       ===================================== */

    // Rekap hanya menghitung percobaan valid.
    $summaryRows = db()->query(
        'SELECT skenario_id,
                COUNT(*) AS jumlah,
                SUM(benar) AS benar,
                AVG(latency_e2e_rata2_ms) AS latency,
                AVG(fps_sistem) AS fps
         FROM pengujian_percobaan
         WHERE valid = 1
         GROUP BY skenario_id'
    )->fetchAll();

    $summary = [];
    foreach ($summaryRows as $row) {
        $summary[(int) $row['skenario_id']] = $row;
    }

    $total = ['jumlah' => 0, 'benar' => 0];
    foreach ($summary as $row) {
        $total['jumlah'] += (int) $row['jumlah'];
        $total['benar'] += (int) $row['benar'];
    }

    $invalidCount = (int) db()->query(
        'SELECT COUNT(*) FROM pengujian_percobaan WHERE valid = 0'
    )->fetchColumn();


    /* =====================================
       READ: DAFTAR PERCOBAAN
       ===================================== */

    $stmt = db()->prepare(
        "SELECT id, waktu, skenario_id, kode_pengguna, huruf_target, percobaan_ke,
                huruf_hasil, keyakinan_hasil, benar, akurasi_frame_persen,
                latency_e2e_rata2_ms, valid, catatan
         FROM pengujian_percobaan $whereSql
         ORDER BY skenario_id, kode_pengguna, huruf_target, percobaan_ke"
    );
    $stmt->execute($params);
    $trials = $stmt->fetchAll();

    $users = db()->query(
        "SELECT DISTINCT kode_pengguna FROM pengujian_percobaan
         WHERE kode_pengguna <> '' ORDER BY kode_pengguna"
    )->fetchAll(PDO::FETCH_COLUMN);

    // Mode edit: ?edit=<id>
    $editing = null;
    if (isset($_GET['edit'])) {
        $stmt = db()->prepare('SELECT * FROM pengujian_percobaan WHERE id = :id');
        $stmt->execute(['id' => (int) $_GET['edit']]);
        $editing = $stmt->fetch() ?: null;
    }

    $dbError = null;

} catch (Throwable $e) {
    error_log('[isyaratku-admin] ' . $e->getMessage());
    $dbError = 'Tidak dapat terhubung ke database. Periksa konfigurasi server.';
    $summary = [];
    $total = ['jumlah' => 0, 'benar' => 0];
    $invalidCount = 0;
    $trials = [];
    $users = [];
    $editing = null;
}

$flash = $_SESSION['flash'] ?? null;
unset($_SESSION['flash']);
?>
<!DOCTYPE html>
<html lang="id">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="noindex, nofollow">

    <title>Rekap Pengujian – IsyaratKu</title>

    <link rel="stylesheet" href="../css/theme.css">
    <link rel="stylesheet" href="admin.css">
</head>

<body>

    <header class="admin-header">
        <a href="../index.html" class="admin-brand">isyaratku<span>.</span></a>
        <span class="admin-badge">Admin</span>
    </header>

    <main class="admin-main">

        <div class="admin-title">
            <p class="admin-eyebrow">Pengujian sistem real-time</p>
            <h1>Rekap Hasil Pengujian</h1>
            <p class="admin-sub">
                Data dikirim otomatis dari mode pengujian
                (<a href="../praktik.html?uji=1">praktik.html?uji=1</a>).
                Rekap hanya menghitung percobaan valid.
            </p>
        </div>

        <?php if ($dbError): ?>
            <div class="alert alert-error" role="alert"><?= h($dbError) ?></div>
        <?php endif; ?>

        <?php if ($flash): ?>
            <div class="alert alert-<?= h($flash['type']) ?>" role="status"><?= h($flash['message']) ?></div>
        <?php endif; ?>

        <?php if (!$dbError): ?>

        <!-- ===== RINGKASAN ===== -->
        <div class="stats">
            <div class="stat">
                <span class="stat-label">Percobaan valid</span>
                <strong class="stat-value"><?= $total['jumlah'] ?></strong>
                <span class="stat-note">dari target <?= TRIALS_PER_SCENARIO * count(SCENARIOS) ?></span>
            </div>
            <div class="stat">
                <span class="stat-label">Akurasi keseluruhan</span>
                <strong class="stat-value">
                    <?= pct($total['jumlah'] ? $total['benar'] / $total['jumlah'] * 100 : null) ?>
                </strong>
                <span class="stat-note"><?= $total['benar'] ?> benar</span>
            </div>
            <div class="stat">
                <span class="stat-label">Ditandai tidak valid</span>
                <strong class="stat-value"><?= $invalidCount ?></strong>
                <span class="stat-note">tidak masuk rekap</span>
            </div>
        </div>


        <!-- ===== READ: REKAP PER SKENARIO ===== -->
        <section class="card" aria-labelledby="summary-title">
            <h2 id="summary-title">Akurasi per skenario</h2>

            <div class="table-wrap">
                <table class="summary-table">
                    <thead>
                        <tr>
                            <th scope="col">Skenario</th>
                            <th scope="col">Progres</th>
                            <th scope="col" class="num">Akurasi</th>
                            <th scope="col" class="num">Latency rata-rata</th>
                            <th scope="col" class="num">FPS sistem</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach (SCENARIOS as $id => $name):
                            $row = $summary[$id] ?? null;
                            $count = (int) ($row['jumlah'] ?? 0);
                            $progress = min(100, $count / TRIALS_PER_SCENARIO * 100);
                        ?>
                            <tr>
                                <td>
                                    <a href="?skenario=<?= $id ?>" class="scenario-link">
                                        <span class="scenario-no"><?= $id ?></span><?= h($name) ?>
                                    </a>
                                </td>
                                <td>
                                    <div class="progress" aria-label="<?= $count ?> dari <?= TRIALS_PER_SCENARIO ?>">
                                        <span style="width: <?= round($progress, 1) ?>%"></span>
                                    </div>
                                    <span class="progress-text"><?= $count ?>/<?= TRIALS_PER_SCENARIO ?></span>
                                </td>
                                <td class="num">
                                    <?= pct($count ? (int) $row['benar'] / $count * 100 : null) ?>
                                </td>
                                <td class="num"><?= ms($row['latency'] ?? null) ?></td>
                                <td class="num">
                                    <?= isset($row['fps']) ? number_format((float) $row['fps'], 1, ',', '.') : '–' ?>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        </section>


        <!-- ===== UPDATE: FORM EDIT ===== -->
        <?php if ($editing): ?>
            <section class="card card-edit" id="edit" aria-labelledby="edit-title">
                <h2 id="edit-title">
                    Edit percobaan: skenario <?= (int) $editing['skenario_id'] ?>,
                    huruf <?= h($editing['huruf_target']) ?> ke-<?= (int) $editing['percobaan_ke'] ?>
                </h2>

                <dl class="detail">
                    <div><dt>Waktu</dt><dd><?= h(substr((string) $editing['waktu'], 0, 16)) ?></dd></div>
                    <div><dt>Pengguna</dt><dd><?= h($editing['kode_pengguna'] ?: '–') ?></dd></div>
                    <div><dt>Hasil</dt><dd><?= h($editing['huruf_hasil'] ?: 'tidak stabil') ?></dd></div>
                    <div><dt>Keyakinan</dt><dd><?= pct($editing['keyakinan_hasil'] !== null ? (float) $editing['keyakinan_hasil'] * 100 : null) ?></dd></div>
                    <div><dt>Akurasi frame</dt><dd><?= pct($editing['akurasi_frame_persen'] !== null ? (float) $editing['akurasi_frame_persen'] : null) ?></dd></div>
                    <div><dt>Latency</dt><dd><?= ms($editing['latency_e2e_rata2_ms'] !== null ? (float) $editing['latency_e2e_rata2_ms'] : null) ?></dd></div>
                </dl>

                <form method="post" class="edit-form">
                    <input type="hidden" name="csrf" value="<?= h($csrf) ?>">
                    <input type="hidden" name="action" value="update">
                    <input type="hidden" name="id" value="<?= (int) $editing['id'] ?>">
                    <input type="hidden" name="back" value="<?= h($filterQuery) ?>">

                    <label class="check">
                        <input type="checkbox" name="valid" value="1" <?= $editing['valid'] ? 'checked' : '' ?>>
                        Percobaan valid (masuk rekap)
                    </label>

                    <label class="field">
                        <span>Catatan</span>
                        <textarea name="catatan" rows="2" maxlength="500"
                                  placeholder="Contoh: peraga terganggu, tangan keluar frame."><?= h($editing['catatan']) ?></textarea>
                    </label>

                    <div class="actions">
                        <button type="submit" class="btn btn-primary">Simpan perubahan</button>
                        <a href="?<?= h($filterQuery) ?>" class="btn btn-ghost">Batal</a>
                    </div>
                </form>
            </section>
        <?php endif; ?>


        <!-- ===== READ: DAFTAR PERCOBAAN ===== -->
        <section class="card" aria-labelledby="list-title">
            <div class="card-head">
                <h2 id="list-title">Daftar percobaan <span class="count"><?= count($trials) ?></span></h2>
                <a href="?<?= h(http_build_query(array_filter($filter) + ['export' => 'csv'])) ?>"
                   class="btn btn-small">Unduh CSV</a>
            </div>

            <form method="get" class="filters">
                <label class="field">
                    <span>Skenario</span>
                    <select name="skenario">
                        <option value="">Semua</option>
                        <?php foreach (SCENARIOS as $id => $name): ?>
                            <option value="<?= $id ?>" <?= $filter['skenario'] === $id ? 'selected' : '' ?>>
                                <?= $id ?>. <?= h($name) ?>
                            </option>
                        <?php endforeach; ?>
                    </select>
                </label>

                <label class="field">
                    <span>Pengguna</span>
                    <select name="pengguna">
                        <option value="">Semua</option>
                        <?php foreach ($users as $user): ?>
                            <option value="<?= h($user) ?>" <?= $filter['pengguna'] === $user ? 'selected' : '' ?>>
                                <?= h($user) ?>
                            </option>
                        <?php endforeach; ?>
                    </select>
                </label>

                <label class="field">
                    <span>Status</span>
                    <select name="status">
                        <option value="">Semua</option>
                        <option value="valid" <?= $filter['status'] === 'valid' ? 'selected' : '' ?>>Valid</option>
                        <option value="tidak" <?= $filter['status'] === 'tidak' ? 'selected' : '' ?>>Tidak valid</option>
                    </select>
                </label>

                <div class="filter-actions">
                    <button type="submit" class="btn btn-small btn-primary">Terapkan</button>
                    <?php if ($filterQuery !== ''): ?>
                        <a href="./" class="btn btn-small btn-ghost">Reset</a>
                    <?php endif; ?>
                </div>
            </form>

            <?php if (!$trials): ?>
                <p class="muted empty">
                    Belum ada percobaan<?= $filterQuery !== '' ? ' yang cocok dengan filter' : '' ?>.
                    Jalankan mode pengujian untuk mengisi data.
                </p>
            <?php else: ?>

            <div class="table-wrap">
                <table class="trial-table">
                    <thead>
                        <tr>
                            <th scope="col">Sk.</th>
                            <th scope="col">Pengguna</th>
                            <th scope="col">Target</th>
                            <th scope="col">Ke</th>
                            <th scope="col">Hasil</th>
                            <th scope="col" class="num">Keyakinan</th>
                            <th scope="col" class="num">Latency</th>
                            <th scope="col">Status</th>
                            <th scope="col"><span class="sr-only">Aksi</span></th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($trials as $row): ?>
                            <tr class="<?= $row['valid'] ? '' : 'is-invalid' ?> <?= $editing && (int) $editing['id'] === (int) $row['id'] ? 'is-editing' : '' ?>">
                                <td><?= (int) $row['skenario_id'] ?></td>
                                <td><?= h($row['kode_pengguna'] ?: '–') ?></td>
                                <td class="col-letter"><?= h($row['huruf_target']) ?></td>
                                <td><?= (int) $row['percobaan_ke'] ?></td>
                                <td>
                                    <span class="result <?= $row['benar'] ? 'ok' : 'bad' ?>">
                                        <?= h($row['huruf_hasil'] ?: '–') ?>
                                        <span class="sr-only"><?= $row['benar'] ? 'benar' : 'salah' ?></span>
                                    </span>
                                </td>
                                <td class="num"><?= pct($row['keyakinan_hasil'] !== null ? (float) $row['keyakinan_hasil'] * 100 : null) ?></td>
                                <td class="num"><?= ms($row['latency_e2e_rata2_ms'] !== null ? (float) $row['latency_e2e_rata2_ms'] : null) ?></td>
                                <td>
                                    <?php if ($row['valid']): ?>
                                        <span class="pill pill-ok">Valid</span>
                                    <?php else: ?>
                                        <span class="pill">Tidak valid</span>
                                    <?php endif; ?>
                                    <?php if ($row['catatan']): ?>
                                        <span class="note" title="<?= h($row['catatan']) ?>"><?= h(mb_strimwidth($row['catatan'], 0, 40, '…')) ?></span>
                                    <?php endif; ?>
                                </td>
                                <td class="col-actions">
                                    <a href="?<?= h(http_build_query(array_filter($filter) + ['edit' => (int) $row['id']])) ?>#edit"
                                       class="btn btn-small">Edit</a>
                                    <form method="post"
                                          onsubmit="return confirm('Hapus percobaan huruf <?= h($row['huruf_target']) ?> ke-<?= (int) $row['percobaan_ke'] ?> (skenario <?= (int) $row['skenario_id'] ?>)?');">
                                        <input type="hidden" name="csrf" value="<?= h($csrf) ?>">
                                        <input type="hidden" name="action" value="delete">
                                        <input type="hidden" name="id" value="<?= (int) $row['id'] ?>">
                                        <input type="hidden" name="back" value="<?= h($filterQuery) ?>">
                                        <button type="submit" class="btn btn-small btn-danger">Hapus</button>
                                    </form>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>

            <?php endif; ?>
        </section>

        <?php endif; ?>

    </main>

</body>

</html>
