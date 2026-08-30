"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { hapusProyek } from "@/lib/actions";
import { formatDate } from "@/lib/ui";
import type { Project } from "@/lib/types";

/* Konfirmasi hapus pakai <dialog> bawaan, bukan window.confirm: bisa menyebut
   detail proyeknya, dan tombol yang aman ("Batal") yang dapat fokus lebih dulu. */

export default function ProjectDeleteDialog({
  project,
  onClose,
}: {
  project: Project;
  onClose: () => void;
}) {
  const router = useRouter();
  const uid = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const batalRef = useRef<HTMLButtonElement>(null);
  const [menghapus, setMenghapus] = useState(false);
  const [gagal, setGagal] = useState<string | null>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
    // Fokus jatuh ke "Batal" supaya Enter refleks tidak langsung menghapus.
    batalRef.current?.focus();
  }, []);

  async function handleHapus() {
    setGagal(null);
    setMenghapus(true);
    try {
      const hasil = await hapusProyek(project.id);
      if (!hasil.ok) {
        setGagal(hasil.error);
        return;
      }
      dialogRef.current?.close();
      router.refresh();
    } catch {
      setGagal("Tidak bisa menghubungi server. Coba lagi.");
    } finally {
      setMenghapus(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby={`${uid}-judul`}
      aria-describedby={`${uid}-isi`}
      /* `m-auto` mengembalikan pemusatan bawaan <dialog>: preflight Tailwind
         menyetel margin semua elemen jadi 0, jadi modal jatuh ke pojok. */
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-xl border border-border bg-surface p-0 text-foreground shadow-card backdrop:bg-foreground/40 backdrop:backdrop-blur-sm"
    >
      <div className="px-5 py-4">
        <h2 id={`${uid}-judul`} className="text-headline-sm font-semibold">
          Hapus proyek ini?
        </h2>
        <div id={`${uid}-isi`} className="mt-2 text-sm text-muted">
          <p>
            <span className="font-medium text-foreground">{project.name}</span> akan dihapus
            permanen dan tidak bisa dikembalikan.
          </p>
          <p className="mt-2">
            Status {project.status} · tenggat {formatDate(project.deadline)} · progres{" "}
            {project.progressPct}%
          </p>
        </div>

        {gagal && (
          <p
            role="alert"
            className="mt-3 rounded-lg border border-high/30 bg-high/10 p-2.5 text-sm text-high"
          >
            {gagal}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border px-5 py-3">
        <button
          ref={batalRef}
          type="button"
          onClick={() => dialogRef.current?.close()}
          className="rounded-lg border border-border px-4 py-2 text-sm text-muted hover:bg-background"
        >
          Batal
        </button>
        <button
          type="button"
          onClick={handleHapus}
          disabled={menghapus}
          className="rounded-lg bg-high px-4 py-2 text-sm font-medium text-on-brand transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {menghapus ? "Menghapus…" : "Hapus Proyek"}
        </button>
      </div>
    </dialog>
  );
}
