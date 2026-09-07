"use client";

import type { AgendaDraft, AgendaErrors } from "@/lib/agenda-form";
import { canEditAgenda } from "@/lib/permissions";
import { AGENDA_KINDS, type Project, type User } from "@/lib/types";

/* Form isi/ubah agenda.

   Dipisah dari AgendaBoard supaya papan seret-lepas tetap terbaca; isinya
   dipindahkan apa adanya, aturannya tidak berubah sedikit pun. Yang menentukan
   tetap validateAgenda() yang dipanggil ulang server action. */

const fieldClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/20";

export type ViewerRingkas = { id: number; accessLevel: User["accessLevel"] };

export default function AgendaForm({
  rapat = false,
  draft,
  errors,
  editId,
  users,
  projects,
  viewer,
  pending,
  set,
  simpan,
  hapus,
  tutup,
}: {
  /** Satu kolom, tanpa bingkai kartu — dipakai saat form ada di dalam popover. */
  rapat?: boolean;
  draft: AgendaDraft;
  errors: AgendaErrors;
  /** `null` berarti sedang mengisi baru. */
  editId: number | null;
  users: User[];
  projects: Project[];
  viewer: ViewerRingkas;
  pending: boolean;
  set: (field: keyof AgendaDraft, value: string) => void;
  simpan: () => void;
  hapus: (id: number) => void;
  tutup: () => void;
}) {
  const isi = (
      <form
        noValidate
        className={rapat ? "grid gap-3" : "mt-4 grid gap-3 sm:grid-cols-2"}
        onSubmit={(e) => {
          e.preventDefault();
          simpan();
        }}
      >
        <label className="block text-sm">
          <span className="font-medium">Anggota</span>
          <select
            value={draft.userId}
            onChange={(e) => set("userId", e.target.value)}
            className={`mt-1 ${fieldClass}`}
          >
            {users
              .filter((u) => canEditAgenda(viewer, { userId: u.id }))
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
          </select>
          {errors.userId && <p className="mt-1 text-xs text-high">{errors.userId}</p>}
        </label>

        <label className="block text-sm">
          <span className="font-medium">Jenis kegiatan</span>
          <select
            value={draft.kind}
            onChange={(e) => set("kind", e.target.value)}
            className={`mt-1 ${fieldClass}`}
          >
            {AGENDA_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          {errors.kind && <p className="mt-1 text-xs text-high">{errors.kind}</p>}
        </label>

        <label className="block text-sm">
          <span className="font-medium">Mulai</span>
          <input
            type="date"
            value={draft.startDate}
            onChange={(e) => set("startDate", e.target.value)}
            className={`mt-1 ${fieldClass}`}
          />
          {errors.startDate && <p className="mt-1 text-xs text-high">{errors.startDate}</p>}
        </label>

        <label className="block text-sm">
          <span className="font-medium">Selesai</span>
          <input
            type="date"
            value={draft.endDate}
            min={draft.startDate || undefined}
            onChange={(e) => set("endDate", e.target.value)}
            className={`mt-1 ${fieldClass}`}
          />
          {errors.endDate && <p className="mt-1 text-xs text-high">{errors.endDate}</p>}
        </label>

        <label className={`block text-sm ${rapat ? "" : "sm:col-span-2"}`}>
          <span className="font-medium">
            Proyek <span className="font-normal text-muted">(opsional)</span>
          </span>
          <select
            value={draft.projectId}
            onChange={(e) => set("projectId", e.target.value)}
            className={`mt-1 ${fieldClass}`}
          >
            <option value="">Tanpa proyek</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-muted">
            Agenda dengan proyek yang sama dan tanggal bersambung akan tampil sebagai satu
            bar di papan. Agenda cuti tidak boleh berproyek.
          </span>
          {errors.projectId && <p className="mt-1 text-xs text-high">{errors.projectId}</p>}
        </label>

        <label className="block text-sm">
          <span className="font-medium">Kota/Kabupaten</span>
          <input
            type="text"
            value={draft.locationCity}
            onChange={(e) => set("locationCity", e.target.value)}
            className={`mt-1 ${fieldClass}`}
          />
          {errors.locationCity && <p className="mt-1 text-xs text-high">{errors.locationCity}</p>}
        </label>

        <label className="block text-sm">
          <span className="font-medium">Provinsi</span>
          <input
            type="text"
            value={draft.locationProvince}
            onChange={(e) => set("locationProvince", e.target.value)}
            className={`mt-1 ${fieldClass}`}
          />
          {errors.locationProvince && (
            <p className="mt-1 text-xs text-high">{errors.locationProvince}</p>
          )}
        </label>

        <label className={`block text-sm ${rapat ? "" : "sm:col-span-2"}`}>
          <span className="font-medium">
            Catatan <span className="font-normal text-muted">(opsional)</span>
          </span>
          <input
            type="text"
            value={draft.note}
            onChange={(e) => set("note", e.target.value)}
            placeholder="Akuisisi LiDAR blok selatan"
            className={`mt-1 ${fieldClass}`}
          />
          {errors.note && <p className="mt-1 text-xs text-high">{errors.note}</p>}
        </label>

        <div className={`flex flex-wrap gap-2 ${rapat ? "" : "sm:col-span-2"}`}>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-on-brand disabled:opacity-60"
          >
            {pending ? "Menyimpan…" : "Simpan"}
          </button>
          {editId !== null && (
            <button
              type="button"
              disabled={pending}
              onClick={() => hapus(editId)}
              className="rounded-lg border border-border px-4 py-2 text-sm text-muted hover:border-high/30 hover:bg-high/10 hover:text-high"
            >
              Hapus
            </button>
          )}
        </div>
      </form>
  );

  if (rapat) return isi;

  return (
    <section
      aria-labelledby="form-agenda"
      className="mt-6 rounded-xl border border-border bg-surface p-5 shadow-card"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="form-agenda" className="text-headline-sm font-semibold">
          {editId === null ? "Isi Agenda" : "Ubah Agenda"}
        </h2>
        <button type="button" onClick={tutup} className="text-sm text-muted underline">
          Tutup
        </button>
      </div>
      {isi}
    </section>
  );
}
