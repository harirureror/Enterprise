#!/usr/bin/env bash
#
# Jalankan pengingat terjadwal. Dipanggil cron; lihat /etc/cron.d/enterprise.
#
#   /srv/enterprise-dashboard/cron-pengingat.sh
#
# Rahasianya dibaca dari .env.production (mode 600), bukan ditulis di crontab:
# berkas di /etc/cron.d terbaca semua pengguna mesin ini.
#
# Memanggil lewat 127.0.0.1, bukan lewat domain: permintaan dari server ke
# domainnya sendiri akan berputar ke Cloudflare dan kembali, dan ufw hanya
# mengizinkan 80/443 dari rentang Cloudflare — jadi ia akan ditolak firewallnya
# sendiri.

set -euo pipefail

APP_DIR=/srv/enterprise-dashboard
cd "$APP_DIR"

# shellcheck disable=SC1091
SECRET="$(grep '^CRON_SECRET=' .env.production | cut -d= -f2-)"
BASE="$(grep '^APP_BASE_PATH=' .env.production | cut -d= -f2- || true)"
PORT="$(grep '^PORT=' .env.production | cut -d= -f2- || echo 3000)"

if [ -z "$SECRET" ]; then
  echo "$(date +%FT%T) GAGAL CRON_SECRET kosong di .env.production" >&2
  exit 1
fi

URL="http://127.0.0.1:${PORT}${BASE}/api/reminders/run"

JAWABAN="$(mktemp)"
KODE="$(curl -s -o "$JAWABAN" -w '%{http_code}' --max-time 60 \
  -X POST -H "Authorization: Bearer $SECRET" "$URL" || echo 000)"

if [ "$KODE" != "200" ]; then
  echo "$(date +%FT%T) GAGAL pengingat HTTP $KODE — $(head -c 200 "$JAWABAN")" >&2
  rm -f "$JAWABAN"
  exit 1
fi

# Ringkas saja: berapa terkirim, berapa dilewati. Rinciannya ada di aplikasi.
RINGKAS="$(node -e '
const fs = require("node:fs");
const d = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
console.log(`terkirim=${d.sentCount} dilewati=${d.skippedCount} asOf=${d.asOf}`);
' "$JAWABAN" 2>/dev/null || echo "jawaban tidak terbaca")"

rm -f "$JAWABAN"
echo "$(date +%FT%T) OK  pengingat $RINGKAS"
