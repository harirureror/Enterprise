import { type NextRequest, NextResponse } from "next/server";
import { getMemberProfile } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { unauthorized } from "@/lib/auth-response";

/** GET /api/users/{id} — profil satu anggota berikut proyek dan kontribusinya. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesi = await requireSession();
  if (!sesi) return unauthorized();

  const { id } = await params;
  const angka = Number(id);
  if (!Number.isInteger(angka) || angka <= 0) {
    return NextResponse.json(
      { error: "Id anggota harus bilangan bulat positif." },
      { status: 400 }
    );
  }

  const profil = await getMemberProfile(angka);
  if (!profil) return NextResponse.json({ error: "Anggota tidak ditemukan." }, { status: 404 });

  return NextResponse.json(profil);
}
