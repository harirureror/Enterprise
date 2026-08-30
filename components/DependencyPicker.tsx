"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { aturKetergantungan } from "@/lib/actions";
import type { Project } from "@/lib/types";

/* Pemilih "proyek ini menahan siapa". Ketergantungan menyumbang 10% ke skor
   prioritas, jadi mengubahnya di sini langsung menggeser urutan Fokus Hari Ini.

   Daftarnya dikirim utuh lalu disimpan sekaligus (bukan satu-satu) supaya
   pemeriksaan lingkaran menilai keadaan sesudah perubahan, bukan setengah jalan. */

export default function DependencyPicker({
  projectId,
  candidates,
  blocking,
  blockedBy,
}: {
  projectId: number;
  /** Proyek lain yang boleh dipilih; sudah tidak memuat proyek ini sendiri. */
  candidates: Project[];
  /** Proyek yang saat ini ditahan proyek ini. */
  blocking: Project[];
  /** Proyek yang menahan proyek ini — hanya ditampilkan, diubah dari sisi sana. */
  blockedBy: Project[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [gagal, setGagal] = useState<string | null>(null);
  const [beres, setBeres] = useState(false);
  const [terpilih, setTerpilih] = useState<number[]>(() => blocking.map((p) => p.id));

  const tersimpan = new Set(blocking.map((p) => p.id));
  const berubah =
    terpilih.length !== tersimpan.size || terpilih.some((id) => !tersimpan.has(id));

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
      const hasil = await aturKetergantungan(projectId, terpilih);
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
      {blockedBy.length > 0 && (
        <p className="mb-3 rounded-lg bg-background px-3 py-2 text-xs text-muted">
          Proyek ini ditahan oleh {blockedBy.map((p) => p.name).join(", ")}. Relasi itu diatur
          dari halaman proyek tersebut.
        </p>
      )}

      {candidates.length === 0 ? (
        <p className="text-sm text-muted">Belum ada proyek lain yang bisa ditahan.</p>
      ) : (
        <>
          <ul
            role="group"
            aria-label="Proyek yang ditahan proyek ini"
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
              {pending ? "Menyimpan…" : "Simpan relasi"}
            </button>
            <p aria-live="polite" className="text-xs text-muted">
              {gagal ? (
                <span className="text-high">{gagal}</span>
              ) : beres && !berubah ? (
                "Tersimpan."
              ) : (
                `Menahan ${terpilih.length} proyek`
              )}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
