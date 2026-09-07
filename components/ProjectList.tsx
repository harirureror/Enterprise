"use client";

import { useMemo, useState } from "react";
import { SEMUA, type Semua, filterProjects } from "@/lib/filters";
import {
  PROJECT_PRIORITIES,
  PROJECT_STATUSES,
  type Project,
  type ProjectPriority,
  type User,
  type ProjectStatus,
} from "@/lib/types";
import { sortByPriority } from "@/lib/ui";
import ProjectCard from "./ProjectCard";

const selectClass =
  "rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/20";

export default function ProjectList({
  projects,
  owners,
}: {
  projects: Project[];
  /** Anggota, diturunkan server supaya kartu bisa menulis nama PIC. */
  owners: User[];
}) {
  const [status, setStatus] = useState<ProjectStatus | Semua>(SEMUA);
  const [priority, setPriority] = useState<ProjectPriority | Semua>(SEMUA);

  // Predikatnya sama persis dengan GET /api/projects, jadi hasilnya tidak bisa beda.
  const filtered = useMemo(
    () => sortByPriority(filterProjects(projects, { status, priority })),
    [projects, status, priority]
  );

  const tinggi = filtered.filter((p) => p.priority === "Tinggi").length;

  return (
    <section aria-labelledby="daftar-heading">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 id="daftar-heading" className="text-headline-sm font-semibold">
          Daftar Proyek
        </h2>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
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

          <label className="flex items-center gap-2 text-sm">
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
        </div>
      </div>

      <p className="mt-2 text-sm text-muted" aria-live="polite">
        Menampilkan {filtered.length} dari {projects.length} proyek
        {tinggi > 0 && ` · ${tinggi} prioritas tinggi di urutan atas`}
      </p>

      {filtered.length === 0 ? (
        <p className="mt-4 rounded-xl border border-border bg-surface p-5 text-sm text-muted shadow-card">
          Tidak ada proyek yang cocok dengan filter ini.
        </p>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {filtered.map((p) => (
            <ProjectCard key={p.id} project={p} owners={owners} />
          ))}
        </div>
      )}
    </section>
  );
}
