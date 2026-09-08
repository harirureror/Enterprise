"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { catatProgres } from "@/lib/actions";
import {
  NOTE_MAX,
  type ProgressDraft,
  type ProgressErrors,
  emptyProgressDraft,
  validateProgress,
} from "@/lib/progress-form";

/* Form catat perkembangan di halaman detail.

   Tidak ada lagi isian persen. Progres seluruhnya diturunkan dari checklist
   aktivitas, dan menyediakan kotak angka di sampingnya berarti menawarkan dua
   kebenaran untuk satu hal — yang diketik pun akan langsung ditimpa centang
   berikutnya. Yang tersisa adalah ceritanya, dan cerita memang tidak bisa
   diturunkan dari mana pun.

   Aturan validasinya sama dengan yang dijalankan ulang di server action. */

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
  /** Progres yang berlaku — angka yang akan ikut tercatat di riwayat. */
  current: number;
}) {
  const router = useRouter();
  const uid = useId();
  const [draft, setDraft] = useState<ProgressDraft>(emptyProgressDraft);
  const [errors, setErrors] = useState<ProgressErrors>({});
  const [saving, setSaving] = useState(false);
  const [gagal, setGagal] = useState<string | null>(null);
  const [berhasil, setBerhasil] = useState<string | null>(null);

  function set(value: string) {
    const berikutnya = { note: value };
    setDraft(berikutnya);
    setBerhasil(null);
    if (Object.keys(errors).length > 0) setErrors(validateProgress(berikutnya));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setGagal(null);
    setBerhasil(null);

    const temuan = validateProgress(draft);
    setErrors(temuan);
    if (Object.keys(temuan).length > 0) {
      document.getElementById(`${uid}-note`)?.focus();
      return;
    }

    setSaving(true);
    try {
      const hasil = await catatProgres(projectId, draft);
      if (!hasil.ok) {
        setGagal(hasil.error);
        setErrors(hasil.errors);
        return;
      }
      setDraft(emptyProgressDraft());
      setErrors({});
      setBerhasil("Tersimpan di riwayat.");
      router.refresh();
    } catch {
      setGagal("Gagal menyimpan catatan. Coba lagi.");
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

      <label className="block text-sm">
        <span className="font-medium">Catatan</span>
        <textarea
          id={`${uid}-note`}
          rows={2}
          value={draft.note}
          aria-invalid={errors.note ? true : undefined}
          aria-describedby={errors.note ? `${uid}-note-error` : undefined}
          onChange={(e) => set(e.target.value)}
          placeholder="Apa yang berubah sejak pembaruan terakhir?"
          className={`mt-1 ${inputClass(errors.note)}`}
        />
        {errors.note ? (
          <p id={`${uid}-note-error`} className="mt-1 text-xs text-high">
            {errors.note}
          </p>
        ) : (
          <span className="mt-1 block text-xs text-muted">
            {draft.note.trim().length}/{NOTE_MAX} karakter · tercatat pada {current}%
          </span>
        )}
      </label>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-on-brand transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {saving ? "Menyimpan…" : "Catat"}
        </button>
        <p aria-live="polite" className="text-sm text-muted">
          {berhasil ?? ""}
        </p>
      </div>
    </form>
  );
}
