"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Badge from "@/components/Badge";
import type { PlanStepView } from "@/lib/api";
import {
  hapusLangkah,
  perbaruiLangkah,
  simpanLangkah,
  ubahStatusLangkah,
} from "@/lib/plan-actions";
import {
  type StepDraft,
  type StepErrors,
  emptyStepDraft,
  stepToDraft,
} from "@/lib/plan-form";
import { STEP_STATUSES, type StepStatus, type User } from "@/lib/types";
import { formatDate } from "@/lib/ui";

/* Langkah pelaksanaan sebuah rencana.

   Progres rencana diturunkan dari daftar ini — tidak ada angka progres yang
   diketik orang. Mencentang satu langkah selesai adalah jalur tersering, jadi
   itu dibuat satu klik, bukan lewat form. */

const statusClass: Record<StepStatus, string> = {
  Belum: "text-muted ring-1 ring-border",
  Berjalan: "bg-accent/15 text-accent ring-1 ring-accent/30",
  Selesai: "bg-low/15 text-low ring-1 ring-low/30",
  Batal: "text-muted ring-1 ring-border line-through",
};

const fieldClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/20";

export default function PlanSteps({
  planId,
  steps,
  owners,
  bolehUbah,
  hariIni,
}: {
  planId: number;
  steps: PlanStepView[];
  owners: User[];
  bolehUbah: boolean;
  /** Tanggal acuan dari server, supaya penanda telat tidak beda zona waktu. */
  hariIni: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<StepDraft | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [errors, setErrors] = useState<StepErrors>({});
  const [gagal, setGagal] = useState<string | null>(null);

  function bukaBaru() {
    setEditId(null);
    setErrors({});
    setGagal(null);
    setDraft(emptyStepDraft());
  }

  function bukaUbah(step: PlanStepView) {
    setEditId(step.id);
    setErrors({});
    setGagal(null);
    setDraft(stepToDraft(step));
  }

  function set(field: keyof StepDraft, value: string) {
    setDraft((lama) => (lama === null ? lama : { ...lama, [field]: value }));
    setErrors((lama) => ({ ...lama, [field]: undefined }));
  }

  function jalankan(
    aksi: () => Promise<{ ok: true } | { ok: false; error: string; errors: StepErrors }>,
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

  const telat = (s: PlanStepView) =>
    s.status !== "Selesai" && s.status !== "Batal" && s.targetDate !== null && s.targetDate < hariIni;

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-headline-sm font-semibold">Langkah Pelaksanaan</h2>
        {bolehUbah && (
          <button
            type="button"
            disabled={pending}
            onClick={bukaBaru}
            className="rounded-lg border border-border px-2.5 py-1 text-sm text-muted hover:bg-background"
          >
            + Tambah Langkah
          </button>
        )}
      </div>

      {gagal && (
        <p role="alert" className="mt-2 rounded-lg border border-high/30 bg-high/10 p-2.5 text-sm text-high">
          {gagal}
        </p>
      )}

      {steps.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          Belum ada langkah. Rencana tanpa langkah sulit dipantau kemajuannya.
        </p>
      ) : (
        <ol className="mt-3 grid gap-2">
          {steps.map((s, i) => (
            <li
              key={s.id}
              className={`rounded-lg border bg-background px-3 py-2.5 ${
                telat(s) ? "border-high/40" : "border-border"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 gap-3">
                  <span
                    aria-hidden
                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface text-xs font-semibold text-muted"
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium leading-snug">{s.title}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {s.owner?.name ?? "Belum ditugaskan"}
                      {s.targetDate && ` · target ${formatDate(s.targetDate)}`}
                      {telat(s) && <span className="text-high"> · lewat tenggat</span>}
                    </p>
                    {s.note && <p className="mt-1 text-xs text-muted">{s.note}</p>}
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {bolehUbah ? (
                    <select
                      value={s.status}
                      disabled={pending}
                      aria-label={`Status langkah ${s.title}`}
                      onChange={(e) => jalankan(() => ubahStatusLangkah(s.id, e.target.value))}
                      className="rounded-lg border border-border bg-surface px-2 py-1 text-sm"
                    >
                      {STEP_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Badge className={statusClass[s.status]}>{s.status}</Badge>
                  )}

                  {bolehUbah && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => bukaUbah(s)}
                      className="rounded-lg border border-border px-2 py-1 text-sm text-muted hover:bg-surface"
                    >
                      Ubah
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      {draft !== null && (
        <form
          noValidate
          className="mt-4 grid gap-3 rounded-lg border border-border bg-background p-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            jalankan(
              () => (editId === null ? simpanLangkah(planId, draft) : perbaruiLangkah(editId, draft)),
              () => {
                setDraft(null);
                setEditId(null);
              }
            );
          }}
        >
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium">Judul langkah</span>
            <input
              type="text"
              value={draft.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Susun silabus pelatihan"
              className={`mt-1 ${fieldClass}`}
            />
            {errors.title && <p className="mt-1 text-xs text-high">{errors.title}</p>}
          </label>

          <label className="block text-sm">
            <span className="font-medium">
              Penanggung jawab <span className="font-normal text-muted">(opsional)</span>
            </span>
            <select
              value={draft.ownerId}
              onChange={(e) => set("ownerId", e.target.value)}
              className={`mt-1 ${fieldClass}`}
            >
              <option value="">Belum ditugaskan</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            {errors.ownerId && <p className="mt-1 text-xs text-high">{errors.ownerId}</p>}
          </label>

          <label className="block text-sm">
            <span className="font-medium">
              Target <span className="font-normal text-muted">(opsional)</span>
            </span>
            <input
              type="date"
              value={draft.targetDate}
              onChange={(e) => set("targetDate", e.target.value)}
              className={`mt-1 ${fieldClass}`}
            />
            {errors.targetDate && <p className="mt-1 text-xs text-high">{errors.targetDate}</p>}
          </label>

          <label className="block text-sm">
            <span className="font-medium">Status</span>
            <select
              value={draft.status}
              onChange={(e) => set("status", e.target.value)}
              className={`mt-1 ${fieldClass}`}
            >
              {STEP_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
            {errors.status && <p className="mt-1 text-xs text-high">{errors.status}</p>}
          </label>

          <label className="block text-sm">
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
                  jalankan(() => hapusLangkah(editId), () => {
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
