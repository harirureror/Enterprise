import { type NextRequest, NextResponse } from "next/server";
import { createReminder, getCurrentUser, getReminderStatus, getReminders, getProject } from "@/lib/api";
import { validateReminder } from "@/lib/reminder-form";

/**
 * Pengingat manual sebuah proyek: GET (riwayat + status) dan POST (kirim).
 *
 * Penerima tidak diambil dari body: pengingat selalu ditujukan ke PIC proyek
 * saat ini. Kalau bisa ditentukan pemanggil, riwayatnya jadi tidak bisa
 * dipercaya sebagai jejak "siapa sudah mengingatkan siapa".
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

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = await bacaId(params);
  if (id === null) return idTidakValid;
  if (!(await getProject(id))) return tidakDitemukan;

  return NextResponse.json({
    projectId: id,
    status: await getReminderStatus(id),
    reminders: await getReminders(id),
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
  const message =
    masuk.message === undefined || masuk.message === null ? "" : String(masuk.message);

  // Aturan yang sama dengan form di halaman detail.
  const errors = validateReminder({ message });
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: "Pesan pengingat belum valid.", errors }, { status: 400 });
  }

  // ponytail: pengirim diambil dari sesi setelah fase autentikasi.
  const pengirim = await getCurrentUser();
  const reminder = await createReminder({
    projectId: id,
    fromUserId: pengirim.id,
    message: message.trim(),
  });

  if (!reminder) return tidakDitemukan;

  return NextResponse.json({ reminder, status: await getReminderStatus(id) }, { status: 201 });
}
