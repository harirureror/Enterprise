"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Badge from "@/components/Badge";
import { hapusProspek, perbaruiProspek, simpanProspek } from "@/lib/plan-actions";
import {
  type ProspectDraft,
  type ProspectErrors,
  emptyProspectDraft,
  prospectToDraft,
} from "@/lib/plan-form";
import { PROSPECT_STATUSES, type PlanProspect, type ProspectStatus } from "@/lib/types";

/* Calon klien yang akan didekati.

   Corongnya sendiri, terpisah dari pipeline proyek: yang tercatat di sini
   belum tentu pernah jadi proyek, dan itu justru gunanya — pendekatan bisa
   dipantau satu per satu, bukan cuma diniatkan. */

const statusClass: Record<ProspectStatus, string> = {
  "Belum dihubungi": "text-muted ring-1 ring-border",
  Dihubungi: "bg-stage/15 text-stage ring-1 ring-stage/30",
  Presentasi: "bg-med/15 text-med ring-1 ring-med/30",
  Negosiasi: "bg-accent/15 text-accent ring-1 ring-accent/30",
  "Menjadi Klien": "bg-low/15 text-low ring-1 ring-low/30",
  "Tidak Lanjut": "text-muted ring-1 ring-border",
};

const fieldClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/20";

export default function PlanProspects({
  planId,
  prospects,
  bolehUbah,
}: {
  planId: number;
  prospects: PlanProspect[];
  bolehUbah: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<ProspectDraft | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [errors, setErrors] = useState<ProspectErrors>({});
  const [gagal, setGagal] = useState<string | null>(null);

  const menang = prospects.filter((p) => p.status === "Menjadi Klien").length;

  function set(field: keyof ProspectDraft, value: string) {
    setDraft((lama) => (lama === null ? lama : { ...lama, [field]: value }));
    setErrors((lama) => ({ ...lama, [field]: undefined }));
  }

  function jalankan(
    aksi: () => Promise<{ ok: true } | { ok: false; error: string; errors: ProspectErrors }>,
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
        <h2 className="text-headline-sm font-semibold">Calon Klien</h2>
        <div className="flex items-center gap-3">
          {prospects.length > 0 && (
            <span className="text-sm text-muted">
              {menang} dari {prospects.length} jadi klien
            </span>
          )}
          {bolehUbah && (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setEditId(null);
                setErrors({});
                setGagal(null);
                setDraft(emptyProspectDraft());
              }}
              className="rounded-lg border border-border px-2.5 py-1 text-sm text-muted hover:bg-background"
            >
              + Tambah
            </button>
          )}
        </div>
      </div>

      {gagal && (
        <p role="alert" className="mt-2 rounded-lg border border-high/30 bg-high/10 p-2.5 text-sm text-high">
          {gagal}
        </p>
      )}

      {prospects.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Belum ada calon klien tercatat.</p>
      ) : (
        <ul className="mt-3 grid gap-2">
          {prospects.map((p) => (
            <li key={p.id} className="rounded-lg border border-border bg-background px-3 py-2.5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium leading-snug">{p.name}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {[p.contact, p.region].filter(Boolean).join(" · ") || "Tanpa kontak"}
                  </p>
                  {p.note && <p className="mt-1 text-xs text-muted">{p.note}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge className={statusClass[p.status]}>{p.status}</Badge>
                  {bolehUbah && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        setEditId(p.id);
                        setErrors({});
                        setGagal(null);
                        setDraft(prospectToDraft(p));
                      }}
                      className="rounded-lg border border-border px-2 py-1 text-sm text-muted hover:bg-surface"
                    >
                      Ubah
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {draft !== null && (
        <form
          noValidate
          className="mt-4 grid gap-3 rounded-lg border border-border bg-background p-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            jalankan(
              () => (editId === null ? simpanProspek(planId, draft) : perbaruiProspek(editId, draft)),
              () => {
                setDraft(null);
                setEditId(null);
              }
            );
          }}
        >
          <label className="block text-sm">
            <span className="font-medium">Nama calon klien</span>
            <input
              type="text"
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="PT Tambang Sejahtera"
              className={`mt-1 ${fieldClass}`}
            />
            {errors.name && <p className="mt-1 text-xs text-high">{errors.name}</p>}
          </label>

          <label className="block text-sm">
            <span className="font-medium">Status pendekatan</span>
            <select
              value={draft.status}
              onChange={(e) => set("status", e.target.value)}
              className={`mt-1 ${fieldClass}`}
            >
              {PROSPECT_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
            {errors.status && <p className="mt-1 text-xs text-high">{errors.status}</p>}
          </label>

          <label className="block text-sm">
            <span className="font-medium">
              Kontak <span className="font-normal text-muted">(opsional)</span>
            </span>
            <input
              type="text"
              value={draft.contact}
              onChange={(e) => set("contact", e.target.value)}
              className={`mt-1 ${fieldClass}`}
            />
            {errors.contact && <p className="mt-1 text-xs text-high">{errors.contact}</p>}
          </label>

          <label className="block text-sm">
            <span className="font-medium">
              Wilayah <span className="font-normal text-muted">(opsional)</span>
            </span>
            <input
              type="text"
              value={draft.region}
              onChange={(e) => set("region", e.target.value)}
              placeholder="Kalimantan Timur"
              className={`mt-1 ${fieldClass}`}
            />
            <span className="mt-1 block text-xs text-muted">
              Ikut dihitung di ringkasan jangkauan.
            </span>
            {errors.region && <p className="mt-1 text-xs text-high">{errors.region}</p>}
          </label>

          <label className="block text-sm sm:col-span-2">
            <span className="font-medium">
              Catatan <span className="font-normal text-muted">(opsional)</span>
            </span>
            <input
              type="text"
              value={draft.note}
              onChange={(e) => set("note", e.target.value)}
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
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="rounded-lg border border-border px-4 py-2 text-sm text-muted"
            >
              Batal
            </button>
            {editId !== null && (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  jalankan(() => hapusProspek(editId), () => {
                    setDraft(null);
                    setEditId(null);
                  })
                }
                className="rounded-lg border border-border px-4 py-2 text-sm text-muted hover:border-high/30 hover:bg-high/10 hover:text-high"
              >
                Hapus
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
