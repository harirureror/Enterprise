"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Badge from "@/components/Badge";
import type { PlanOutputView } from "@/lib/api";
import { hapusLuaran, perbaruiLuaran, simpanLuaran } from "@/lib/plan-actions";
import {
  type OutputDraft,
  type OutputErrors,
  emptyOutputDraft,
  outputToDraft,
} from "@/lib/plan-form";
import { PLAN_OUTPUT_KINDS, type PlanOutputKind, type Project } from "@/lib/types";
import { formatDate } from "@/lib/ui";

/* Apa yang dihasilkan sebuah rencana.

   Sebelumnya hanya proyek yang tercatat, padahal riset melahirkan jurnal,
   kegiatan melahirkan portofolio, dan pelatihan melahirkan sertifikasi. Proyek
   kini salah satu jenisnya, bukan kategori tersendiri — jadi rantai
   rencana → luaran → proyek turunan terbaca sebagai satu daftar. */

const kindClass: Record<PlanOutputKind, string> = {
  Jurnal: "bg-stage/15 text-stage ring-1 ring-stage/30",
  Portofolio: "bg-accent/15 text-accent ring-1 ring-accent/30",
  Sertifikasi: "bg-med/15 text-med ring-1 ring-med/30",
  Produk: "bg-low/15 text-low ring-1 ring-low/30",
  "Proyek Turunan": "text-muted ring-1 ring-border",
};

const fieldClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/20";

export default function PlanOutputs({
  planId,
  outputs,
  candidates,
  bolehUbah,
}: {
  planId: number;
  outputs: PlanOutputView[];
  /** Proyek yang bisa ditautkan saat jenisnya "Proyek Turunan". */
  candidates: Project[];
  bolehUbah: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<OutputDraft | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [errors, setErrors] = useState<OutputErrors>({});
  const [gagal, setGagal] = useState<string | null>(null);

  function set(field: keyof OutputDraft, value: string) {
    setDraft((lama) => {
      if (lama === null) return lama;
      const berikut = { ...lama, [field]: value };
      // Berpindah dari "Proyek Turunan" ke jenis lain melepas tautannya:
      // menyimpannya diam-diam akan menyimpan kaitan yang tidak terlihat.
      if (field === "kind" && value !== "Proyek Turunan") berikut.projectId = "";
      return berikut;
    });
    setErrors((lama) => ({ ...lama, [field]: undefined }));
  }

  function jalankan(
    aksi: () => Promise<{ ok: true } | { ok: false; error: string; errors: OutputErrors }>,
    sesudah?: () => void
  ) {
    setGagal(null);
    startTransition(async () => {
      const hasil = await aksi();
      if (!hasil.ok) {
        setGagal(hasil.error);
        setErrors(hasil.errors);
        return;
      }
      sesudah?.();
      router.refresh();
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-headline-sm font-semibold">Luaran Rencana Ini</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Bukan hanya proyek: riset melahirkan jurnal, kegiatan melahirkan portofolio.
            Menghapus proyek yang tertaut hanya melepas tautannya — catatan bahwa rencana
            ini pernah melahirkannya tetap ada.
          </p>
        </div>
        {bolehUbah && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setEditId(null);
              setErrors({});
              setGagal(null);
              setDraft(emptyOutputDraft());
            }}
            className="shrink-0 rounded-lg border border-border px-2.5 py-1 text-sm text-muted hover:bg-background"
          >
            + Tambah Luaran
          </button>
        )}
      </div>

      {gagal && (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-high/30 bg-high/10 p-2.5 text-sm text-high"
        >
          {gagal}
        </p>
      )}

      {outputs.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Belum ada luaran tercatat.</p>
      ) : (
        <ul className="mt-3 grid gap-2">
          {outputs.map((o) => (
            <li key={o.id} className="rounded-lg border border-border bg-background px-3 py-2.5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium leading-snug">{o.title}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {[
                      o.achievedAt ? formatDate(o.achievedAt) : "Belum tercapai",
                      // Tautan yang sudah lepas tetap disebut, bukan disembunyikan.
                      o.kind === "Proyek Turunan" && o.projectId === null
                        ? "proyek sudah dihapus"
                        : o.project?.name,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {o.note && <p className="mt-1 text-xs text-muted">{o.note}</p>}
                  {o.url && (
                    <a
                      href={o.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mt-1 inline-block text-xs text-accent underline"
                    >
                      Buka tautan
                    </a>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge className={kindClass[o.kind]}>{o.kind}</Badge>
                  {bolehUbah && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        setEditId(o.id);
                        setErrors({});
                        setGagal(null);
                        setDraft(outputToDraft(o));
                      }}
                      className="rounded-lg border border-border px-2 py-1 text-sm text-muted hover:bg-surface"
                    >
                      Ubah
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {draft !== null && (
        <form
          noValidate
          className="mt-4 grid gap-3 rounded-lg border border-border bg-background p-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            jalankan(
              () => (editId === null ? simpanLuaran(planId, draft) : perbaruiLuaran(editId, draft)),
              () => {
                setDraft(null);
                setEditId(null);
              }
            );
          }}
        >
          <label className="block text-sm">
            <span className="font-medium">Jenis luaran</span>
            <select
              value={draft.kind}
              onChange={(e) => set("kind", e.target.value)}
              className={`mt-1 ${fieldClass}`}
            >
              {PLAN_OUTPUT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            {errors.kind && <p className="mt-1 text-xs text-high">{errors.kind}</p>}
          </label>

          <label className="block text-sm">
            <span className="font-medium">
              Tercapai <span className="font-normal text-muted">(opsional)</span>
            </span>
            <input
              type="date"
              value={draft.achievedAt}
              onChange={(e) => set("achievedAt", e.target.value)}
              className={`mt-1 ${fieldClass}`}
            />
            {errors.achievedAt && <p className="mt-1 text-xs text-high">{errors.achievedAt}</p>}
          </label>

          <label className="block text-sm sm:col-span-2">
            <span className="font-medium">Judul</span>
            <input
              type="text"
              value={draft.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Estimasi carbon stock berbasis SLAM LiDAR"
              className={`mt-1 ${fieldClass}`}
            />
            {errors.title && <p className="mt-1 text-xs text-high">{errors.title}</p>}
          </label>

          {/* Pemilih proyek hanya muncul saat jenisnya memang proyek. */}
          {draft.kind === "Proyek Turunan" && (
            <label className="block text-sm sm:col-span-2">
              <span className="font-medium">
                Proyek <span className="font-normal text-muted">(opsional)</span>
              </span>
              <select
                value={draft.projectId}
                onChange={(e) => set("projectId", e.target.value)}
                className={`mt-1 ${fieldClass}`}
              >
                <option value="">Belum ditautkan</option>
                {candidates.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {errors.projectId && <p className="mt-1 text-xs text-high">{errors.projectId}</p>}
            </label>
          )}

          <label className="block text-sm sm:col-span-2">
            <span className="font-medium">
              Tautan <span className="font-normal text-muted">(opsional)</span>
            </span>
            <input
              type="url"
              value={draft.url}
              onChange={(e) => set("url", e.target.value)}
              placeholder="https://doi.org/..."
              className={`mt-1 ${fieldClass}`}
            />
            {errors.url && <p className="mt-1 text-xs text-high">{errors.url}</p>}
          </label>

          <label className="block text-sm sm:col-span-2">
            <span className="font-medium">
              Catatan <span className="font-normal text-muted">(opsional)</span>
            </span>
            <input
              type="text"
              value={draft.note}
              onChange={(e) => set("note", e.target.value)}
              className={`mt-1 ${fieldClass}`}
            />
            {errors.note && <p className="mt-1 text-xs text-high">{errors.note}</p>}
          </label>

          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-on-brand disabled:opacity-60"
            >
              {pending ? "Menyimpan…" : "Simpan"}
            </button>
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="rounded-lg border border-border px-4 py-2 text-sm text-muted"
            >
              Batal
            </button>
            {editId !== null && (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  jalankan(() => hapusLuaran(editId), () => {
                    setDraft(null);
                    setEditId(null);
                  })
                }
                className="rounded-lg border border-border px-4 py-2 text-sm text-muted hover:border-high/30 hover:bg-high/10 hover:text-high"
              >
                Hapus
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
