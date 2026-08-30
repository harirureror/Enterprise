import { type NextRequest, NextResponse } from "next/server";

/**
 * Lapis pertama proteksi rute.
 *
 * Middleware jalan di Edge runtime, jadi di sini sengaja HANYA memeriksa bentuk
 * cookie sesi — tidak mencocokkannya ke daftar pengguna. Pemeriksaan sungguhan
 * tetap di `app/(app)/layout.tsx` lewat `getSession()`, yang bisa membaca data.
 * Gunanya lapisan ini: menghentikan permintaan sebelum halaman dirender, dan
 * ikut melindungi rute baru tanpa perlu diingat satu per satu.
 *
 * ponytail: setelah cookie ditandatangani, verifikasi tanda tangannya bisa
 * ikut di sini karena tidak butuh akses data.
 */

const SESSION_COOKIE = "jsi_session";

/** Bentuk token sesi; disalin dari lib/session.ts karena middleware jalan di
    Edge runtime dan sebaiknya tidak menarik modul yang menyentuh data. */
const TOKEN_PATTERN = /^[0-9a-f]{64}$/;

/** Rute yang boleh diakses tanpa sesi. */
const PUBLIK = ["/login"];

export function middleware(request: NextRequest) {
  // Selama login belum wajib, jangan menghalangi apa pun — aplikasinya memang
  // belum punya cara untuk masuk.
  if (process.env.REQUIRE_AUTH !== "1") return NextResponse.next();

  const { pathname } = request.nextUrl;
  const nilai = request.cookies.get(SESSION_COOKIE)?.value ?? "";
  const punyaSesi = TOKEN_PATTERN.test(nilai);

  if (PUBLIK.includes(pathname)) {
    // Sudah masuk tapi membuka halaman login: antar ke tujuan semula.
    if (punyaSesi) {
      const tujuan = request.nextUrl.searchParams.get("next");
      const url = request.nextUrl.clone();
      // Hanya path internal yang diterima, supaya tidak bisa dipakai
      // mengarahkan orang ke situs lain lewat tautan.
      url.pathname = tujuan?.startsWith("/") && !tujuan.startsWith("//") ? tujuan : "/";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (punyaSesi) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  // Simpan halaman yang dituju supaya bisa dikembalikan setelah masuk.
  url.search = `?next=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  /*
   * Route handler tidak ikut: endpoint API menjawab sendiri dengan 401 lewat
   * `requireSession()`, dan mengalihkannya ke HTML halaman login akan membuat
   * pemanggil API menerima jawaban yang tidak bisa diproses.
   */
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
