<?php
/* =========================================
   ISYARATKU - API PERCOBAAN PENGUJIAN
   Dipanggil testmode.js (praktik.html?uji=1).

   POST JSON:
     {"action": "save",   "trials": [ {...}, ... ]}
     {"action": "delete", "trial":  {skenario_id, kode_pengguna,
                                     huruf_target, percobaan_ke}}

   Satu percobaan dikenali dari skenario + kode pengguna
   + huruf + percobaan ke-. Percobaan yang diulang
   (waktu berbeda) menggantikan data lama; unggah ulang
   data yang sama tidak menghapus tanda valid/catatan admin.

   Terkunci Basic Auth bersama folder admin/. Body wajib
   application/json sehingga form dari situs lain tidak
   bisa mengirim data (perlu preflight CORS).
   ========================================= */

declare(strict_types=1);

require __DIR__ . '/../lib.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

// Batas ukuran unggahan: seluruh 624 percobaan ~1 MB.
const MAX_BODY_BYTES = 4 * 1024 * 1024;

function respond(int $code, array $body): void
{
    http_response_code($code);
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
}

function num($value): ?float
{
    return is_numeric($value) ? (float) $value : null;
}

/**
 * Validasi kunci percobaan.
 * Output: [skenario_id, kode_pengguna, huruf_target, percobaan_ke].
 */
function trialKey(array $trial): array
{
    $scenario = (int) ($trial['skenario_id'] ?? 0);
    $user = trim((string) ($trial['kode_pengguna'] ?? ''));
    $letter = strtoupper((string) ($trial['huruf_target'] ?? ''));
    $rep = (int) ($trial['percobaan_ke'] ?? 0);

    if (!isset(SCENARIOS[$scenario]) || !in_array($letter, ALPHABET, true)
        || $rep < 1 || $rep > 3 || mb_strlen($user) > 50) {
        throw new InvalidArgumentException('Data percobaan tidak valid.');
    }

    return [$scenario, $user, $letter, $rep];
}

function saveTrial(PDO $db, array $trial): string
{
    [$scenario, $user, $letter, $rep] = trialKey($trial);

    $time = strtotime((string) ($trial['waktu'] ?? ''));
    if ($time === false) {
        throw new InvalidArgumentException('Waktu percobaan tidak valid.');
    }

    $result = strtoupper((string) ($trial['huruf_hasil'] ?? ''));

    $row = [
        'waktu'                => date('Y-m-d H:i:s', $time),
        'skenario_id'          => $scenario,
        'skenario'             => SCENARIOS[$scenario],
        'pencahayaan'          => mb_substr((string) ($trial['pencahayaan'] ?? ''), 0, 30),
        'latar'                => mb_substr((string) ($trial['latar'] ?? ''), 0, 30),
        'kode_pengguna'        => $user,
        'huruf_target'         => $letter,
        'percobaan_ke'         => $rep,
        'huruf_hasil'          => in_array($result, ALPHABET, true) ? $result : null,
        'keyakinan_hasil'      => num($trial['keyakinan_hasil'] ?? null),
        'benar'                => !empty($trial['benar']) ? 1 : 0,
        'akurasi_frame_persen' => num($trial['akurasi_frame_persen'] ?? null),
        'latency_e2e_rata2_ms' => num($trial['latency_e2e_rata2_ms'] ?? null),
        'fps_sistem'           => num($trial['fps_sistem'] ?? null),
        'data_lengkap'         => json_encode($trial, JSON_UNESCAPED_UNICODE),
    ];

    $find = $db->prepare(
        'SELECT id, waktu FROM pengujian_percobaan
         WHERE skenario_id = ? AND kode_pengguna = ? AND huruf_target = ? AND percobaan_ke = ?'
    );
    $find->execute([$scenario, $user, $letter, $rep]);
    $existing = $find->fetch();

    if (!$existing) {
        $cols = array_keys($row);
        $db->prepare(sprintf(
            'INSERT INTO pengujian_percobaan (%s) VALUES (%s)',
            implode(', ', $cols),
            implode(', ', array_map(fn ($c) => ":$c", $cols))
        ))->execute($row);
        return 'baru';
    }

    // Data yang sama diunggah ulang: tidak ada yang berubah.
    if ($existing['waktu'] === $row['waktu']) {
        return 'sama';
    }

    // Percobaan diulang: ganti hasil dan reset tanda admin.
    $row['valid'] = 1;
    $row['catatan'] = null;
    $sets = implode(', ', array_map(fn ($c) => "$c = :$c", array_keys($row)));
    $db->prepare("UPDATE pengujian_percobaan SET $sets WHERE id = :id")
       ->execute($row + ['id' => $existing['id']]);
    return 'diganti';
}


/* =====================================
   REQUEST
   ===================================== */

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    respond(405, ['status' => 'error', 'message' => 'Gunakan POST.']);
}

if (stripos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') !== 0) {
    respond(415, ['status' => 'error', 'message' => 'Body harus application/json.']);
}

$raw = file_get_contents('php://input', false, null, 0, MAX_BODY_BYTES + 1);
if ($raw === false || strlen($raw) > MAX_BODY_BYTES) {
    respond(413, ['status' => 'error', 'message' => 'Data terlalu besar.']);
}

$body = json_decode($raw, true);
if (!is_array($body)) {
    respond(400, ['status' => 'error', 'message' => 'JSON tidak valid.']);
}

try {
    $db = db();
    $action = $body['action'] ?? '';

    if ($action === 'save') {
        $trials = $body['trials'] ?? null;
        if (!is_array($trials) || !$trials) {
            respond(400, ['status' => 'error', 'message' => 'Tidak ada percobaan yang dikirim.']);
        }

        $counts = ['baru' => 0, 'diganti' => 0, 'sama' => 0];

        $db->beginTransaction();
        foreach ($trials as $trial) {
            if (!is_array($trial)) {
                throw new InvalidArgumentException('Data percobaan tidak valid.');
            }
            $counts[saveTrial($db, $trial)]++;
        }
        $db->commit();

        respond(200, ['status' => 'success', 'saved' => count($trials)] + $counts);
    }

    if ($action === 'delete') {
        [$scenario, $user, $letter, $rep] = trialKey((array) ($body['trial'] ?? []));

        $stmt = $db->prepare(
            'DELETE FROM pengujian_percobaan
             WHERE skenario_id = ? AND kode_pengguna = ? AND huruf_target = ? AND percobaan_ke = ?'
        );
        $stmt->execute([$scenario, $user, $letter, $rep]);

        respond(200, ['status' => 'success', 'deleted' => $stmt->rowCount()]);
    }

    respond(400, ['status' => 'error', 'message' => 'Aksi tidak dikenal.']);

} catch (InvalidArgumentException $e) {
    if (isset($db) && $db->inTransaction()) {
        $db->rollBack();
    }
    respond(422, ['status' => 'error', 'message' => $e->getMessage()]);

} catch (Throwable $e) {
    if (isset($db) && $db->inTransaction()) {
        $db->rollBack();
    }
    error_log('[isyaratku-api] ' . $e->getMessage());
    respond(500, ['status' => 'error', 'message' => 'Gagal menyimpan ke database.']);
}
