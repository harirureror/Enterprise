import { NextResponse } from "next/server";

/* Dipisah dari lib/auth.ts supaya berkas itu tetap bisa dipakai halaman
   (server component) tanpa ikut menarik tipe route handler. */

/** Balasan seragam untuk permintaan tanpa identitas. */
export function unauthorized() {
  return NextResponse.json(
    { error: "Perlu masuk untuk mengakses data ini." },
    { status: 401 }
  );
}

/**
 * Balasan seragam untuk permintaan yang identitasnya sah tapi haknya tidak
 * cukup. Dibedakan dari 401: 401 berarti "masuk dulu", 403 berarti "sudah
 * masuk, memang bukan hak Anda" — dan pemanggil perlu bisa membedakannya.
 */
export function forbidden() {
  return NextResponse.json(
    { error: "Akses Anda tidak mencakup data ini." },
    { status: 403 }
  );
}
