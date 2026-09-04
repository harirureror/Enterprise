"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Badge from "@/components/Badge";
import { hapusAgenda, perbaruiAgenda, simpanAgenda } from "@/lib/agenda-actions";
import {
  type AgendaDraft,
  type AgendaErrors,
  agendaToDraft,
  emptyAgendaDraft,
} from "@/lib/agenda-form";
import { agendaClashes, dayLabel, weekGrid, weekRange, shiftWeek } from "@/lib/agenda";
import { canEditAgenda } from "@/lib/permissions";
import { AGENDA_KINDS, type AgendaEntry, type AgendaKind, type Project, type User } from "@/lib/types";

/* Papan agenda sepekan: satu baris per anggota, tujuh kolom hari.

   Warna sel mengikuti jenis kegiatan, tapi tiap sel juga membawa labelnya —
   warna saja tidak cukup untuk semua orang, dan berkas cetak hitam-putih
   membuatnya hilang sama sekali. */

const kindClass: Record<AgendaKind, string> = {
  Lapangan: "bg-accent/15 text-accent ring-1 ring-accent/30",
  Kantor: "bg-stage/15 text-stage ring-1 ring-stage/30",
  Perjalanan: "bg-med/15 text-med ring-1 ring-med/30",
  Cuti: "text-muted ring-1 ring-border",
};

const fieldClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/20";

export type Viewer = { id: number; accessLevel: User["accessLevel"] };

export default function AgendaBoard({
  entries,
  users,
  projects,
  viewer,
  today,
}: {
  entries: AgendaEntry[];
  users: User[];
  projects: Project[];
  viewer: Viewer;
  /** Tanggal acuan dari server, supaya pekan awalnya tidak beda gara-gara zona waktu. */
  today: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [geser, setGeser] = useState(0);
  const [draft, setDraft] = useState<AgendaDraft | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [errors, setErrors] = useState<AgendaErrors>({});
  const [gagal, setGagal] = useState<string | null>(null);

  const pekan = useMemo(() => shiftWeek(weekRange(today), geser), [today, geser]);
  const grid = useMemo(() => weekGrid(entries, users, pekan), [entries, users, pekan]);
  const bentrok = useMemo(() => agendaClashes(entries), [entries]);
  const idBentrok = useMemo(
    () => new Set(bentrok.flatMap((b) => [b.a, b.b])),
    [bentrok]
  );

  const bisaIsiSiapaPun = users.some((u) => canEditAgenda(viewer, { userId: u.id }));

  function bukaBaru(userId: number) {
    setEditId(null);
    setErrors({});
    setGagal(null);
    setDraft({ ...emptyAgendaDraft(userId), startDate: pekan.start, endDate: pekan.start });
  }

  function bukaUbah(entry: AgendaEntry) {
    setEditId(entry.id);
    setErrors({});
    setGagal(null);
    setDraft(agendaToDraft(entry));
  }

  function set(field: keyof AgendaDraft, value: string) {
    setDraft((lama) => (lama === null ? lama : { ...lama, [field]: value }));
    setErrors((lama) => ({ ...lama, [field]: undefined }));
  }

  function simpan() {
    if (draft === null) return;
    setGagal(null);
    startTransition(async () => {
      const hasil = editId === null ? await simpanAgenda(draft) : await perbaruiAgenda(editId, draft);
      if (!hasil.ok) {
        setGagal(hasil.error);
        setErrors(hasil.errors);
        return;
      }
      setDraft(null);
      setEditId(null);
      router.refresh();
    });
  }

  function hapus(id: number) {
    setGagal(null);
    startTransition(async () => {
      const hasil = await hapusAgenda(id);
      if (!hasil.ok) {
        setGagal(hasil.error);
        return;
      }
      setDraft(null);
      setEditId(null);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setGeser((g) => g - 1)}
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:bg-surface"
          >
            ← Pekan lalu
          </button>
          <span className="text-sm font-medium tabular-nums">
            {pekan.start} s/d {pekan.end}
          </span>
          <button
            type="button"
            onClick={() => setGeser((g) => g + 1)}
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:bg-surface"
          >
            Pekan depan →
          </button>
          {geser !== 0 && (
            <button
              type="button"
              onClick={() => setGeser(0)}
              className="rounded-lg px-2 py-1.5 text-sm text-muted underline hover:text-foreground"
            >
              Kembali ke pekan ini
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>Jenis:</span>
          {AGENDA_KINDS.map((k) => (
            <Badge key={k} className={kindClass[k]}>
              {k}
            </Badge>
          ))}
        </div>
      </div>

      {gagal && (
        <p role="alert" className="mt-3 rounded-lg border border-high/30 bg-high/10 p-2.5 text-sm text-high">
          {gagal}
        </p>
      )}

      {/* Layar lebar: tabel sepekan. */}
      <div className="mt-4 hidden overflow-x-auto rounded-xl border border-border bg-surface shadow-card md:block">
        <table className="w-full min-w-[56rem] text-sm">
          <caption className="sr-only">
            Agenda tim pekan {pekan.start} sampai {pekan.end}
          </caption>
          <thead>
            <tr className="border-b border-border text-left text-label-caps text-muted">
              <th scope="col" className="px-4 py-3 font-medium">
                Anggota
              </th>
              {pekan.days.map((d) => (
                <th key={d} scope="col" className="px-2 py-3 font-medium">
                  {dayLabel(d)}
                </th>
              ))}
              <th scope="col" className="px-4 py-3">
                <span className="sr-only">Aksi</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {grid.map((baris) => (
              <tr key={baris.user.id} className="border-b border-border last:border-0">
                <th scope="row" className="px-4 py-3 text-left font-medium">
                  <span className="block">{baris.user.name}</span>
                  <span className="block text-xs font-normal text-muted">
                    {baris.total === 0 ? "Tidak ada agenda" : `${baris.total} agenda`}
                  </span>
                </th>

                {baris.cells.map((sel) => (
                  <td key={sel.date} className="px-2 py-2 align-top">
                    {sel.entries.map((e) => (
                      <button
                        key={e.id}
                        type="button"
                        disabled={!canEditAgenda(viewer, e)}
                        onClick={() => bukaUbah(e)}
                        title={e.note || undefined}
                        className={`mb-1 block w-full rounded px-1.5 py-1 text-left text-xs ${
                          kindClass[e.kind]
                        } ${canEditAgenda(viewer, e) ? "hover:opacity-80" : "cursor-default"} ${
                          idBentrok.has(e.id) ? "ring-2 ring-high/60" : ""
                        }`}
                      >
                        <span className="block font-medium">{e.kind}</span>
                        {e.locationCity && (
                          <span className="block truncate opacity-80">{e.locationCity}</span>
                        )}
                      </button>
                    ))}
                  </td>
                ))}

                <td className="px-4 py-2 text-right">
                  {canEditAgenda(viewer, { userId: baris.user.id }) && (
                    <button
                      type="button"
                      onClick={() => bukaBaru(baris.user.id)}
                      className="rounded-lg border border-border px-2.5 py-1 text-sm text-muted hover:bg-background"
                    >
                      + Isi<span className="sr-only"> agenda {baris.user.name}</span>
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Layar kecil: satu kartu per anggota. */}
      <ul className="mt-4 grid gap-3 md:hidden">
        {grid.map((baris) => {
          const sepekan = baris.cells.flatMap((c) => c.entries);
          const unik = [...new Map(sepekan.map((e) => [e.id, e])).values()];
          return (
            <li key={baris.user.id} className="rounded-xl border border-border bg-surface p-4 shadow-card">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold">{baris.user.name}</h3>
                {canEditAgenda(viewer, { userId: baris.user.id }) && (
                  <button
                    type="button"
                    onClick={() => bukaBaru(baris.user.id)}
                    className="rounded-lg border border-border px-2.5 py-1 text-sm text-muted"
                  >
                    + Isi
                  </button>
                )}
              </div>
              {unik.length === 0 ? (
                <p className="mt-2 text-sm text-muted">Tidak ada agenda pekan ini.</p>
              ) : (
                <ul className="mt-2 grid gap-2">
                  {unik.map((e) => (
                    <li key={e.id} className="rounded-lg bg-background px-3 py-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <Badge className={kindClass[e.kind]}>{e.kind}</Badge>
                        <span className="text-xs tabular-nums text-muted">
                          {e.startDate} – {e.endDate}
                        </span>
                      </div>
                      {e.locationCity && (
                        <p className="mt-1 text-xs text-muted">
                          {[e.locationCity, e.locationProvince].filter(Boolean).join(", ")}
                        </p>
                      )}
                      {canEditAgenda(viewer, e) && (
                        <button
                          type="button"
                          onClick={() => bukaUbah(e)}
                          className="mt-2 text-xs text-muted underline"
                        >
                          Ubah
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      {!bisaIsiSiapaPun && (
        <p className="mt-4 text-sm text-muted">
          Akses Anda hanya untuk melihat agenda tim.
        </p>
      )}

      {/* Form isi/ubah */}
      {draft !== null && (
        <section
          aria-labelledby="form-agenda"
          className="mt-6 rounded-xl border border-border bg-surface p-5 shadow-card"
        >
          <div className="flex items-baseline justify-between gap-2">
            <h2 id="form-agenda" className="text-headline-sm font-semibold">
              {editId === null ? "Isi Agenda" : "Ubah Agenda"}
            </h2>
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="text-sm text-muted underline"
            >
              Tutup
            </button>
          </div>

          <form
            noValidate
            className="mt-4 grid gap-3 sm:grid-cols-2"
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

            <label className="block text-sm sm:col-span-2">
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
                Lokasi terisi otomatis dari proyek kalau masih kosong. Agenda cuti tidak
                boleh berproyek.
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
              {errors.locationCity && (
                <p className="mt-1 text-xs text-high">{errors.locationCity}</p>
              )}
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

            <label className="block text-sm sm:col-span-2">
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

            <div className="flex flex-wrap gap-2 sm:col-span-2">
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
        </section>
      )}
    </div>
  );
}
