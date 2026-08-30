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
