"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import Badge from "@/components/Badge";
import ExportMenu from "@/components/ExportMenu";
import ProjectDeleteDialog from "@/components/ProjectDeleteDialog";
import ProjectEditModal from "@/components/ProjectEditModal";
import { SEMUA, type Semua, filterProjects } from "@/lib/filters";
import { formatMarginPct, projectMargin } from "@/lib/finance";
import { can, canEditProject, isFinanceField } from "@/lib/permissions";
import {
  PROJECT_COLUMNS,
  type ColumnKey,
  columnsSnapshot,
  defaultColumns,
  serverColumns,
  setColumns,
  subscribeColumns,
  toggleColumn,
} from "@/lib/table-columns";
import type { FilterOptions } from "@/lib/api";
import type {
  AccessLevel,
  Project,
  ProjectPriority,
  ProjectStatus,
  ProjectType,
} from "@/lib/types";
import {
  SORT_KEYS,
  SORT_LABELS,
  type SortKey,
  formatCurrencyShort,
  formatDate,
  priorityClass,
  sortProjects,
  statusClass,
} from "@/lib/ui";

/* Tampilan tabel dipilih karena halaman ini untuk mengelola banyak proyek
   sekaligus — bukan menyorot beberapa seperti kartu di dashboard.

   Kolom mana yang tampil disimpan per peramban lewat lib/table-columns.ts:
   tabelnya sudah padat, dan tiap orang mengurus sisi yang berbeda. */

/** Sel margin: angka merah kalau rugi, dan menyebut dirinya estimasi kalau
    komponen biayanya belum lengkap. */
function MarginCell({ project }: { project: Project }) {
  const untung = projectMargin(project);
  if (untung === null) return <td className="px-4 py-3 text-muted">—</td>;

  return (
    <td className="px-4 py-3 whitespace-nowrap tabular-nums">
      <span className={untung.margin < 0 ? "text-high" : "text-muted"}>
        {formatCurrencyShort(untung.margin)}
      </span>
      <span className="ml-1 text-xs text-muted">
        ({formatMarginPct(untung.marginPct)})
        {untung.incomplete && <span title="Ada komponen biaya yang belum diisi">*</span>}
      </span>
    </td>
  );
}

const selectClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 sm:w-auto";

const labelClass = "flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:gap-2";

export type Viewer = { id: number; accessLevel: AccessLevel };

export default function ProjectTable({
  projects,
  options,
  initialType = SEMUA,
  viewer,
}: {
  projects: Project[];
  options: FilterOptions;
  /** Filter jenis awal, mis. saat datang dari halaman kelola jenis. */
  initialType?: ProjectType | Semua;
  /** Pengguna yang sedang melihat; menentukan kolom dan tombol yang tampil. */
  viewer: Viewer;
}) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<ProjectStatus | Semua>(SEMUA);
  const [priority, setPriority] = useState<ProjectPriority | Semua>(SEMUA);
  const [type, setType] = useState<ProjectType | Semua>(initialType);
  const [ownerId, setOwnerId] = useState<number | Semua>(SEMUA);
  const [sort, setSort] = useState<SortKey>("prioritas");
  const [editId, setEditId] = useState<number | null>(null);
  const [hapusId, setHapusId] = useState<number | null>(null);

  /* Pilihan kolom hidup di localStorage, jadi dibaca lewat external store.
     serverColumns() mengembalikan null saat render server — belum ada
     localStorage di sana — dan susunan bawaan yang dipakai sampai hidrasi. */
  const tersimpan = useSyncExternalStore(subscribeColumns, columnsSnapshot, serverColumns);
  const kolom = tersimpan ?? defaultColumns();

  /* Kolom keuangan disaring dari daftar pilihan, bukan sekadar tidak dirender:
     kalau hanya selnya yang disembunyikan, pemilih kolom tetap menawarkannya
     dan orang akan mengira datanya hilang. Penegakan sesungguhnya tetap di
     server — balasan API pun tidak membawanya. */
  const bolehKeuangan = can(viewer.accessLevel, "lihat-keuangan");
  // Anggota boleh menyunting proyeknya sendiri, tapi menghapus bukan haknya.
  const bolehHapus = can(viewer.accessLevel, "hapus-proyek");
  const kolomTersedia = bolehKeuangan
    ? PROJECT_COLUMNS
    : PROJECT_COLUMNS.filter((c) => !isFinanceField(c.key === "nilai" ? "value" : c.key));
  const tampil = (key: ColumnKey) =>
    kolom[key] && kolomTersedia.some((c) => c.key === key);

  // Dibaca ulang dari props supaya dialog ikut menampilkan hasil simpan terakhir.
  const editing = projects.find((p) => p.id === editId) ?? null;
  const menghapus = projects.find((p) => p.id === hapusId) ?? null;

  // Predikatnya sama persis dengan GET /api/projects.
  const rows = useMemo(
    () => sortProjects(filterProjects(projects, { q, status, priority, type, ownerId }), sort),
    [projects, q, status, priority, type, ownerId, sort]
  );

  const aktifCount = [status, priority, type, ownerId].filter((v) => v !== SEMUA).length + (q.trim() ? 1 : 0);

  function resetFilter() {
    setQ("");
    setStatus(SEMUA);
    setPriority(SEMUA);
    setType(SEMUA);
    setOwnerId(SEMUA);
  }

  const namaPIC = (id: number) => options.owners.find((o) => o.id === id)?.name ?? "—";

  return (
    <div>
      <div className="rounded-xl border border-border bg-surface p-3 shadow-card sm:p-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="sr-only">Cari proyek</span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari nama atau deskripsi proyek…"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/20"
          />
        </label>

        <div className="mt-3 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-center">
          <label className={labelClass}>
            <span className="text-muted">Status</span>
            <select
              className={selectClass}
              value={status}
              onChange={(e) => setStatus(e.target.value as ProjectStatus | Semua)}
            >
              <option value={SEMUA}>{SEMUA}</option>
              {options.statuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <label className={labelClass}>
            <span className="text-muted">Prioritas</span>
            <select
              className={selectClass}
              value={priority}
              onChange={(e) => setPriority(e.target.value as ProjectPriority | Semua)}
            >
              <option value={SEMUA}>{SEMUA}</option>
              {options.priorities.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>

          <label className={labelClass}>
            <span className="text-muted">Jenis</span>
            <select
              className={selectClass}
              value={type}
              onChange={(e) => setType(e.target.value as ProjectType | Semua)}
            >
              <option value={SEMUA}>{SEMUA}</option>
              {options.types.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <label className={labelClass}>
            <span className="text-muted">Anggota</span>
            <select
              className={selectClass}
              value={ownerId}
              onChange={(e) =>
                setOwnerId(e.target.value === SEMUA ? SEMUA : Number(e.target.value))
              }
            >
              <option value={SEMUA}>{SEMUA}</option>
              {options.owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} ({o.projects})
                </option>
              ))}
            </select>
          </label>

          <label className={labelClass}>
            <span className="text-muted">Urutkan</span>
            <select
              className={selectClass}
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
            >
              {SORT_KEYS.map((k) => (
                <option key={k} value={k}>
                  {SORT_LABELS[k]}
                </option>
              ))}
            </select>
          </label>

          {/* <details> dipilih daripada dropdown buatan sendiri: Escape, fokus,
             dan pembacaan layar sudah ditangani peramban. Hanya berlaku untuk
             tabel — tampilan kartu di ponsel tidak punya kolom. */}
          <details className="relative hidden md:block">
            <summary className="cursor-pointer list-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-muted marker:content-none hover:bg-background">
              Kolom ({kolomTersedia.filter((c) => tampil(c.key)).length}/
              {kolomTersedia.length})
            </summary>
            <div className="absolute right-0 z-10 mt-1 w-56 rounded-lg border border-border bg-surface p-2 shadow-card">
              <fieldset>
                <legend className="px-1 pb-1 text-xs text-muted">
                  Kolom yang ditampilkan
                </legend>
                {kolomTersedia.map((c) => (
                  <label
                    key={c.key}
                    className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-background"
                  >
                    <input
                      type="checkbox"
                      checked={tampil(c.key)}
                      onChange={() => setColumns(toggleColumn(kolom, c.key))}
                      className="accent-accent"
                    />
                    {c.label}
                  </label>
                ))}
              </fieldset>
              <p className="mt-1 border-t border-border px-1 pt-1 text-xs text-muted">
                Nama proyek dan tombol aksi selalu tampil.
              </p>
            </div>
          </details>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted" aria-live="polite">
          Menampilkan {rows.length} dari {projects.length} proyek
        </p>
        <div className="flex items-center gap-2">
          {/* Ekspor mengikuti hasil saring dan urutan di layar — itu yang
             sedang dilihat orang saat menekannya. */}
          {can(viewer.accessLevel, "ekspor") && (
            <ExportMenu scope="proyek" ids={rows.map((p) => p.id)} />
          )}
        {aktifCount > 0 && (
          <button
            type="button"
            onClick={resetFilter}
            className="rounded-lg border border-border px-2.5 py-1 text-sm text-muted hover:bg-surface"
          >
            Hapus filter ({aktifCount})
          </button>
        )}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="mt-3 rounded-xl border border-border bg-surface p-5 text-sm text-muted shadow-card">
          Tidak ada proyek yang cocok dengan filter ini.
        </p>
      ) : (
        <>
        {/* Layar lebar: tabel. Di ponsel tabel ini memaksa lebar 52rem, jadi
            selalu harus digeser menyamping — datanya sama, disajikan sebagai
            kartu di bawah. */}
        <div className="mt-3 hidden overflow-x-auto rounded-xl border border-border bg-surface shadow-card md:block">
          {/* Lebar minimum menyesuaikan jumlah kolom: memaksa 52rem saat
              sebagian besar kolom disembunyikan akan membatalkan gunanya
              pemilih kolom. */}
          <table
            className={`w-full text-sm ${
              kolomTersedia.filter((c) => tampil(c.key)).length >= 6 ? "min-w-[52rem]" : ""
            }`}
          >
            <caption className="sr-only">
              Daftar proyek divisi Enterprise, diurutkan berdasarkan {SORT_LABELS[sort].toLowerCase()}
            </caption>
            <thead>
              <tr className="border-b border-border text-left text-label-caps text-muted">
                <th scope="col" className="px-4 py-3 font-medium">
                  Proyek
                </th>
                {kolomTersedia.filter((c) => tampil(c.key)).map((c) => (
                  <th key={c.key} scope="col" className="px-4 py-3 font-medium">
                    {c.label}
                  </th>
                ))}
                <th scope="col" className="px-4 py-3 font-medium">
                  <span className="sr-only">Aksi</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-background">
                  <th scope="row" className="max-w-xs px-4 py-3 text-left font-medium">
                    <Link
                      href={`/proyek/${p.id}`}
                      className="block truncate hover:underline"
                      title={p.name}
                    >
                      {p.name}
                    </Link>
                    <span className="mt-0.5 block truncate text-xs font-normal text-muted">
                      {p.clientOrg || p.description}
                    </span>
                  </th>
                  {tampil("jenis") && <td className="px-4 py-3 text-muted">{p.type}</td>}
                  {tampil("status") && (
                    <td className="px-4 py-3">
                      <Badge className={statusClass[p.status]}>{p.status}</Badge>
                    </td>
                  )}
                  {tampil("prioritas") && (
                    <td className="px-4 py-3">
                      <Badge className={priorityClass[p.priority]}>{p.priority}</Badge>
                    </td>
                  )}
                  {tampil("pic") && (
                    <td className="px-4 py-3 whitespace-nowrap text-muted">
                      {namaPIC(p.ownerId)}
                    </td>
                  )}
                  {tampil("tenggat") && (
                    <td className="px-4 py-3 whitespace-nowrap text-muted">
                      {formatDate(p.deadline)}
                    </td>
                  )}
                  {tampil("progres") && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2 w-20 shrink-0 overflow-hidden rounded-full bg-border/70"
                          role="progressbar"
                          aria-valuenow={p.progressPct}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`Progres ${p.name}`}
                        >
                          <div
                            className="h-full rounded-full bg-accent"
                            style={{ width: `${p.progressPct}%` }}
                          />
                        </div>
                        <span className="tabular-nums text-xs text-muted">{p.progressPct}%</span>
                      </div>
                    </td>
                  )}
                  {tampil("kontrak") && (
                    <td className="px-4 py-3 whitespace-nowrap text-muted">
                      {p.contractNo || "—"}
                    </td>
                  )}
                  {tampil("nilai") && (
                    <td className="px-4 py-3 whitespace-nowrap tabular-nums text-muted">
                      {formatCurrencyShort(p.value)}
                    </td>
                  )}
                  {tampil("margin") && <MarginCell project={p} />}
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {canEditProject(viewer, p) && (
                        <button
                          type="button"
                          onClick={() => setEditId(p.id)}
                          className="rounded-lg border border-border px-2.5 py-1 text-sm text-muted hover:bg-surface"
                        >
                          Edit<span className="sr-only"> {p.name}</span>
                        </button>
                      )}
                      {bolehHapus && canEditProject(viewer, p) && (
                        <button
                          type="button"
                          onClick={() => setHapusId(p.id)}
                          className="rounded-lg border border-border px-2.5 py-1 text-sm text-muted hover:border-high/30 hover:bg-high/10 hover:text-high"
                        >
                          Hapus<span className="sr-only"> {p.name}</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Layar kecil: satu kartu per proyek, tanpa geser menyamping. */}
        <ul className="mt-3 grid gap-3 md:hidden">
          {rows.map((p) => (
            <li
              key={p.id}
              className="rounded-xl border border-border bg-surface p-4 shadow-card"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold leading-snug">{p.name}</h3>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    {p.clientOrg || p.description}
                  </p>
                </div>
                <Badge className={priorityClass[p.priority]}>{p.priority}</Badge>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Badge className={statusClass[p.status]}>{p.status}</Badge>
                <Badge className="text-muted ring-1 ring-border">{p.type}</Badge>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <div
                  className="h-2 flex-1 overflow-hidden rounded-full bg-border/70"
                  role="progressbar"
                  aria-valuenow={p.progressPct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Progres ${p.name}`}
                >
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${p.progressPct}%` }}
                  />
                </div>
                <span className="shrink-0 text-xs tabular-nums text-muted">{p.progressPct}%</span>
              </div>

              <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
                <div className="flex gap-1">
                  <dt>PIC:</dt>
                  <dd className="text-foreground">{namaPIC(p.ownerId)}</dd>
                </div>
                <div className="flex gap-1">
                  <dt>Tenggat:</dt>
                  <dd className="text-foreground">{formatDate(p.deadline)}</dd>
                </div>
                {p.contractNo && (
                  <div className="flex gap-1">
                    <dt>Kontrak:</dt>
                    <dd className="text-foreground">{p.contractNo}</dd>
                  </div>
                )}
              </dl>

              {canEditProject(viewer, p) && (
                <div className="mt-3 flex gap-2 border-t border-border pt-3">
                  <button
                    type="button"
                    onClick={() => setEditId(p.id)}
                    className="flex-1 rounded-lg border border-border px-2.5 py-2 text-sm text-muted hover:bg-background"
                  >
                    Edit<span className="sr-only"> {p.name}</span>
                  </button>
                  {bolehHapus && (
                    <button
                      type="button"
                      onClick={() => setHapusId(p.id)}
                      className="flex-1 rounded-lg border border-border px-2.5 py-2 text-sm text-muted hover:border-high/30 hover:bg-high/10 hover:text-high"
                    >
                      Hapus<span className="sr-only"> {p.name}</span>
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
        </>
      )}

      {editing && (
        // key: ganti baris yang diedit = modal dengan isian baru, bukan sisa yang lama.
        <ProjectEditModal
          key={editing.id}
          project={editing}
          options={options}
          bolehKeuangan={bolehKeuangan}
          onClose={() => setEditId(null)}
        />
      )}

      {menghapus && (
        <ProjectDeleteDialog
          key={menghapus.id}
          project={menghapus}
          onClose={() => setHapusId(null)}
        />
      )}
    </div>
  );
}
