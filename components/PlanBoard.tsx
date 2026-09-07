"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import Badge from "@/components/Badge";
import type { PlanView } from "@/lib/api";
import { groupByGoal } from "@/lib/strategy";
import {
  PLAN_KINDS,
  PLAN_SEGMENTS,
  PLAN_STATUSES,
  type PlanStatus,
  type User,
} from "@/lib/types";
import { formatDate, priorityClass } from "@/lib/ui";

/* Daftar rencana, dikelompokkan per tujuan strategis.

   Pengelompokan itu bukan hiasan: pertanyaan yang paling sering diajukan ke
   halaman ini adalah "apa saja yang mengarah ke penetrasi pasar?", dan
   pengelompokan menjawabnya tanpa perlu menyaring apa pun. */

const SEMUA = "Semua";

const statusClass: Record<PlanStatus, string> = {
  Ide: "text-muted ring-1 ring-border",
  Disetujui: "bg-stage/15 text-stage ring-1 ring-stage/30",
  Berjalan: "bg-accent/15 text-accent ring-1 ring-accent/30",
  Selesai: "bg-low/15 text-low ring-1 ring-low/30",
  Ditunda: "bg-high/10 text-high ring-1 ring-high/20",
  Dibatalkan: "text-muted ring-1 ring-border",
};

const selectClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 sm:w-auto";
const labelClass = "flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:gap-2";

export default function PlanBoard({ plans, owners }: { plans: PlanView[]; owners: User[] }) {
  const [kind, setKind] = useState<string>(SEMUA);
  const [segment, setSegment] = useState<string>(SEMUA);
  const [status, setStatus] = useState<string>(SEMUA);
  const [ownerId, setOwnerId] = useState<string>(SEMUA);

  const tersaring = useMemo(
    () =>
      plans.filter(
        (p) =>
          (kind === SEMUA || p.kind === kind) &&
          (segment === SEMUA || p.segment === segment) &&
          (status === SEMUA || p.status === status) &&
          (ownerId === SEMUA || String(p.ownerId) === ownerId)
      ),
    [plans, kind, segment, status, ownerId]
  );

  const kelompok = useMemo(() => groupByGoal(tersaring), [tersaring]);
  const aktifCount = [kind, segment, status, ownerId].filter((v) => v !== SEMUA).length;
  const perluPerhatian = tersaring.filter((p) => p.perluPerhatian).length;

  return (
    <div>
      <div className="rounded-xl border border-border bg-surface p-3 shadow-card sm:p-4">
        <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-center">
          <label className={labelClass}>
            <span className="text-muted">Jenis</span>
            <select className={selectClass} value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value={SEMUA}>{SEMUA}</option>
              {PLAN_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>

          <label className={labelClass}>
            <span className="text-muted">Segmen</span>
            <select
              className={selectClass}
              value={segment}
              onChange={(e) => setSegment(e.target.value)}
            >
              <option value={SEMUA}>{SEMUA}</option>
              {PLAN_SEGMENTS.map((sg) => (
                <option key={sg} value={sg}>
                  {sg}
                </option>
              ))}
            </select>
          </label>

          <label className={labelClass}>
            <span className="text-muted">Status</span>
            <select
              className={selectClass}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value={SEMUA}>{SEMUA}</option>
              {PLAN_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </label>

          <label className={labelClass}>
            <span className="text-muted">Penanggung jawab</span>
            <select
              className={selectClass}
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
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
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted" aria-live="polite">
          Menampilkan {tersaring.length} dari {plans.length} rencana
          {perluPerhatian > 0 && (
            <span className="text-high"> · {perluPerhatian} perlu perhatian</span>
          )}
        </p>
        {aktifCount > 0 && (
          <button
            type="button"
            onClick={() => {
              setKind(SEMUA);
              setSegment(SEMUA);
              setStatus(SEMUA);
              setOwnerId(SEMUA);
            }}
            className="rounded-lg border border-border px-2.5 py-1 text-sm text-muted hover:bg-surface"
          >
            Hapus filter ({aktifCount})
          </button>
        )}
      </div>

      {/* Keempat tujuan selalu muncul — "belum ada rencana untuk efisiensi
          biaya" adalah informasi, bukan alasan menghilangkan kolomnya. */}
      <div className="mt-4 grid gap-6">
        {kelompok.map(({ goal, plans: isi }) => (
          <section key={goal} aria-labelledby={`tujuan-${goal}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id={`tujuan-${goal}`} className="text-headline-sm font-semibold">
                {goal}
              </h2>
              <span className="text-sm text-muted">{isi.length} rencana</span>
            </div>

            {isi.length === 0 ? (
              <p className="mt-2 rounded-xl border border-dashed border-border p-4 text-sm text-muted">
                Belum ada rencana yang mengarah ke sini.
              </p>
            ) : (
              <ul className="mt-3 grid gap-3 lg:grid-cols-2">
                {isi.map((p) => (
                  <li
                    key={p.id}
                    className={`rounded-xl border bg-surface p-4 shadow-card ${
                      p.perluPerhatian ? "border-high/40" : "border-border"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-semibold leading-snug">
                          <Link href={`/rencana/${p.id}`} className="hover:underline">
                            {p.title}
                          </Link>
                        </h3>
                        <p className="mt-0.5 truncate text-xs text-muted">
                          {p.kind} · {p.segment}
                          {p.region && ` · ${p.region}`}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge className={statusClass[p.status]}>{p.status}</Badge>
                        <Badge className={priorityClass[p.priority]}>{p.priority}</Badge>
                      </div>
                    </div>

                    {p.partner && (
                      <p className="mt-2 truncate text-sm text-muted">Mitra: {p.partner}</p>
                    )}

                    <div className="mt-3 flex items-center gap-2">
                      <div
                        className="h-2 flex-1 overflow-hidden rounded-full bg-border/70"
                        role="progressbar"
                        aria-valuenow={p.progress.pct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`Progres ${p.title}`}
                      >
                        <div
                          className="h-full rounded-full bg-accent"
                          style={{ width: `${p.progress.pct}%` }}
                        />
                      </div>
                      <span className="shrink-0 text-xs tabular-nums text-muted">
                        {p.progress.selesai}/{p.progress.total} langkah
                      </span>
                    </div>

                    <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
                      <div className="flex gap-1">
                        <dt>PIC:</dt>
                        <dd className="text-foreground">{p.owner?.name ?? "—"}</dd>
                      </div>
                      {p.targetDate && (
                        <div className="flex gap-1">
                          <dt>Target:</dt>
                          <dd className="text-foreground">{formatDate(p.targetDate)}</dd>
                        </div>
                      )}
                      {p.prospekTotal > 0 && (
                        <div className="flex gap-1">
                          <dt>Prospek:</dt>
                          <dd className="text-foreground">
                            {p.prospekMenang}/{p.prospekTotal} jadi klien
                          </dd>
                        </div>
                      )}
                    </dl>

                    {p.perluPerhatian && (
                      <p className="mt-2 text-xs text-high">
                        {p.progress.telat > 0
                          ? `${p.progress.telat} langkah lewat tenggat`
                          : "Tanggal target sudah lewat"}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
