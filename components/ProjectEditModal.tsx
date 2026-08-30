"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import ProjectFields, { fieldId } from "@/components/ProjectFields";
import { perbaruiProyek } from "@/lib/actions";
import type { FilterOptions } from "@/lib/api";
import {
  type DraftErrors,
  type DraftField,
  type ProjectDraft,
  projectToDraft,
  validateDraft,
} from "@/lib/project-form";
import type { Project } from "@/lib/types";

/* Pakai <dialog> bawaan browser: fokus terkunci di dalam modal, Escape menutup,
   dan latar belakangnya inert — semuanya tanpa library. */

export default function ProjectEditModal({
  project,
  options,
  onClose,
}: {
  project: Project;
  options: FilterOptions;
  onClose: () => void;
}) {
  const router = useRouter();
  const uid = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<ProjectDraft>(() => projectToDraft(project));
  const [errors, setErrors] = useState<DraftErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [gagal, setGagal] = useState<string | null>(null);

  const ownerIds = options.owners.map((o) => o.id);

  // showModal() hanya bisa dipanggil dari efek, bukan saat render.
  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  function set(field: DraftField, value: string) {
    const berikutnya = { ...draft, [field]: value };
    setDraft(berikutnya);
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
      const hasil = await perbaruiProyek(project.id, draft);

      if (!hasil.ok) {
        setErrors(hasil.errors);
        setGagal(hasil.error);
        return;
      }

      dialogRef.current?.close();
      router.refresh();
    } catch {
      setGagal("Tidak bisa menghubungi server. Coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      // Escape dan close() sama-sama memicu onClose, jadi induknya cukup dengar di sini.
      onClose={onClose}
      aria-labelledby={`${uid}-judul`}
      /* `m-auto` mengembalikan pemusatan bawaan <dialog>: preflight Tailwind
         menyetel margin semua elemen jadi 0, jadi modal jatuh ke pojok. */
      className="m-auto max-h-[90dvh] w-[min(48rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-surface p-0 text-foreground shadow-card backdrop:bg-foreground/40 backdrop:backdrop-blur-sm"
    >
      <form noValidate onSubmit={handleSubmit} className="flex max-h-[90dvh] flex-col">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2 id={`${uid}-judul`} className="text-headline-sm font-semibold">
              Edit Proyek
            </h2>
            <p className="mt-0.5 truncate text-xs text-muted" title={project.name}>
              {project.name}
            </p>
          </div>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Tutup"
            className="rounded-lg border border-border px-2.5 py-1 text-sm text-muted hover:bg-background"
          >
            Tutup
          </button>
        </div>

        {/* Isian yang panjang menggulir di dalam modal, header dan tombolnya tetap terlihat. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {gagal && (
            <p
              role="alert"
              className="mb-4 rounded-xl border border-high/30 bg-high/10 p-3 text-sm text-high"
            >
              {gagal}
            </p>
          )}

          <ProjectFields
            prefix={uid}
            draft={draft}
            errors={errors}
            options={options}
            onChange={set}
          />
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-3 border-t border-border px-4 py-3 sm:px-5">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-on-brand transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {saving ? "Menyimpan…" : "Simpan Perubahan"}
          </button>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="rounded-lg border border-border px-4 py-2 text-sm text-muted hover:bg-background"
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
    </dialog>
  );
}
