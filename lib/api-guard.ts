import { NextResponse } from "next/server";
import { getSession } from "./auth";
import { forbidden, unauthorized } from "./auth-response";
import { type Ability, can, isFinanceField } from "./permissions";
import type { User } from "./types";

/* Penjaga route handler.

   Dipisah dari lib/auth.ts supaya berkas itu tetap bisa dipakai server
   component tanpa ikut menarik tipe route handler — alasan yang sama dengan
   lib/auth-response.ts.

   Endpoint API menjawab dengan kode status, bukan mengalihkan: mengarahkan
   pemanggil API ke HTML halaman masuk membuat balasannya tidak bisa diproses. */

export type Izin =
  | { ok: true; user: User; bolehKeuangan: boolean }
  | { ok: false; response: NextResponse };

/**
 * Sesi + kemampuan. `bolehKeuangan` ikut dikembalikan karena hampir setiap
 * endpoint proyek perlu tahu apakah angka keuangannya boleh ikut.
 */
export async function jagaRute(ability: Ability): Promise<Izin> {
  const sesi = await getSession();
  if (!sesi) return { ok: false, response: unauthorized() };

  if (!can(sesi.user.accessLevel, ability)) {
    return { ok: false, response: forbidden() };
  }

  return {
    ok: true,
    user: sesi.user,
    bolehKeuangan: can(sesi.user.accessLevel, "lihat-keuangan"),
  };
}

/** Sesi saja, untuk endpoint yang hanya butuh tahu siapa pemanggilnya. */
export async function jagaSesi(): Promise<Izin> {
  const sesi = await getSession();
  if (!sesi) return { ok: false, response: unauthorized() };
  return {
    ok: true,
    user: sesi.user,
    bolehKeuangan: can(sesi.user.accessLevel, "lihat-keuangan"),
  };
}

/**
 * Buang kunci keuangan dari balasan JSON kalau pemanggilnya tidak berhak.
 *
 * Kuncinya dihapus, bukan nilainya ditimpa null: null di sistem ini berarti
 * "belum diisi", dan menimpanya akan berbohong soal kelengkapan data.
 */
export function saringKeuangan<T extends Record<string, unknown>>(
  row: T,
  boleh: boolean
): Partial<T> {
  if (boleh) return row;

  const bersih: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (!isFinanceField(k)) bersih[k] = v;
  }
  return bersih as Partial<T>;
}

export function saringDaftar<T extends Record<string, unknown>>(
  rows: T[],
  boleh: boolean
): Partial<T>[] {
  return boleh ? rows : rows.map((r) => saringKeuangan(r, false));
}
