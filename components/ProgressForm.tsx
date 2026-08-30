"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { catatProgres } from "@/lib/actions";
import {
  NOTE_MAX,
  type ProgressDraft,
  type ProgressErrors,
  type ProgressField,
  emptyProgressDraft,
  validateProgress,
} from "@/lib/progress-form";

/* Form catat progres di halaman detail. Aturan validasinya sama dengan yang
   dijalankan ulang di server action. */

function inputClass(error?: string) {
  return `w-full rounded-lg border bg-surface px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-accent/20 ${
    error ? "border-high focus:border-high" : "border-border focus:border-accent"
  }`;
}

export default function ProgressForm({
  projectId,
  current,
}: {
  projectId: number;
  /** Progres proyek sekarang, jadi nilai awal sekaligus pembanding. */
  current: number;
}) {
  const router = useRouter();
  const uid = useId();
  const [draft, setDraft] = useState<ProgressDraft>(() => emptyProgressDraft(current));
  const [errors, setErrors] = useState<ProgressErrors>({});
  const [saving, setSaving] = useState(false);
  const [gagal, setGagal] = useState<string | null>(null);
  const [berhasil, setBerhasil] = useState<string | null>(null);

  const nilai = Number(draft.progressPct);
  const selisih = Number.isFinite(nilai) ? nilai - current : 0;

  function set(field: ProgressField, value: string) {
    const berikutnya = { ...draft, [field]: value };
    setDraft(berikutnya);
    setBerhasil(null);
    if (Object.keys(errors).length > 0) setErrors(validateProgress(berikutnya, current));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setGagal(null);
    setBerhasil(null);

    const temuan = validateProgress(draft, current);
    setErrors(temuan);
    if (Object.keys(temuan).length > 0) {
      document.getElementById(`${uid}-${Object.keys(temuan)[0]}`)?.focus();
      return;
    }

    setSaving(true);
    try {
      const hasil = await catatProgres(projectId, draft);
      if (!hasil.ok) {
        setErrors(hasil.errors);
        setGagal(hasil.error);
        return;
      }

      setBerhasil("Progres tercatat.");
      // Persentase baru jadi acuan berikutnya; catatan dikosongkan.
      setDraft({ progressPct: draft.progressPct, note: "" });
      router.refresh();
    } catch {
      setGagal("Tidak bisa menghubungi server. Coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit}>
      {gagal && (
        <p
          role="alert"
          className="mb-3 rounded-lg border border-high/30 bg-high/10 p-2.5 text-sm text-high"
        >
          {gagal}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
        <label className="block text-sm">
          <span className="font-medium">Progres (%)</span>
          <input
            id={`${uid}-progressPct`}
            type="number"
            min={0}
            max={100}
            step={1}
            value={draft.progressPct}
            aria-invalid={errors.progressPct ? true : undefined}
            aria-describedby={errors.progressPct ? `${uid}-progressPct-error` : undefined}
            onChange={(e) => set("progressPct", e.target.value)}
            className={`mt-1 ${inputClass(errors.progressPct)}`}
          />
          {errors.progressPct ? (
            <p id={`${uid}-progressPct-error`} className="mt-1 text-xs text-high">
              {errors.progressPct}
            </p>
          ) : (
            <span className="mt-1 block text-xs text-muted">
              {selisih === 0 ? `tetap ${current}%` : `${selisih > 0 ? "+" : ""}${selisih} dari ${current}%`}
            </span>
          )}
        </label>

        <label className="block text-sm">
          <span className="font-medium">Catatan</span>
          <textarea
            id={`${uid}-note`}
            rows={2}
            value={draft.note}
            aria-invalid={errors.note ? true : undefined}
            aria-describedby={errors.note ? `${uid}-note-error` : undefined}
            onChange={(e) => set("note", e.target.value)}
            placeholder="Apa yang berubah sejak pembaruan terakhir?"
            className={`mt-1 ${inputClass(errors.note)}`}
          />
          {errors.note ? (
            <p id={`${uid}-note-error`} className="mt-1 text-xs text-high">
              {errors.note}
            </p>
          ) : (
            <span className="mt-1 block text-xs text-muted">
              {draft.note.trim().length}/{NOTE_MAX} karakter
            </span>
          )}
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-on-brand transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {saving ? "Menyimpan…" : "Catat Progres"}
        </button>
        <p aria-live="polite" className="text-sm text-muted">
          {berhasil ?? ""}
        </p>
      </div>
    </form>
  );
}
