"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { aturProyekRencana } from "@/lib/plan-actions";
import type { Project } from "@/lib/types";

/* Pemilih proyek yang lahir dari sebuah rencana.

   Inilah yang menyambungkan niat dengan pelaksanaannya: "Riset Carbon Stock"
   sebagai rencana, dan proyek dengan nama sama sebagai pekerjaan nyatanya.

   Daftarnya dikirim utuh lalu disimpan sekaligus (bukan satu-satu) supaya
   kaitan tidak pernah tersimpan setengah jalan. */

export default function PlanProjectPicker({
  planId,
  candidates,
  selected,
  bolehUbah,
}: {
  planId: number;
  candidates: Project[];
  /** Proyek yang saat ini tertaut. */
  selected: Project[];
  bolehUbah: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [gagal, setGagal] = useState<string | null>(null);
  const [beres, setBeres] = useState(false);
  const [terpilih, setTerpilih] = useState<number[]>(() => selected.map((p) => p.id));

  const tersimpan = new Set(selected.map((p) => p.id));
  const berubah =
    terpilih.length !== tersimpan.size || terpilih.some((id) => !tersimpan.has(id));

  if (!bolehUbah) {
    return selected.length === 0 ? (
      <p className="text-sm text-muted">Belum ada proyek yang lahir dari rencana ini.</p>
    ) : (
      <ul className="grid gap-1 text-sm">
        {selected.map((p) => (
          <li key={p.id} className="text-foreground">
            {p.name}
            <span className="ml-1 text-xs text-muted">· {p.status}</span>
          </li>
        ))}
      </ul>
    );
  }

  function alih(id: number) {
    setGagal(null);
    setBeres(false);
    setTerpilih((lama) => (lama.includes(id) ? lama.filter((x) => x !== id) : [...lama, id]));
  }

  function simpan() {
    if (pending) return;
    setGagal(null);
    setBeres(false);

    startTransition(async () => {
      const hasil = await aturProyekRencana(planId, terpilih);
      if (!hasil.ok) {
        setGagal(hasil.error);
        return;
      }
      setBeres(true);
      router.refresh();
    });
  }

  return (
    <div>
      {candidates.length === 0 ? (
        <p className="text-sm text-muted">Belum ada proyek yang bisa ditautkan.</p>
      ) : (
        <>
          <ul
            role="group"
            aria-label="Proyek yang lahir dari rencana ini"
            className="max-h-56 space-y-1 overflow-y-auto pr-1"
          >
            {candidates.map((p) => (
              <li key={p.id}>
                <label className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-background">
                  <input
                    type="checkbox"
                    checked={terpilih.includes(p.id)}
                    disabled={pending}
                    onChange={() => alih(p.id)}
                    className="mt-0.5 accent-accent"
                  />
                  <span className="min-w-0">
                    <span className="block truncate">{p.name}</span>
                    <span className="block truncate text-xs text-muted">
                      {p.clientOrg || "Tanpa instansi"} · {p.status}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              disabled={pending || !berubah}
              onClick={simpan}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "Menyimpan…" : "Simpan kaitan"}
            </button>
            <p aria-live="polite" className="text-xs text-muted">
              {gagal ? (
                <span className="text-high">{gagal}</span>
              ) : beres && !berubah ? (
                "Tersimpan."
              ) : (
                `${terpilih.length} proyek tertaut`
              )}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
