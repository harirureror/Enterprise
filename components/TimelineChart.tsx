"use client";

import { useMemo, useState } from "react";
import Badge from "@/components/Badge";
import ExportMenu from "@/components/ExportMenu";
import { SEMUA, type FaseProyek, type Semua, filterByFase, filterProjects } from "@/lib/filters";

import { barPosition, monthTicks, overlapInfo, overlapPerMonth, timelineRange } from "@/lib/timeline";
import {
  PROJECT_PRIORITIES,
  PROJECT_STATUSES,
  PROJECT_TYPES,
  type Project,
  type ProjectPriority,
  type User,
  type ProjectStatus,
  type ProjectType,
} from "@/lib/types";
import { formatDate, priorityClass, sortByPriority, statusClass, typeClass } from "@/lib/ui";

/* Warna bar ikut token status; mode gelap otomatis lewat variabel tema. */
const barClass: Record<Project["priority"], string> = {
  Tinggi: "bg-high hover:opacity-90",
  Sedang: "bg-med hover:opacity-90",
  Rendah: "bg-muted hover:opacity-90",
};

const selectClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 sm:w-auto";

// Di layar sempit filter ditumpuk vertikal biar label tidak terpotong.
const labelClass = "flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:gap-2";

export default function TimelineChart({
  projects,
  users,
}: {
  projects: Project[];
  /** Anggota, diturunkan server — komponen klien tidak membaca data sendiri. */
  users: User[];
}) {
  const namaPIC = (id: number) => users.find((u) => u.id === id)?.name ?? `Anggota ${id}`;
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [status, setStatus] = useState<ProjectStatus | Semua>(SEMUA);
  const [priority, setPriority] = useState<ProjectPriority | Semua>(SEMUA);
  const [type, setType] = useState<ProjectType | Semua>(SEMUA);
  const [ownerId, setOwnerId] = useState<number | Semua>(SEMUA);
  /* Bawaan: hanya yang sudah berjalan. Pertanyaan yang paling sering diajukan
     ke timeline adalah "siapa sedang mengerjakan apa", dan prospek yang belum
     tentu jadi hanya menambah baris yang harus dilewati mata. */
  const [tampilAkan, setTampilAkan] = useState(false);
  const [tampilSelesai, setTampilSelesai] = useState(false);

  // Anggota yang benar-benar punya proyek, biar dropdown tidak penuh nama kosong.
  const owners = useMemo(() => {
    const ids = [...new Set(projects.map((p) => p.ownerId))];
    return ids
      .map((id) => ({ id, name: users.find((u) => u.id === id)?.name ?? `Anggota ${id}` }))
      .sort((a, b) => a.name.localeCompare(b.name, "id"));
  }, [projects, users]);

  const fase = useMemo<FaseProyek[]>(() => {
    const f: FaseProyek[] = ["berjalan"];
    if (tampilAkan) f.push("akan");
    if (tampilSelesai) f.push("selesai");
    return f;
  }, [tampilAkan, tampilSelesai]);

  // Tahap disaring lebih dulu, baru penyaring kolom. Predikat kolomnya sama
  // persis dengan GET /api/projects, jadi hasilnya tidak bisa beda.
  const seTahap = useMemo(() => filterByFase(projects, fase), [projects, fase]);
  const filtered = useMemo(
    () => filterProjects(seTahap, { status, priority, type, ownerId }),
    [seTahap, status, priority, type, ownerId]
  );

  // Yang disembunyikan tahap dihitung dan ditulis apa adanya: penyaring yang
  // menyembunyikan tanpa memberi tahu membuat orang mengira datanya hilang.
  const tersembunyi = projects.length - seTahap.length;

  const sakelarFase = (
    <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
      <span className="text-muted">Tahap</span>
      <span className="rounded-lg bg-background px-2.5 py-1 text-xs text-muted ring-1 ring-border">
        Sudah berjalan · selalu tampil
      </span>
      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={tampilAkan}
          onChange={(e) => setTampilAkan(e.target.checked)}
          className="h-4 w-4 accent-accent"
        />
        <span>Akan berjalan</span>
      </label>
      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={tampilSelesai}
          onChange={(e) => setTampilSelesai(e.target.checked)}
          className="h-4 w-4 accent-accent"
        />
        <span>Selesai</span>
      </label>
      {tersembunyi > 0 && (
        <span className="text-xs text-muted">
          {tersembunyi} proyek disembunyikan tahap
        </span>
      )}
    </div>
  );

  const filterBar = (
    <div className="mb-4 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-center">
      <label className={labelClass}>
        <span className="text-muted">Status</span>
        <select
          className={selectClass}
          value={status}
          onChange={(e) => setStatus(e.target.value as ProjectStatus | Semua)}
        >
          <option value={SEMUA}>{SEMUA}</option>
          {PROJECT_STATUSES.map((s) => (
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
          {PROJECT_PRIORITIES.map((p) => (
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
          {PROJECT_TYPES.map((t) => (
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
          {owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );

  const range = timelineRange(filtered);
  if (!range) {
    return (
      <div>
        {sakelarFase}
        {filterBar}
        <p className="rounded-xl border border-border bg-surface p-5 text-sm text-muted shadow-card">
          {projects.length === 0
            ? "Belum ada proyek untuk ditampilkan di timeline."
            : seTahap.length === 0
              ? `Tidak ada proyek yang sudah berjalan. ${tersembunyi} proyek lain ada di tahap yang belum ditampilkan — centang "Akan berjalan" atau "Selesai" di atas.`
              : "Tidak ada proyek yang cocok dengan filter ini."}
        </p>
      </div>
    );
  }

  const rows = sortByPriority(filtered);
  const ticks = monthTicks(range);
  const selected = rows.find((p) => p.id === selectedId) ?? null;
  const { counts, pairs } = overlapInfo(filtered);
  const perMonth = overlapPerMonth(filtered);
  const bulanTerpadat = perMonth.reduce<(typeof perMonth)[number] | null>(
    (max, m) => (max === null || m.pairs > max.pairs ? m : max),
    null
  );

  return (
    <div>
      {sakelarFase}
      {filterBar}

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted" aria-live="polite">
          Menampilkan {filtered.length} dari {projects.length} proyek
        </p>
        {/* Urutannya sama dengan bar di bawah, jadi berkas ekspornya membaca
           persis seperti grafik yang sedang dilihat. */}
        <ExportMenu scope="timeline" ids={rows.map((p) => p.id)} label="Ekspor timeline" />
      </div>

      {/* Indikator bentrok: total, sebaran per bulan, dan bulan paling padat. */}
      <section
        aria-label="Indikator tumpang tindih jadwal"
        aria-live="polite"
        className="mb-3 rounded-xl border border-border bg-surface p-3 shadow-card sm:p-4"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-sm">
            {pairs > 0 ? (
              <>
                <span className="font-semibold text-med">{pairs} pasang proyek</span>{" "}
                jadwalnya tumpang tindih di rentang ini.
              </>
            ) : (
              "Tidak ada jadwal yang tumpang tindih di rentang ini."
            )}
          </p>
          {bulanTerpadat && bulanTerpadat.pairs > 0 && (
            <p className="text-xs text-muted">
              Paling padat: <span className="font-medium">{bulanTerpadat.label}</span> (
              {bulanTerpadat.pairs} bentrok)
            </p>
          )}
        </div>

        <ul className="mt-3 flex flex-wrap gap-2">
          {perMonth.map((m) => (
            <li
              key={m.key}
              className={`rounded-lg border px-2.5 py-1.5 text-xs ${
                m.pairs > 0 ? "border-med/30 bg-med/10 text-med" : "border-border text-muted"
              }`}
              title={`${m.projects} proyek berjalan di ${m.label}`}
            >
              <span className="font-medium">{m.label}</span>
              <span className="ml-1.5">
                {m.pairs} bentrok
                <span className="sr-only">{`, ${m.projects} proyek berjalan`}</span>
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
          <span
            aria-hidden
            className="h-3 w-6 rounded bg-muted ring-2 ring-med"
          />
          bar bergaris = bentrok jadwal
        </p>
      </section>

      {/* Gantt memang butuh lebar, jadi di ponsel digeser menyamping. Tanpa
          petunjuk ini, bar yang di luar layar tidak ketahuan ada. */}
      <p className="mb-2 text-xs text-muted sm:hidden">
        Geser bagan ke samping untuk melihat bulan berikutnya.
      </p>

      <div
        className="overflow-x-auto rounded-xl border border-border bg-surface shadow-card"
        onKeyDown={(e) => e.key === "Escape" && setSelectedId(null)}
      >
        <div className="min-w-[34rem] p-3 sm:min-w-[46rem] sm:p-4">
          {/* Sumbu bulan */}
          <div className="relative ml-36 h-5 border-b border-border sm:ml-56">
            {ticks.map((t) => (
              <span
                key={t.key}
                className="absolute -top-0.5 text-xs text-muted"
                style={{ left: `${t.leftPct}%` }}
              >
                {t.label}
              </span>
            ))}
          </div>

          <ul className="mt-3 space-y-2">
            {rows.map((p) => {
              const { leftPct, widthPct } = barPosition(p, range);
              const owner = users.find((u) => u.id === p.ownerId) ?? null;
              const isSelected = p.id === selectedId;
              const bentrok = counts.get(p.id) ?? 0;
              const rentang = `${formatDate(p.startDate)} sampai ${formatDate(p.deadline)}`;
              const catatanBentrok = bentrok > 0 ? `, bentrok dengan ${bentrok} proyek lain` : "";

              return (
                <li key={p.id} className="flex items-center gap-2 sm:gap-3">
                  <div className="w-36 shrink-0 sm:w-56">
                    <p
                      className={`truncate text-sm ${isSelected ? "font-semibold" : "font-medium"}`}
                      title={p.name}
                    >
                      {p.name}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {owner?.name ?? "Tanpa PIC"}
                      {bentrok > 0 && (
                        <span className="ml-1.5 text-med">· bentrok {bentrok}</span>
                      )}
                    </p>
                  </div>

                  <div className="relative h-7 flex-1 rounded bg-background">
                    {ticks.map((t) => (
                      <span
                        key={t.key}
                        aria-hidden
                        className="absolute inset-y-0 w-px bg-border"
                        style={{ left: `${t.leftPct}%` }}
                      />
                    ))}
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => setSelectedId(isSelected ? null : p.id)}
                      className={`absolute inset-y-1 rounded transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                        barClass[p.priority]
                      } ${
                        isSelected ? "ring-2 ring-accent" : bentrok > 0 ? "ring-2 ring-med" : ""
                      }`}
                      style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                      title={`${p.name}: ${rentang}${catatanBentrok}`}
                    >
                      <span className="sr-only">{`${p.name}, ${rentang}, prioritas ${p.priority}${catatanBentrok}`}</span>
                    </button>
                  </div>

                  {/* Di layar sempit warna bar sudah mewakili prioritas. */}
                  <Badge className={`${priorityClass[p.priority]} hidden shrink-0 sm:inline-flex`}>
                    {p.priority}
                  </Badge>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Detail proyek yang dipilih. */}
      <div aria-live="polite" className="mt-4">
        {selected ? (
          <article className="rounded-xl border border-border bg-surface p-4 shadow-card sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">{selected.name}</h3>
                <p className="mt-1 text-sm text-muted">{selected.description}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="rounded-lg border border-border px-2.5 py-1 text-sm text-muted hover:bg-background"
              >
                Tutup
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Badge className={typeClass[selected.type]}>{selected.type}</Badge>
              <Badge className={statusClass[selected.status]}>{selected.status}</Badge>
              <Badge className={priorityClass[selected.priority]}>{selected.priority}</Badge>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
              <div>
                <dt className="text-muted">Mulai</dt>
                <dd className="font-medium">{formatDate(selected.startDate)}</dd>
              </div>
              <div>
                <dt className="text-muted">Tenggat</dt>
                <dd className="font-medium">{formatDate(selected.deadline)}</dd>
              </div>
              <div>
                <dt className="text-muted">PIC</dt>
                <dd className="font-medium">{namaPIC(selected.ownerId)}</dd>
              </div>
              <div>
                <dt className="text-muted">Progres</dt>
                <dd className="font-medium">{selected.progressPct}%</dd>
              </div>
            </dl>
          </article>
        ) : (
          <p className="text-sm text-muted">Klik salah satu bar untuk melihat detail proyek.</p>
        )}
      </div>

      {/* Padanan teks bar, supaya data tetap terbaca pembaca layar. */}
      <table className="sr-only">
        <caption>Rentang tanggal tiap proyek</caption>
        <thead>
          <tr>
            <th scope="col">Proyek</th>
            <th scope="col">Mulai</th>
            <th scope="col">Tenggat</th>
            <th scope="col">Prioritas</th>
            <th scope="col">Jumlah bentrok</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id}>
              <th scope="row">{p.name}</th>
              <td>{formatDate(p.startDate)}</td>
              <td>{formatDate(p.deadline)}</td>
              <td>{p.priority}</td>
              <td>{counts.get(p.id) ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
