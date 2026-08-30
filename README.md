This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Database

SQLite lewat `node:sqlite` bawaan Node — tidak ada dependensi tambahan. Siapkan file
`data/dashboard.db` (migrasi + data awal, aman diulang):

```bash
npx tsx lib/db/setup.ts
```

Path database bisa ditimpa lewat env `DASHBOARD_DB_PATH`. Cek skema: `npx tsx lib/db/db.check.ts`.

## Identitas & Akses

Halaman login belum ada (fase 4). Sementara itu, seluruh kode yang butuh
"siapa yang sedang memakai aplikasi" memanggil `getSession()` di
[lib/auth.ts](lib/auth.ts) — bukan `getCurrentUser()` langsung — supaya nanti
cukup satu berkas yang berubah.

- **Default** — identitas jatuh ke pengguna bawaan dan ditandai `dev-fallback`,
  supaya aplikasinya tetap bisa dipakai sebelum login jadi.
- **`REQUIRE_AUTH=1`** — identitas wajib dibuktikan lewat cookie `jsi_session`;
  tanpa itu endpoint kolaborasi membalas 401.

Cookie sesi sekarang hanya berisi id pengguna dan **belum ditandatangani**, jadi
ini belum bisa disebut kontrol keamanan — verifikasi kredensial menyusul di fase 4.

## Pengingat Terjadwal

Pengingat berulang dikirim oleh job yang dipanggil penjadwal, bukan proses latar
di dalam aplikasi.

- **Vercel** — jadwalnya sudah didefinisikan di `vercel.json` (tiap hari 01:00 UTC)
  dan memanggil `POST /api/reminders/run`.
- **Di luar Vercel** — jalankan `npx tsx lib/jobs/run-reminders.ts` lewat cron
  atau Task Scheduler.

Endpoint-nya dilindungi env `CRON_SECRET`: kalau diisi, permintaan wajib membawa
header `Authorization: Bearer <secret>`. Di produksi variabel itu **wajib** ada —
tanpa itu endpoint membalas 503 dan penjadwal tidak jalan.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
