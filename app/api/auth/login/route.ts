import { type NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifyCredentials } from "@/lib/auth";
import { PESAN_KREDENSIAL_SALAH, validateLogin } from "@/lib/login-form";
import { SESSION_TTL_HOURS, createSession } from "@/lib/session";

/**
 * POST /api/auth/login — tukar email + sandi dengan cookie sesi.
 *
 * Jawaban tidak pernah memuat token: cookie-nya httpOnly, jadi token tidak
 * boleh ikut ke body yang bisa dibaca JavaScript halaman.
 *
 * Kredensial salah selalu dijawab satu pesan seragam. Membedakan "email tidak
 * terdaftar" dari "sandi salah" akan mengubah endpoint ini jadi alat untuk
 * mendaftar siapa saja yang punya akun.
 */
export async function POST(request: NextRequest) {
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
  const draft = {
    email: masuk.email === undefined || masuk.email === null ? "" : String(masuk.email),
    password:
      masuk.password === undefined || masuk.password === null ? "" : String(masuk.password),
  };

  const errors = validateLogin(draft);
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: "Periksa kembali isian Anda.", errors }, { status: 400 });
  }

  const user = await verifyCredentials(draft.email, draft.password);
  if (!user) {
    return NextResponse.json({ error: PESAN_KREDENSIAL_SALAH }, { status: 401 });
  }

  const sesi = createSession(user.id);
  const response = NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    expiresAt: sesi.expiresAt,
  });

  response.cookies.set(SESSION_COOKIE, sesi.token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * SESSION_TTL_HOURS,
  });

  return response;
}
