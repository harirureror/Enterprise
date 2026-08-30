import { type NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { getSessionUserId, revokeAllForUser, revokeSession } from "@/lib/session";

/**
 * POST /api/auth/logout[?all=1] — cabut sesi dan hapus cookie.
 *
 * `all=1` mencabut seluruh sesi milik pengguna itu, bukan hanya perangkat yang
 * sedang dipakai. Ini yang dibutuhkan saat token dicurigai bocor: menghapus
 * cookie di satu peramban tidak ada gunanya kalau salinannya masih hidup.
 *
 * Selalu menjawab 200, termasuk saat tidak ada sesi: keluar itu operasi yang
 * hasil akhirnya sama ("tidak masuk lagi"), dan membedakannya cuma memberi
 * tahu pemanggil apakah tokennya tadi sah.
 */
export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const semua = request.nextUrl.searchParams.get("all") === "1";

  let dicabut = 0;
  if (token) {
    // Pemiliknya dicari sebelum dicabut — setelah dicabut, tokennya sudah
    // tidak menunjuk siapa pun.
    const userId = semua ? getSessionUserId(token) : null;
    dicabut = userId !== null ? revokeAllForUser(userId) : revokeSession(token) ? 1 : 0;
  }

  const response = NextResponse.json({ ok: true, revoked: dicabut, allDevices: semua });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
