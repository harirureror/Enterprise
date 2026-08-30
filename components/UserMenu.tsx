"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { keluar } from "@/lib/auth-actions";

/* Identitas di topbar plus tombol keluar. Dipisah jadi komponen klien karena
   keluar adalah aksi, sedangkan layout-nya sendiri server component. */

export default function UserMenu({
  name,
  initials,
  /** `true` kalau identitasnya diasumsikan, bukan dibuktikan lewat sesi. */
  assumed,
}: {
  name: string;
  initials: string;
  assumed: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [gagal, setGagal] = useState(false);

  function handleKeluar() {
    setGagal(false);
    startTransition(async () => {
      try {
        await keluar();
        router.push("/login");
        router.refresh();
      } catch {
        setGagal(true);
      }
    });
  }

  return (
    <div className="flex items-center gap-3">
      <p className="hidden text-sm text-muted sm:block">
        Masuk sebagai <span className="font-medium text-foreground">{name}</span>
        {assumed && (
          // Jujur soal keadaan: tanpa login, identitas ini hanya diasumsikan.
          <span className="ml-1 text-xs text-med" title="Belum masuk lewat halaman login">
            (sementara)
          </span>
        )}
      </p>

      <Link
        href="/profil"
        title="Buka profil"
        className="flex h-8 w-8 items-center justify-center rounded-full bg-background text-xs font-semibold text-muted ring-1 ring-border transition-colors hover:bg-surface"
      >
        {initials}
        <span className="sr-only">Profil {name}</span>
      </Link>

      <button
        type="button"
        onClick={handleKeluar}
        disabled={pending}
        className="rounded-lg border border-border px-2.5 py-1 text-sm text-muted transition-colors hover:bg-background disabled:opacity-60"
      >
        {pending ? "Keluar…" : "Keluar"}
      </button>

      {gagal && (
        <span role="alert" className="text-xs text-high">
          Gagal keluar.
        </span>
      )}
    </div>
  );
}
