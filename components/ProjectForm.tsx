"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import ProjectFields, { fieldId } from "@/components/ProjectFields";
import { simpanProyek } from "@/lib/actions";
import type { FilterOptions } from "@/lib/api";
import {
  type DraftErrors,
  type DraftField,
  type ProjectDraft,
  emptyDraft,
  validateDraft,
} from "@/lib/project-form";

/* Validasi dijalankan dua kali: di sini supaya pesannya langsung terlihat,
   dan lagi di server action karena klien tidak boleh jadi satu-satunya
   penjaga. Keduanya memanggil validateDraft yang sama. */

export default function ProjectForm({ options }: { options: FilterOptions }) {
  const router = useRouter();
  const uid = useId();
  const [draft, setDraft] = useState<ProjectDraft>(emptyDraft);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [gagal, setGagal] = useState<string | null>(null);

  const ownerIds = options.owners.map((o) => o.id);

  function set(field: DraftField, value: string) {
    const berikutnya = { ...draft, [field]: value };
    setDraft(berikutnya);
    // Setelah percobaan kirim pertama, pesan ikut menyusut saat diperbaiki.
    if (submitted) setErrors(validateDraft(berikutnya, ownerIds));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitted(true);
    setGagal(null);

    const temuan = validateDraft(draft, ownerIds);
    setErrors(temuan);
    if (Object.keys(temuan).length > 0) {
      document.getElementById(fieldId(uid, Object.keys(temuan)[0] as DraftField))?.focus();
      return;
    }

    setSaving(true);
    try {
      // Server memeriksa ulang dengan validateDraft yang sama.
      const hasil = await simpanProyek(draft);

      if (!hasil.ok) {
        setErrors(hasil.errors);
        setGagal(hasil.error);
        return;
      }

      router.push("/proyek");
    } catch {
      setGagal("Tidak bisa menghubungi server. Coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="max-w-3xl">
      {gagal && (
        <p
          role="alert"
          className="mb-4 rounded-xl border border-high/30 bg-high/10 p-3 text-sm text-high"
        >
          {gagal}
        </p>
      )}

      <div className="rounded-xl border border-border bg-surface p-4 shadow-card sm:p-5">
        <ProjectFields
          prefix={uid}
          draft={draft}
          errors={errors}
          options={options}
          onChange={set}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-on-brand transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {saving ? "Menyimpan…" : "Simpan Proyek"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/proyek")}
          className="rounded-lg border border-border px-4 py-2 text-sm text-muted hover:bg-surface"
        >
          Batal
        </button>
        <p aria-live="polite" className="text-sm text-muted">
          {submitted && Object.keys(errors).length > 0
            ? `${Object.keys(errors).length} kolom perlu diperbaiki.`
            : ""}
        </p>
      </div>
    </form>
  );
}
