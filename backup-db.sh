#!/usr/bin/env bash
#
# Cadangan harian database dashboard. Dipanggil cron; lihat /etc/cron.d/enterprise.
#
#   /srv/enterprise-dashboard/backup-db.sh
#
# Memakai VACUUM INTO lewat backup-db.mjs, bukan `cp`: penyalinan berkas biasa
# bisa menangkap database di tengah penulisan dan menghasilkan cadangan yang
# rusak tanpa terlihat rusak.

set -euo pipefail

DB=/srv/enterprise-data/dashboard.db
DIR=/srv/enterprise-backup
BANTU="$(dirname "$(readlink -f "$0")")/backup-db.mjs"
SIMPAN_HARI=30

NODE_BIN="$(dirname "$(readlink -f /usr/local/bin/node24)")"
export PATH="$NODE_BIN:$PATH"

waktu() { date +%FT%T; }

mkdir -p "$DIR"
TUJUAN="$DIR/dashboard-$(date +%F).db"

# Jalankan ulang di hari yang sama menimpa, bukan menumpuk.
rm -f "$TUJUAN" "$TUJUAN.gz"

node "$BANTU" salin "$DB" "$TUJUAN"
gzip -f "$TUJUAN"

# Cadangan yang tidak bisa dibuka lebih buruk daripada tidak punya cadangan:
# ia memberi rasa aman yang keliru. Jadi tiap salinan dibuka dan diperiksa.
UJI=$(mktemp)
gunzip -c "$TUJUAN.gz" > "$UJI"
if ! JUMLAH=$(node "$BANTU" periksa "$UJI"); then
  rm -f "$UJI"
  echo "$(waktu) GAGAL cadangan $TUJUAN.gz tidak lolos pemeriksaan" >&2
  exit 1
fi
rm -f "$UJI"

echo "$(waktu) OK  $TUJUAN.gz ($(du -h "$TUJUAN.gz" | cut -f1)) users/projects/plans/agenda=$JUMLAH"

# Buang yang lebih tua dari batas simpan.
DIBUANG=$(find "$DIR" -name 'dashboard-*.db.gz' -mtime "+$SIMPAN_HARI" -delete -print | wc -l)
if [ "$DIBUANG" -gt 0 ]; then
  echo "$(waktu) buang $DIBUANG cadangan lebih tua dari $SIMPAN_HARI hari"
fi
