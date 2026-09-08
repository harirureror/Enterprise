#!/usr/bin/env bash
#
# Deploy Dashboard Enterprise.
#
#   /srv/enterprise-dashboard/deploy.sh
#
# Ada karena satu jebakan yang pernah menjatuhkan produksi: menjalankan
# `npm ci` sementara NODE_ENV=production membuat npm MELEWATKAN
# devDependencies, dan Tailwind ada di sana. Build gagal, PM2 masuk status
# errored, situsnya mati. Skrip ini memisahkan langkah pasang (butuh
# devDependencies) dari langkah jalan (butuh NODE_ENV=production), supaya
# urutan itu tidak pernah lagi bergantung pada ingatan.

set -euo pipefail

APP_DIR=/srv/enterprise-dashboard
APP_NAME=enterprise
PORT=3000

cd "$APP_DIR"

# Skrip ini menimpa DIRINYA SENDIRI lewat git reset di bawah, dan bash membaca
# berkas skrip sambil menjalankannya. Menukar isinya di tengah jalan membuat
# bash melanjutkan dari posisi byte yang sudah tidak berarti apa-apa: langkah
# yang baru ditambahkan bisa terlewat tanpa satu pun pesan galat.
#
# Ini pernah terjadi. Langkah migrasi disisipkan sebelum build, deploy berjalan
# tampak mulus, dan setiap halaman proyek mati dengan "no such table" karena
# migrasinya tidak pernah dijalankan.
#
# Jadi tarikan kode dikerjakan lebih dulu dan terpisah, lalu skrip menjalankan
# ulang dirinya yang BARU tepat satu kali. Sesudah titik ini, isi skrip yang
# berjalan sudah sama dengan isi berkasnya.
if [ "${DEPLOY_KODE_SUDAH_BARU:-}" != "1" ]; then
  echo "==> Sebelum: $(git log --oneline -1)"
  git fetch --quiet origin
  git reset --quiet --hard origin/main
  echo "==> Sesudah: $(git log --oneline -1)"

  export DEPLOY_KODE_SUDAH_BARU=1
  exec bash "$APP_DIR/deploy.sh" "$@"
fi

# Ikuti symlink, jangan patok versinya: menaikkan Node nanti cukup
# mengarahkan ulang /usr/local/bin/node24 dan skrip ini ikut sendiri.
NODE_BIN="$(dirname "$(readlink -f /usr/local/bin/node24)")"
export PATH="$NODE_BIN:$PATH"

echo "==> Node $(node -v) dari $NODE_BIN"

# LANGKAH PASANG — sengaja TANPA NODE_ENV=production.
echo "==> Memasang dependensi (termasuk devDependencies)"
NODE_ENV=development npm ci --include=dev --no-audit --no-fund >/dev/null

# NODE_ENV=production dan APP_BASE_PATH dibaca dari .env.production supaya
# nilainya satu sumber dengan yang dipakai PM2 dan nginx; kalau ketiganya
# berselisih, asetnya menunjuk ke tempat yang salah dan halamannya rusak tanpa
# pesan galat. Dibaca SESUDAH npm ci, karena NODE_ENV=production di sinilah
# yang dulu membuat devDependencies dilewati.
set -a
# shellcheck disable=SC1091
. ./.env.production
set +a

# LANGKAH MIGRASI — sebelum build, dan karenanya sebelum .next disentuh sama
# sekali. Migrasi yang gagal harus meninggalkan versi lama berjalan utuh, dan
# itu hanya mungkin kalau belum ada yang dibongkar. Migrasi bersifat menambah,
# jadi kode lama yang masih melayani permintaan tidak terganggu olehnya.
echo "==> Mencadangkan database dulu"
./backup-db.sh

echo "==> Menerapkan migrasi database"
if ! npm run db:setup; then
  echo "!!! Migrasi GAGAL — tidak ada yang dibongkar, versi lama tetap melayani"
  echo "!!! Cadangan sebelum migrasi ada di /srv/enterprise-backup"
  exit 1
fi

# Build lama disingkirkan, bukan dihapus: proses yang sedang berjalan masih
# memegang berkasnya, dan kalau build baru gagal kita masih bisa kembali.
rm -rf .next.bak
[ -d .next ] && mv .next .next.bak

echo "==> Build (APP_BASE_PATH=${APP_BASE_PATH:-<kosong>})"
if ! npm run build; then
  echo "!!! Build GAGAL — mengembalikan build sebelumnya, aplikasi tidak disentuh"
  rm -rf .next
  [ -d .next.bak ] && mv .next.bak .next
  exit 1
fi
rm -rf .next.bak

echo "==> Memuat ulang $APP_NAME"
pm2 restart "$APP_NAME" --update-env >/dev/null

# Pemeriksaan kesehatan: gagal di sini harus berisik, bukan diam-diam
# meninggalkan situs mati seperti yang pernah terjadi.
echo -n "==> Menunggu aplikasi siap "
for i in $(seq 1 20); do
  kode="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT${APP_BASE_PATH:-}/login" || true)"
  if [ "$kode" = "200" ]; then
    echo ""
    echo "==> SEHAT — ${APP_BASE_PATH:-}/login menjawab 200"
    pm2 save >/dev/null
    exit 0
  fi
  echo -n "."
  sleep 1
done

echo ""
echo "!!! TIDAK SEHAT setelah 20 detik (kode terakhir: ${kode:-tidak ada})"
echo "!!! Periksa: pm2 logs $APP_NAME --err --lines 30"
exit 1
