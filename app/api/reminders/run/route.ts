import { type NextRequest, NextResponse } from "next/server";
import { jagaRute } from "@/lib/api-guard";
import { runDueReminders } from "@/lib/api";

/**
 * POST /api/reminders/run — jalankan pengingat terjadwal yang jatuh tempo.
 * Ditujukan untuk dipanggil penjadwal (cron), bukan pengguna.
 *
 * Aman dipanggil berkali-kali: setelah jalan, tanggal berikutnya sudah
 * melewati hari ini, jadi pemanggilan ulang tidak mengirim ganda.
 *
 * Dilindungi CRON_SECRET: kalau variabel itu diisi, permintaan wajib membawa
 * header `Authorization: Bearer <secret>`. Di produksi variabel itu wajib ada —
 * endpoint yang bisa memicu pengiriman massal tidak boleh terbuka.
 */

/** `null` kalau boleh lanjut; selain itu balasan penolakan yang sudah jadi. */
function periksaOtorisasi(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    // Tanpa secret, endpoint ini hanya boleh hidup di luar produksi.
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "CRON_SECRET belum diatur, penjadwal dinonaktifkan." },
        { status: 503 }
      );
    }
    return null;
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Tidak berwenang." }, { status: 401 });
  }

  return null;
}

export async function POST(request: NextRequest) {
  const izin = await jagaRute("ubah-semua-proyek");
  if (!izin.ok) return izin.response;

  const ditolak = periksaOtorisasi(request);
  if (ditolak) return ditolak;

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
