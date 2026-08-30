"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { ubahStatusProyek } from "@/lib/actions";
import { PROJECT_STATUSES, type ProjectStatus } from "@/lib/types";

/* Tombol status langsung berpindah di layar (useOptimistic) lalu server
   menyusul. Kalau server menolak, tampilannya balik ke status sebenarnya. */

const active: Record<ProjectStatus, string> = {
  Prospect: "bg-foreground/10 text-foreground ring-1 ring-border",
  Penawaran: "bg-stage/15 text-stage ring-1 ring-stage/30",
  Negosiasi: "bg-med/15 text-med ring-1 ring-med/30",
  Berjalan: "bg-accent/15 text-accent ring-1 ring-accent/30",
  Tertunda: "bg-high/15 text-high ring-1 ring-high/30",
  Selesai: "bg-low/15 text-low ring-1 ring-low/30",
};

export default function ProjectStatusControl({
  projectId,
  status,
}: {
  projectId: number;
  status: ProjectStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [gagal, setGagal] = useState<string | null>(null);
  const [tampil, setTampil] = useOptimistic(status);

  function pilih(baru: ProjectStatus) {
    if (baru === status || pending) return;

    setGagal(null);
    startTransition(async () => {
      setTampil(baru);
      const hasil = await ubahStatusProyek(projectId, baru);
      if (!hasil.ok) {
        // Nilai optimistis otomatis dibuang saat transition selesai.
        setGagal(hasil.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      <div role="group" aria-label="Ubah status proyek" className="flex flex-wrap gap-2">
        {PROJECT_STATUSES.map((s) => {
          const terpilih = s === tampil;
          return (
            <button
              key={s}
              type="button"
              aria-pressed={terpilih}
              disabled={pending}
              onClick={() => pilih(s)}
              className={`rounded-lg px-3 py-1.5 text-sm transition-colors disabled:opacity-60 ${
                terpilih
                  ? `font-medium ${active[s]}`
                  : "text-muted ring-1 ring-border hover:bg-background"
              }`}
            >
              {s}
            </button>
          );
        })}
      </div>

      <p aria-live="polite" className="mt-2 text-xs text-muted">
        {gagal ? <span className="text-high">{gagal}</span> : pending ? "Menyimpan…" : ""}
      </p>
    </div>
  );
}
