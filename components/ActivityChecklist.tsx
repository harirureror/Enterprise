"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Badge from "@/components/Badge";
import {
  centangAktivitas,
  hapusAktivitas,
  pakaiTemplateAktivitas,
  perbaruiAktivitas,
  simpanAktivitas,
  ubahModeProgres,
} from "@/lib/activity-actions";
import { tindakLanjutTerlewat, totalBobot } from "@/lib/activities";
import {
  type ActivityDraft,
  type ActivityErrors,
  activityToDraft,
  emptyActivityDraft,
} from "@/lib/activity-form";
import {
  PROJECT_STATUSES,
  type ProgressMode,
  type ProjectActivity,
} from "@/lib/types";
import { formatDate, statusClass } from "@/lib/ui";

/* Checklist aktivitas proyek.

   Inilah yang menggerakkan progres dan status: tidak ada lagi angka persen
   yang diketik orang, kecuali proyek sengaja dikunci ke mode manual. Karena
   itu tiap centang punya akibat yang terlihat langsung — progres, status, dan
   satu baris riwayat — dan teksnya menyebut akibat itu apa adanya. */

const fieldClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/20";

export default function ActivityChecklist({
  projectId,
  typeCode,
  activities,
  progressMode,
  adaTemplate,
  bolehUbah,
  hariIni,
}: {
  projectId: number;
  /** Jenis proyek, untuk menyebut template mana yang akan dipakai. */
  typeCode: string;
  activities: ProjectActivity[];
  progressMode: ProgressMode;
  adaTemplate: boolean;
  bolehUbah: boolean;
  /** Tanggal acuan dari server, supaya tidak bergeser karena zona waktu. */
  hariIni: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<ActivityDraft | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [errors, setErrors] = useState<ActivityErrors>({});
  const [gagal, setGagal] = useState<string | null>(null);

  const urut = [...activities].sort((a, b) => a.sortOrder - b.sortOrder);
  const total = totalBobot(urut);
  const selesai = urut.filter((a) => a.doneDate !== null).length;
  // Nama aktivitas yang tenggat tindak lanjutnya lewat; dihitung dari data yang
  // sama dengan notifikasinya, jadi keduanya tidak mungkin berbeda cerita.
  const terlewat = new Map(tindakLanjutTerlewat(urut, hariIni).map((t) => [t.name, t]));

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
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 id="aktivitas-heading" className="text-headline-sm font-semibold">
            Checklist Aktivitas
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            {progressMode === "auto"
              ? "Mencentang aktivitas langsung menggerakkan progres dan status proyek, dan tercatat di riwayat."
              : "Proyek ini dikunci ke progres manual, jadi mencentang aktivitas tidak mengubah angkanya."}
          </p>
        </div>
        {bolehUbah && (
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                jalankan(() =>
                  ubahModeProgres(projectId, progressMode === "auto" ? "manual" : "auto")
                )
              }
              className="rounded-lg border border-border px-2.5 py-1 text-sm text-muted hover:bg-background"
            >
              {progressMode === "auto" ? "Kunci ke angka manual" : "Hitung dari checklist"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setEditId(null);
                setErrors({});
                setGagal(null);
                setDraft(emptyActivityDraft());
              }}
              className="rounded-lg border border-border px-2.5 py-1 text-sm text-muted hover:bg-background"
            >
              + Tambah Aktivitas
            </button>
          </div>
        )}
      </div>

      {gagal && (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-high/30 bg-high/10 p-2.5 text-sm text-high"
        >
          {gagal}
        </p>
      )}

      {urut.length === 0 ? (
        <div className="mt-3">
          <p className="text-sm text-muted">Belum ada aktivitas untuk proyek ini.</p>
          {bolehUbah && adaTemplate && (
            <button
              type="button"
              disabled={pending}
              onClick={() => jalankan(() => pakaiTemplateAktivitas(projectId))}
              className="mt-2 rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-on-brand transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              Pakai template jenis {typeCode}
            </button>
          )}
        </div>
      ) : (
        <>
          <p className="mt-3 text-xs text-muted">
            {selesai} dari {urut.length} selesai
            {total !== 100 && ` · total bobot ${total}%, bukan 100%`}
          </p>

          <ul className="mt-2 grid gap-2">
            {urut.map((a) => {
              const lewat = terlewat.get(a.name);
              return (
                <li
                  key={a.id}
                  className="rounded-lg border border-border bg-background px-3 py-2.5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <label className="flex min-w-0 items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={a.doneDate !== null}
                        disabled={pending || !bolehUbah}
                        onChange={(e) =>
                          jalankan(() => centangAktivitas(a.id, e.target.checked))
                        }
                        className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
                      />
                      <span className="min-w-0">
                        <span
                          className={`block font-medium leading-snug ${
                            a.doneDate !== null ? "text-muted line-through" : ""
                          }`}
                        >
                          {a.name}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted">
                          {[
                            `bobot ${a.weight}%`,
                            a.targetDate ? `target ${formatDate(a.targetDate)}` : null,
                            a.doneDate ? `selesai ${formatDate(a.doneDate)}` : null,
                            a.slaDays ? `tindak lanjut ${a.slaDays} hari` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                        {lewat && (
                          <span className="mt-1 block text-xs text-high">
                            Batas tindak lanjut {formatDate(lewat.jatuhTempo)} sudah lewat{" "}
                            {lewat.lewatHari} hari.
                          </span>
                        )}
                      </span>
                    </label>

                    <div className="flex shrink-0 items-center gap-2">
                      <Badge className={statusClass[a.status]}>{a.status}</Badge>
                      {bolehUbah && (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => {
                            setEditId(a.id);
                            setErrors({});
                            setGagal(null);
                            setDraft(activityToDraft(a));
                          }}
                          className="rounded-lg border border-border px-2 py-1 text-sm text-muted hover:bg-surface"
                        >
                          Ubah
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {draft !== null && (
        <form
          noValidate
          className="mt-4 grid gap-3 rounded-lg border border-border bg-background p-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            jalankan(
              () =>
                editId === null
                  ? simpanAktivitas(projectId, draft)
                  : perbaruiAktivitas(editId, draft),
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
            {errors.weight ? (
              <p className="mt-1 text-xs text-high">{errors.weight}</p>
            ) : (
              <span className="mt-1 block text-xs text-muted">
                Sumbangannya ke progres proyek.
              </span>
            )}
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
              Tanggal target <span className="font-normal text-muted">(opsional)</span>
            </span>
            <input
              type="date"
              value={draft.targetDate}
              onChange={(e) => set("targetDate", e.target.value)}
              className={`mt-1 ${fieldClass}`}
            />
            {errors.targetDate ? (
              <p className="mt-1 text-xs text-high">{errors.targetDate}</p>
            ) : (
              <span className="mt-1 block text-xs text-muted">
                Yang menggambar garis rencana di kurva S.
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
                  jalankan(() => hapusAktivitas(editId), () => {
                    setDraft(null);
                    setEditId(null);
                  })
                }
                className="ml-auto rounded-lg border border-high/30 px-3 py-2 text-sm text-high hover:bg-high/10"
              >
                Hapus aktivitas
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
