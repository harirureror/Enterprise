import { type NextRequest, NextResponse } from "next/server";
import { jagaRute } from "@/lib/api-guard";
import { runDueReminders } from "@/lib/api";

/**
 * POST /api/reminders/run — jalankan pengingat terjadwal yang jatuh tempo.
 *
 * Dua jalur masuk, dan hanya satu yang boleh tanpa cookie:
 *
 * - **Penjadwal**: membawa `Authorization: Bearer <CRON_SECRET>`. Tidak butuh
 *   sesi, karena cron memang tidak punya.
 * - **Orang**: tanpa header itu, berlaku aturan biasa — sesi yang sah dengan
 *   kemampuan `ubah-semua-proyek`.
 *
 * Aman dipanggil berkali-kali: setelah jalan, tanggal berikutnya sudah
 * melewati hari ini, jadi pemanggilan ulang tidak mengirim ganda.
 */

/**
 * Penjadwal membawa token, bukan cookie.
 *
 * Ini yang menentukan urutan pemeriksaan di bawah: token diperiksa LEBIH DULU
 * daripada sesi. Sebelumnya penjaga sesi berjalan duluan, sehingga cron selalu
 * ditolak 401 "Perlu masuk" walau tokennya benar — endpoint yang memang dibuat
 * untuk penjadwal tidak pernah bisa dipanggil penjadwal.
 */
function tokenPenjadwal(request: NextRequest): "cocok" | "salah" | "tidak-ada" {
  const secret = process.env.CRON_SECRET;
  const dibawa = request.headers.get("authorization");

  if (!dibawa) return "tidak-ada";
  if (!secret) return "salah";
  return dibawa === `Bearer ${secret}` ? "cocok" : "salah";
}

export async function POST(request: NextRequest) {
  const token = tokenPenjadwal(request);

  if (token === "salah") {
    // Membawa Authorization tapi tidak cocok itu percobaan, bukan kunjungan
    // biasa — jangan diturunkan ke jalur sesi seolah tidak terjadi apa-apa.
    return NextResponse.json({ error: "Tidak berwenang." }, { status: 401 });
  }

  if (token === "tidak-ada") {
    // Tanpa token berarti dipicu orang, bukan penjadwal: berlaku aturan biasa.
    const izin = await jagaRute("ubah-semua-proyek");
    if (!izin.ok) return izin.response;

    // Di produksi, endpoint yang bisa memicu pengiriman massal tidak boleh
    // hidup tanpa rahasia sama sekali.
    if (!process.env.CRON_SECRET && process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "CRON_SECRET belum diatur, penjadwal dinonaktifkan." },
        { status: 503 }
      );
    }
  }

  // `today` hanya untuk pengujian; tanpa itu memakai tanggal hari ini.
  const today = request.nextUrl.searchParams.get("today")?.trim() ?? "";
  if (today !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(today)) {
    return NextResponse.json(
      { error: "Parameter today harus format YYYY-MM-DD." },
      { status: 400 }
    );
  }

  const hasil = await runDueReminders(today === "" ? undefined : today);

  return NextResponse.json({
    ...hasil,
    sentCount: hasil.sent.length,
    skippedCount: hasil.skipped.length,
  });
}
