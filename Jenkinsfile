// =========================================
// ISYARATKU - PIPELINE DEVSECOPS
// Alur: scan kode -> staging -> DAST & uji API -> persetujuan -> production (backup + rollback otomatis)
// Kebijakan: build berhenti bila ada temuan CRITICAL (SCA/IaC), secret, SAST ERROR, atau alert DAST High.
//
// Prasyarat di VPS & Jenkins: lihat audit/RENCANA_PERBAIKAN.md (Fase 3 & 4).
// SEBELUM job diubah ke "Pipeline script from SCM", samakan PROD_DIR dengan script job lama.
// =========================================

// Jalankan perintah, simpan output ke laporan, tampilkan di console, dan teruskan exit code-nya.
def scan(String cmd, String report) {
    sh """
        set +e
        ${cmd} > "${report}" 2>&1
        rc=\$?
        cat "${report}"
        exit \$rc
    """
}

pipeline {
    agent any

    triggers { githubPush() }

    options {
        timestamps()
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '20'))
    }

    environment {
        STAGING_DIR = '/var/www/staging/isyaratku'
        PROD_DIR    = '/var/www/html/isyaratku'
        BACKUP_DIR  = '/var/backups/isyaratku'
        STAGING_URL = 'https://staging.pear123.my.id'
        PROD_URL    = 'https://pear123.my.id'
        R           = 'reports'
    }

    stages {
        stage('Persiapan') {
            steps {
                sh 'rm -rf "$R" && mkdir -p "$R" && chmod 777 "$R"'   // 777: container ZAP menulis sebagai user lain
            }
        }

        stage('Secret scan') {          // B6
            steps { scan('trivy fs --scanners secret --exit-code 1 --skip-dirs model .', "${R}/secret-scan.txt") }
        }

        stage('SAST') {                 // B5
            steps { scan('semgrep scan --config p/default --severity ERROR --error --metrics=off .', "${R}/sast-semgrep.txt") }
        }

        stage('SCA dependency') {       // B7, C5, H1
            steps {
                // Laporan lengkap semua tingkat risiko, lalu gerbang khusus CRITICAL.
                sh 'trivy fs --scanners vuln --exit-code 0 . > "$R/sca-all.txt" 2>&1'
                scan('trivy fs --scanners vuln --severity CRITICAL --exit-code 1 .', "${R}/sca-critical.txt")
            }
        }

        stage('IaC scan') {             // C4
            steps { scan('checkov -d infra --framework ansible --compact', "${R}/iac-checkov.txt") }
        }

        stage('SBOM') {                 // E4
            steps { sh 'trivy fs --format cyclonedx --output "$R/sbom.cdx.json" .' }
        }

        stage('Deploy staging') {       // F1, D5
            steps {
                // shortcut: tanpa --delete agar file di server yang tidak ada di repo tidak terhapus;
                // pakai --delete setelah isi folder server dipastikan sama dengan frontend/.
                sh 'rsync -a frontend/ "$STAGING_DIR/"'
            }
        }

        stage('DAST & uji API (staging)') {   // C3, D1, D2, D3, D5
            steps {
                withCredentials([usernamePassword(credentialsId: 'staging-basic-auth',
                                                  usernameVariable: 'STG_USER', passwordVariable: 'STG_PASS')]) {
                    sh '''
                        set -e
                        AUTH="$STG_USER:$STG_PASS"

                        # --- Uji keamanan API (otorisasi & validasi input) ---
                        code() { curl -s -o /dev/null -w '%{http_code}' -m 20 "$@"; }
                        expect() { [ "$1" = "$2" ] && echo "OK   $3 -> $1" || { echo "GAGAL $3 -> $1 (harus $2)"; exit 1; }; }
                        set +e   # bukan pipe ke tee: /bin/sh tanpa pipefail akan menelan kegagalan
                        (   # subshell: exit di dalamnya tidak menghentikan skrip sebelum laporan ditampilkan
                          expect "$(code "$PROD_URL/admin/api/percobaan.php")" 401 "admin API tanpa login"
                          expect "$(code "$PROD_URL/.env")" 404 "file .env publik"
                          expect "$(code "$PROD_URL/.git/HEAD")" 404 "folder .git publik"
                          expect "$(code -u "$AUTH" "$STAGING_URL/api/predict")" 405 "GET ke endpoint POST"
                          expect "$(code -u "$AUTH" -X POST "$STAGING_URL/api/predict")" 400 "POST tanpa frame"
                          expect "$(code -u "$AUTH" -X POST -F "frame=@Jenkinsfile;filename=x.jpg" "$STAGING_URL/api/predict")" 400 "frame bukan gambar"
                        ) > "$R/api-security-test.txt" 2>&1
                        rc=$?
                        cat "$R/api-security-test.txt"
                        [ "$rc" -eq 0 ] || exit 1

                        # --- DAST: OWASP ZAP baseline ---
                        docker run --rm -v "$WORKSPACE/$R:/zap/wrk:rw" \
                          -e ZAP_AUTH_HEADER_VALUE="Basic $(printf %s "$AUTH" | base64 -w0)" \
                          ghcr.io/zaproxy/zaproxy:stable \
                          zap-baseline.py -t "$STAGING_URL" -r zap-report.html -J zap-report.json -I
                        set -e
                        HIGH=$(jq '[.site[].alerts[] | select(.riskcode == "3")] | length' "$R/zap-report.json")
                        echo "Alert ZAP risiko High: $HIGH"
                        [ "$HIGH" -eq 0 ]
                    '''
                }
            }
        }

        stage('Persetujuan release') {  // E1, E2, E3
            options { timeout(time: 1, unit: 'DAYS') }
            steps {
                // submitter = ID user Jenkins yang berwenang (samakan dengan Manage Jenkins > Users).
                input message: 'Semua scan lolos. Deploy ke production?', ok: 'Deploy', submitter: 'victoria'
            }
        }

        stage('Backup & deploy production') {   // F2, F5
            steps {
                sh '''
                    mkdir -p "$BACKUP_DIR"
                    tar czf "$BACKUP_DIR/isyaratku-$BUILD_NUMBER.tgz" -C "$PROD_DIR" .
                    ls -1t "$BACKUP_DIR"/isyaratku-*.tgz | tail -n +6 | xargs -r rm -f   # simpan 5 backup terakhir
                    rsync -a frontend/ "$PROD_DIR/"
                '''
            }
        }

        stage('Smoke test & rollback') {        // F5
            steps {
                sh '''
                    for path in / /praktik.html; do
                      if ! curl -fsS -m 20 -o /dev/null "$PROD_URL$path"; then
                        echo "Smoke test gagal di $path -> rollback ke backup build $BUILD_NUMBER"
                        tar xzf "$BACKUP_DIR/isyaratku-$BUILD_NUMBER.tgz" -C "$PROD_DIR"
                        exit 1
                      fi
                    done
                    echo "Smoke test production OK"
                '''
            }
        }
    }

    post {
        always {
            archiveArtifacts artifacts: 'reports/**', allowEmptyArchive: true
        }
        failure {
            // G5. Butuh aturan sudoers khusus untuk skrip ini (RENCANA_PERBAIKAN.md Fase 4).
            sh 'sudo -n /usr/local/bin/notify-telegram "Jenkins $JOB_NAME #$BUILD_NUMBER GAGAL: $BUILD_URL" || true'
        }
    }
}
