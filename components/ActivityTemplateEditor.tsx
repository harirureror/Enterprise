"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Badge from "@/components/Badge";
import {
  hapusTemplateAktivitas,
  perbaruiTemplateAktivitas,
  simpanTemplateAktivitas,
} from "@/lib/activity-actions";
import { totalBobot } from "@/lib/activities";
import {
  type ActivityDraft,
  type ActivityErrors,
  emptyActivityDraft,
  templateToDraft,
} from "@/lib/activity-form";
import { PROJECT_STATUSES, type ActivityTemplate } from "@/lib/types";
import { statusClass } from "@/lib/ui";

/* Template aktivitas per jenis proyek.

   Ini cetakan, bukan pekerjaan: mengubahnya tidak menggeser proyek yang sudah
   berjalan — salinannya sudah berdiri sendiri di tiap proyek. Karena itu tidak
   ada tanggal target di sini; tanggal milik proyek, bukan milik cetakannya. */

const fieldClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/20";

export default function ActivityTemplateEditor({
  typeCode,
  templates,
}: {
  typeCode: string;
  templates: ActivityTemplate[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [buka, setBuka] = useState(false);
  const [draft, setDraft] = useState<ActivityDraft | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [errors, setErrors] = useState<ActivityErrors>({});
  const [gagal, setGagal] = useState<string | null>(null);

  const urut = [...templates].sort((a, b) => a.sortOrder - b.sortOrder);
  const total = totalBobot(urut.map((t) => ({ ...t, targetDate: null, doneDate: null })));

  function set(field: keyof ActivityDraft, value: string) {
    setDraft((lama) => (lama === null ? lama : { ...lama, [field]: value }));
    setErrors((lama) => ({ ...lama, [field]: undefined }));
  }

  function jalankan(
    aksi: () => Promise<{ ok: true } | { ok: false; error: string; errors: ActivityErrors }>,
    sesudah?: () => void
  ) {
    setGagal(null);
    startTransition(async () => {
      const hasil = await aksi();
      if (!hasil.ok) {
        setGagal(hasil.error);
        setErrors(hasil.errors);
        return;
      }
      sesudah?.();
      router.refresh();
    });
  }

  return (
    <div className="mt-4 border-t border-border pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <button
          type="button"
          onClick={() => setBuka((x) => !x)}
          aria-expanded={buka}
          className="text-sm font-medium hover:text-accent"
        >
          Template aktivitas ({urut.length})
          <span className="ml-1 text-muted" aria-hidden>
            {buka ? "▾" : "▸"}
          </span>
        </button>
        <p className="text-xs text-muted">
          {total === 100 ? "Total bobot 100%" : `Total bobot ${total}%, belum genap 100%`}
        </p>
      </div>

      {buka && (
        <>
          <p className="mt-2 text-xs text-muted">
            Disalin ke proyek berjenis {typeCode} saat daftarnya masih kosong. Mengubah
            template tidak menggeser proyek yang sudah berjalan.
          </p>

          {gagal && (
            <p
              role="alert"
              className="mt-3 rounded-lg border border-high/30 bg-high/10 p-2.5 text-sm text-high"
            >
              {gagal}
            </p>
          )}

          {urut.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Belum ada template untuk jenis ini.</p>
          ) : (
            <ol className="mt-3 grid gap-2">
              {urut.map((t) => (
                <li
                  key={t.id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium leading-snug">{t.name}</span>
                    <span className="mt-0.5 block text-xs text-muted">
                      {[
                        `bobot ${t.weight}%`,
                        t.durationDays ? `± ${t.durationDays} hari` : null,
                        t.slaDays ? `tindak lanjut ${t.slaDays} hari` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Badge className={statusClass[t.status]}>{t.status}</Badge>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        setEditId(t.id);
                        setErrors({});
                        setGagal(null);
                        setDraft(templateToDraft(t));
                      }}
                      className="rounded-lg border border-border px-2 py-1 text-sm text-muted hover:bg-surface"
                    >
                      Ubah
                    </button>
                  </span>
                </li>
              ))}
            </ol>
          )}

          {draft === null && (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setEditId(null);
                setErrors({});
                setGagal(null);
                setDraft(emptyActivityDraft());
              }}
              className="mt-3 rounded-lg border border-border px-2.5 py-1 text-sm text-muted hover:bg-background"
            >
              + Tambah Template
            </button>
          )}

          {draft !== null && (
            <form
              noValidate
              className="mt-3 grid gap-3 rounded-lg border border-border bg-background p-3 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                const lama = urut.find((t) => t.id === editId);
                jalankan(
                  () =>
                    editId === null
                      ? simpanTemplateAktivitas(typeCode, draft)
                      : perbaruiTemplateAktivitas(editId, draft, lama?.sortOrder ?? 0),
                  () => {
                    setDraft(null);
                    setEditId(null);
                  }
                );
              }}
            >
              <label className="block text-sm sm:col-span-2">
                <span className="font-medium">Nama aktivitas</span>
                <input
                  type="text"
                  value={draft.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="Penawaran dikirim"
                  className={`mt-1 ${fieldClass}`}
                />
                {errors.name && <p className="mt-1 text-xs text-high">{errors.name}</p>}
              </label>

              <label className="block text-sm">
                <span className="font-medium">Bobot (%)</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={draft.weight}
                  onChange={(e) => set("weight", e.target.value)}
                  className={`mt-1 ${fieldClass}`}
                />
                {errors.weight && <p className="mt-1 text-xs text-high">{errors.weight}</p>}
              </label>

              <label className="block text-sm">
                <span className="font-medium">Status setelah selesai</span>
                <select
                  value={draft.status}
                  onChange={(e) => set("status", e.target.value)}
                  className={`mt-1 ${fieldClass}`}
                >
                  {PROJECT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                {errors.status && <p className="mt-1 text-xs text-high">{errors.status}</p>}
              </label>

              <label className="block text-sm">
                <span className="font-medium">
                  Lama pengerjaan <span className="font-normal text-muted">(hari)</span>
                </span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={draft.durationDays}
                  onChange={(e) => set("durationDays", e.target.value)}
                  placeholder="7"
                  className={`mt-1 ${fieldClass}`}
                />
                {errors.durationDays ? (
                  <p className="mt-1 text-xs text-high">{errors.durationDays}</p>
                ) : (
                  <span className="mt-1 block text-xs text-muted">
                    Perbandingannya yang membagi tanggal saat template disalin.
                  </span>
                )}
              </label>

              <label className="block text-sm">
                <span className="font-medium">
                  Tenggat tindak lanjut <span className="font-normal text-muted">(hari)</span>
                </span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={draft.slaDays}
                  onChange={(e) => set("slaDays", e.target.value)}
                  placeholder="14"
                  className={`mt-1 ${fieldClass}`}
                />
                {errors.slaDays ? (
                  <p className="mt-1 text-xs text-high">{errors.slaDays}</p>
                ) : (
                  <span className="mt-1 block text-xs text-muted">
                    Kosongkan kalau tidak perlu diingatkan.
                  </span>
                )}
              </label>

              <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-on-brand transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {pending ? "Menyimpan…" : "Simpan"}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setDraft(null);
                    setEditId(null);
                    setErrors({});
                  }}
                  className="rounded-lg border border-border px-3 py-2 text-sm text-muted hover:bg-surface"
                >
                  Batal
                </button>
                {editId !== null && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      jalankan(() => hapusTemplateAktivitas(editId), () => {
                        setDraft(null);
                        setEditId(null);
                      })
                    }
                    className="ml-auto rounded-lg border border-high/30 px-3 py-2 text-sm text-high hover:bg-high/10"
                  >
                    Hapus template
                  </button>
                )}
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
}
