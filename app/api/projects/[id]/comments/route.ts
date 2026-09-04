import { type NextRequest, NextResponse } from "next/server";
import { createComment, getComments, getProject } from "@/lib/api";
import { jagaRute } from "@/lib/api-guard";
import { validateComment } from "@/lib/comment-form";

/**
 * Diskusi sebuah proyek: GET (baca) dan POST (tulis).
 *
 * Penulis diambil dari sesi, tidak pernah dari body — kalau bisa ditentukan
 * pemanggil, komentar bisa dipalsukan atas nama orang lain.
 */

async function bacaId(params: Promise<{ id: string }>): Promise<number | null> {
  const { id } = await params;
  const angka = Number(id);
  return Number.isInteger(angka) && angka > 0 ? angka : null;
}

const idTidakValid = NextResponse.json(
  { error: "Id proyek harus bilangan bulat positif." },
  { status: 400 }
);

const tidakDitemukan = NextResponse.json({ error: "Proyek tidak ditemukan." }, { status: 404 });

/** Batas bawaan supaya diskusi panjang tidak dikirim sekaligus. */
const LIMIT_DEFAULT = 50;
const LIMIT_MAX = 200;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const izin = await jagaRute("lihat-detail");
  if (!izin.ok) return izin.response;
  const sesi = { user: izin.user };

  const id = await bacaId(params);
  if (id === null) return idTidakValid;
  if (!(await getProject(id))) return tidakDitemukan;

  const limitRaw = request.nextUrl.searchParams.get("limit")?.trim() ?? "";
  if (limitRaw !== "" && !/^\d+$/.test(limitRaw)) {
    return NextResponse.json(
      { error: "Parameter limit harus bilangan bulat positif." },
      { status: 400 }
    );
  }

  const limit = Math.min(limitRaw === "" ? LIMIT_DEFAULT : Number(limitRaw), LIMIT_MAX);
  const semua = await getComments(id);
  // Diambil dari ujung terbaru, tapi urutannya tetap terlama-dulu supaya
  // terbaca sebagai percakapan.
  const comments = limit === 0 ? [] : semua.slice(-limit);

  return NextResponse.json({
    projectId: id,
    comments: comments.map((c) => ({ ...c, mine: c.userId === sesi.user.id })),
    count: comments.length,
    /** Jumlah seluruh komentar sebelum dipotong batas. */
    total: semua.length,
    hasMore: comments.length < semua.length,
    limit,
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const izin = await jagaRute("kolaborasi");
  if (!izin.ok) return izin.response;
  const sesi = { user: izin.user };

  const id = await bacaId(params);
  if (id === null) return idTidakValid;
  if (!(await getProject(id))) return tidakDitemukan;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body harus berupa JSON." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Body harus berupa objek." }, { status: 400 });
  }

  const masuk = body as Record<string, unknown>;
  const isi = masuk.body === undefined || masuk.body === null ? "" : String(masuk.body);

  const errors = validateComment({ body: isi });
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: "Komentar belum valid.", errors }, { status: 400 });
  }

  const comment = await createComment({
    projectId: id,
    // Dari sesi, bukan dari body.
    userId: sesi.user.id,
    body: isi.trim(),
  });

  if (!comment) return tidakDitemukan;

  return NextResponse.json({ comment }, { status: 201 });
}
