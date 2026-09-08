# Berkas operasional server

Salinan berkas yang dipasang di luar folder aplikasi. Disimpan di repo supaya
terversi dan bisa dipasang ulang kalau servernya harus dibangun dari nol —
bukan untuk dipakai langsung dari sini.

| Berkas di repo | Dipasang di server sebagai |
|---|---|
| `cron-enterprise` | `/etc/cron.d/enterprise` (root:root, 644) |
| `logrotate-enterprise` | `/etc/logrotate.d/enterprise` (644) |

Skrip yang dipanggilnya ada di akar repo dan ikut ter-deploy sendiri:
`cron-pengingat.sh`, `backup-db.sh`, `backup-db.mjs`.

**cron menolak berkas di `/etc/cron.d` yang bisa ditulis kelompok atau orang
lain, dan mengabaikannya diam-diam** — jadi mode 644 milik root itu syarat,
bukan kerapian.
