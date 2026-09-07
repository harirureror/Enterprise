import { revalidatePath } from "next/cache";
import { jagaSesi } from "@/lib/api-guard";
import { type NextRequest, NextResponse } from "next/server";
import { getMemberProfile, getUsers, updateUserIdentity } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { unauthorized } from "@/lib/auth-response";
import { validateProfile } from "@/lib/profile-form";
import { revokeAllForUser } from "@/lib/session";

/**
 * Profil pengguna yang sedang masuk (PRD bagian 7).
 *
 * Segmen "me" menang atas [id] di App Router, jadi /api/users/me tidak pernah
 * jatuh ke rute dinamis. Sengaja tidak memakai /api/users/{id}: identitas
 * diambil dari sesi, bukan dari URL — kalau dari URL, siapa pun bisa menyunting
 * profil orang lain hanya dengan mengganti angka.
 */

export async function GET() {
  const izin = await jagaSesi();
  if (!izin.ok) return izin.response;

  const sesi = await getSession();
  if (!sesi) return unauthorized();

  const { user } = sesi;
  // Beban kerja ikut supaya klien tidak perlu memanggil /api/team terpisah.
  const profil = await getMemberProfile(user.id);

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
    },
    workload: profil
      ? {
          activeCount: profil.member.activeCount,
          doneCount: profil.member.doneCount,
          highPriorityActive: profil.member.highPriorityActive,
          overdue: profil.member.overdue,
          pipelineValue: profil.member.pipelineValue,
          nextDeadline: profil.member.nextDeadline,
        }
      : null,
    source: sesi.source,
  });
}

export async function PUT(request: NextRequest) {
  const izin = await jagaSesi();
  if (!izin.ok) return izin.response;

  const sesi = await getSession();
  if (!sesi) return unauthorized();

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

  // Peran menentukan hak akses — itu urusan admin. Kiriman yang memuatnya
  // ditolak terang-terangan, bukan diabaikan diam-diam, supaya pemanggil tidak
  // mengira perubahannya tersimpan. Email TIDAK lagi terlarang: ia identitas
  // login, tapi memperbaiki salah ketiknya adalah hak pemiliknya sendiri.
  const terlarang = ["role", "id"].filter((k) => masuk[k] !== undefined);
  if (terlarang.length > 0) {
    return NextResponse.json(
      { error: `Kolom ini tidak bisa diubah sendiri: ${terlarang.join(", ")}.` },
      { status: 409 }
    );
  }

  const draft = {
    name: masuk.name === undefined || masuk.name === null ? "" : String(masuk.name),
    avatarUrl:
      masuk.avatarUrl === undefined || masuk.avatarUrl === null ? "" : String(masuk.avatarUrl),
    // Tidak dikirim berarti tidak diubah, bukan dikosongkan.
    email: masuk.email === undefined || masuk.email === null ? sesi.user.email : String(masuk.email),
  };

  const emailLain = (await getUsers())
    .filter((u) => u.id !== sesi.user.id)
    .map((u) => u.email.toLowerCase());

  const errors = validateProfile(draft, emailLain);
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: "Data profil belum valid.", errors }, { status: 400 });
  }

  const avatar = draft.avatarUrl.trim();
  const emailBaru = draft.email.trim();
  const emailBerubah = emailBaru.toLowerCase() !== sesi.user.email.toLowerCase();

  const hasil = await updateUserIdentity(sesi.user.id, {
    name: draft.name.trim(),
    email: emailBaru,
    // Kosong berarti kembali ke inisial, bukan menyimpan string kosong.
    avatarUrl: avatar === "" ? null : avatar,
  });

  if (!hasil.ok) {
    // Email bentrok itu konflik keadaan, bukan kesalahan bentuk kiriman.
    const status = hasil.error.includes("dipakai") ? 409 : 404;
    return NextResponse.json({ error: hasil.error }, { status });
  }
  const user = hasil.user;

  // Sama seperti jalur server action: mengganti identitas login mencabut
  // seluruh sesi, termasuk yang sedang memanggil endpoint ini.
  if (emailBerubah) revokeAllForUser(sesi.user.id);

  // Nama dan foto muncul di topbar, daftar tim, dan diskusi. Server action
  // sudah menyegarkan halaman; endpoint ini harus melakukan hal yang sama,
  // kalau tidak hasilnya berbeda tergantung lewat mana profil diubah.
  revalidatePath("/", "layout");

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
    },
  });
}
