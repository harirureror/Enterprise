import { Suspense } from "react";
import { redirect } from "next/navigation";
import LoginForm from "@/components/LoginForm";
import { authWajib, getSession } from "@/lib/auth";

export const metadata = {
  title: "Masuk — Divisi Enterprise JSI",
  description: "Masuk ke dashboard proyek Divisi Enterprise Jaya Survei Indonesia.",
};

export default async function LoginPage() {
  // Sudah masuk tidak perlu melihat form ini lagi.
  if (authWajib() && (await getSession())) redirect("/");

  // Belum ada sandi tersimpan; keterangan di bawah menjelaskan apa adanya
  // supaya halaman ini tidak terlihat rusak saat dicoba.
  const devLoginAktif =
    process.env.NODE_ENV !== "production" && Boolean(process.env.DEV_LOGIN_PASSWORD);

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-mark text-lg font-bold text-on-mark">
            DE
          </span>
          <div>
            <p className="text-headline-sm font-bold">Divisi Enterprise</p>
            <p className="text-xs text-muted">Jaya Survei Indonesia</p>
          </div>
        </div>

        <h1 className="mt-6 text-headline-lg font-semibold">Masuk</h1>
        <p className="mt-1 text-sm text-muted">
          Gunakan email kantor Anda untuk membuka dashboard proyek.
        </p>

        <div className="mt-6 rounded-xl border border-border bg-surface p-5 shadow-card">
          {/* useSearchParams butuh batas Suspense saat prerender. */}
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>

        <p className="mt-4 text-xs text-muted">
          {devLoginAktif
            ? "Mode pengembangan: sandi sementara dari DEV_LOGIN_PASSWORD berlaku untuk semua akun seed."
            : "Penyimpanan kata sandi belum aktif, jadi belum ada akun yang bisa masuk. Setel DEV_LOGIN_PASSWORD untuk mencoba alurnya di lingkungan pengembangan."}
        </p>
      </div>
    </div>
  );
}
