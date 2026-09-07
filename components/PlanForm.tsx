"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { hapusRencana, perbaruiRencana, simpanRencana } from "@/lib/plan-actions";
import {
  OUTCOME_MAX,
  type PlanDraft,
  type PlanErrors,
  type PlanField,
  SUMMARY_MAX,
} from "@/lib/plan-form";
import {
  PLAN_GOALS,
  PLAN_KINDS,
  PLAN_SEGMENTS,
  PLAN_STATUSES,
  PROJECT_PRIORITIES,
  type User,
} from "@/lib/types";

/* Formulir satu rencana strategis, dipakai untuk membuat maupun mengubah.

   Satu komponen dua peran supaya kedua jalur tidak pelan-pelan berbeda aturan.
   Isian di sini hanya mempercepat umpan balik — yang menentukan tetap
   validatePlan() yang dipanggil ulang server action. */

const fieldClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/20";

export default function PlanForm({
  awal,
  owners,
  planId,
}: {
  awal: PlanDraft;
  owners: User[];
  /** Ada isinya berarti mengubah rencana yang sudah tersimpan. */
  planId?: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<PlanDraft>(awal);
  const [errors, setErrors] = useState<PlanErrors>({});
  const [gagal, setGagal] = useState<string | null>(null);
  const [konfirmasiHapus, setKonfirmasiHapus] = useState(false);

  const mengubah = planId !== undefined;

  function set(field: PlanField, value: string) {
    setDraft((lama) => ({ ...lama, [field]: value }));
    setErrors((lama) => ({ ...lama, [field]: undefined }));
  }

  function kirim() {
    setGagal(null);
    startTransition(async () => {
      const hasil = mengubah ? await perbaruiRencana(planId, draft) : await simpanRencana(draft);

      if (!hasil.ok) {
        setGagal(hasil.error);
        setErrors(hasil.errors);
        return;
      }

      // Sesudah membuat, daftar adalah tempat yang benar; sesudah mengubah,
      // halaman rencananya sendiri.
      router.push(mengubah ? `/rencana/${planId}` : "/rencana");
      router.refresh();
    });
  }

  function hapus() {
    if (!mengubah) return;
    setGagal(null);
    startTransition(async () => {
      const hasil = await hapusRencana(planId);
      if (!hasil.ok) {
        setGagal(hasil.error);
        return;
      }
      router.push("/rencana");
      router.refresh();
    });
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        kirim();
      }}
      className="grid gap-4 rounded-xl border border-border bg-surface p-5 shadow-card sm:grid-cols-2"
    >
      {gagal && (
        <p
          role="alert"
          className="rounded-lg border border-high/30 bg-high/10 p-2.5 text-sm text-high sm:col-span-2"
        >
          {gagal}
        </p>
      )}

      <label className="block text-sm sm:col-span-2">
        <span className="font-medium">Judul rencana</span>
        <input
          type="text"
          value={draft.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="Pelatihan Inspektur Tambang"
          className={`mt-1 ${fieldClass}`}
        />
        {errors.title && <p className="mt-1 text-xs text-high">{errors.title}</p>}
      </label>

      <label className="block text-sm sm:col-span-2">
        <span className="font-medium">
          Uraian <span className="font-normal text-muted">(opsional)</span>
        </span>
        <textarea
          rows={3}
          value={draft.summary}
          onChange={(e) => set("summary", e.target.value)}
          placeholder="Apa yang dikerjakan, dan kenapa sekarang."
          className={`mt-1 ${fieldClass}`}
        />
        <span className="mt-1 block text-xs text-muted">
          {draft.summary.trim().length}/{SUMMARY_MAX} karakter
        </span>
        {errors.summary && <p className="mt-1 text-xs text-high">{errors.summary}</p>}
      </label>

      <label className="block text-sm">
        <span className="font-medium">Jenis kegiatan</span>
        <select
          value={draft.kind}
          onChange={(e) => set("kind", e.target.value)}
          className={`mt-1 ${fieldClass}`}
        >
          {PLAN_KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        {errors.kind && <p className="mt-1 text-xs text-high">{errors.kind}</p>}
      </label>

      <label className="block text-sm">
        <span className="font-medium">Tujuan strategis</span>
        <select
          value={draft.goal}
          onChange={(e) => set("goal", e.target.value)}
          className={`mt-1 ${fieldClass}`}
        >
          {PLAN_GOALS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-muted">
          Daftar rencana dikelompokkan menurut ini.
        </span>
        {errors.goal && <p className="mt-1 text-xs text-high">{errors.goal}</p>}
      </label>

      <label className="block text-sm">
        <span className="font-medium">Segmen pasar</span>
        <select
          value={draft.segment}
          onChange={(e) => set("segment", e.target.value)}
          className={`mt-1 ${fieldClass}`}
        >
          {PLAN_SEGMENTS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {errors.segment && <p className="mt-1 text-xs text-high">{errors.segment}</p>}
      </label>

      <label className="block text-sm">
        <span className="font-medium">
          Wilayah sasaran <span className="font-normal text-muted">(opsional)</span>
        </span>
        <input
          type="text"
          value={draft.region}
          onChange={(e) => set("region", e.target.value)}
          placeholder="Kalimantan Timur"
          className={`mt-1 ${fieldClass}`}
        />
        <span className="mt-1 block text-xs text-muted">
          Tulis sama persis dengan provinsi di daftar proyek, supaya ringkasan jangkauan
          tidak memecahnya jadi dua baris.
        </span>
        {errors.region && <p className="mt-1 text-xs text-high">{errors.region}</p>}
      </label>

      <label className="block text-sm sm:col-span-2">
        <span className="font-medium">
          Mitra <span className="font-normal text-muted">(opsional)</span>
        </span>
        <input
          type="text"
          value={draft.partner}
          onChange={(e) => set("partner", e.target.value)}
          placeholder="Inspektur Tambang (Kementerian ESDM)"
          className={`mt-1 ${fieldClass}`}
        />
        {errors.partner && <p className="mt-1 text-xs text-high">{errors.partner}</p>}
      </label>

      <label className="block text-sm">
        <span className="font-medium">Status</span>
        <select
          value={draft.status}
          onChange={(e) => set("status", e.target.value)}
          className={`mt-1 ${fieldClass}`}
        >
          {PLAN_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {errors.status && <p className="mt-1 text-xs text-high">{errors.status}</p>}
      </label>

      <label className="block text-sm">
        <span className="font-medium">Prioritas</span>
        <select
          value={draft.priority}
          onChange={(e) => set("priority", e.target.value)}
          className={`mt-1 ${fieldClass}`}
        >
          {PROJECT_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        {errors.priority && <p className="mt-1 text-xs text-high">{errors.priority}</p>}
      </label>

      <label className="block text-sm">
        <span className="font-medium">Penanggung jawab</span>
        <select
          value={draft.ownerId}
          onChange={(e) => set("ownerId", e.target.value)}
          className={`mt-1 ${fieldClass}`}
        >
          {owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        {errors.ownerId && <p className="mt-1 text-xs text-high">{errors.ownerId}</p>}
      </label>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <label className="block">
          <span className="font-medium">
            Mulai <span className="font-normal text-muted">(opsional)</span>
          </span>
          <input
            type="date"
            value={draft.startDate}
            onChange={(e) => set("startDate", e.target.value)}
            className={`mt-1 ${fieldClass}`}
          />
          {errors.startDate && <p className="mt-1 text-xs text-high">{errors.startDate}</p>}
        </label>

        <label className="block">
          <span className="font-medium">
            Target <span className="font-normal text-muted">(opsional)</span>
          </span>
          <input
            type="date"
            value={draft.targetDate}
            onChange={(e) => set("targetDate", e.target.value)}
            className={`mt-1 ${fieldClass}`}
          />
          {errors.targetDate && <p className="mt-1 text-xs text-high">{errors.targetDate}</p>}
        </label>
      </div>

      <label className="block text-sm sm:col-span-2">
        <span className="font-medium">
          Ukuran keberhasilan <span className="font-normal text-muted">(opsional)</span>
        </span>
        <textarea
          rows={2}
          value={draft.outcome}
          onChange={(e) => set("outcome", e.target.value)}
          placeholder="Dua angkatan pelatihan terselenggara dan tiga perusahaan tambang meneken kontrak."
          className={`mt-1 ${fieldClass}`}
        />
        <span className="mt-1 block text-xs text-muted">
          Ditulis di depan supaya tidak dikarang di belakang. {draft.outcome.trim().length}/
          {OUTCOME_MAX} karakter
        </span>
        {errors.outcome && <p className="mt-1 text-xs text-high">{errors.outcome}</p>}
      </label>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4 sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-on-brand disabled:opacity-60"
        >
          {pending ? "Menyimpan…" : mengubah ? "Simpan Perubahan" : "Simpan Rencana"}
        </button>

        <Link
          href={mengubah ? `/rencana/${planId}` : "/rencana"}
          className="rounded-lg border border-border px-4 py-2 text-sm text-muted hover:bg-background"
        >
          Batal
        </Link>

        {mengubah && (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {konfirmasiHapus ? (
              <>
                <span className="text-sm text-muted">
                  Langkah, prospek, dan komentarnya ikut terhapus.
                </span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={hapus}
                  className="rounded-lg bg-high px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  Ya, hapus
                </button>
                <button
                  type="button"
                  onClick={() => setKonfirmasiHapus(false)}
                  className="rounded-lg border border-border px-3 py-2 text-sm text-muted"
                >
                  Urung
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={() => setKonfirmasiHapus(true)}
                className="rounded-lg border border-border px-3 py-2 text-sm text-muted hover:border-high/30 hover:bg-high/10 hover:text-high"
              >
                Hapus Rencana
              </button>
            )}
          </div>
        )}
      </div>
    </form>
  );
}
