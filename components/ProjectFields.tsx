"use client";

import type { FilterOptions } from "@/lib/api";
import { formatMarginPct, projectMargin } from "@/lib/finance";
import {
  DESCRIPTION_MAX,
  type DraftErrors,
  type DraftField,
  type ProjectDraft,
} from "@/lib/project-form";
import {
  CLIENT_TIERS,
  PAYMENT_TERMS,
  PENALTY_RISKS,
  PROJECT_PRIORITIES,
  PROJECT_STATUSES,
  TAX_TYPES,
  type TaxType,
} from "@/lib/types";
import { formatCurrency } from "@/lib/ui";

/* Kolom isian proyek, dipakai bersama form "Tambah Proyek" dan modal "Edit
   Proyek" — supaya keduanya tidak pernah beda aturan atau beda label. */

const fieldClass =
  "w-full rounded-lg border bg-surface px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-accent/20";

function inputClass(error?: string) {
  return `${fieldClass} ${error ? "border-high focus:border-high" : "border-border focus:border-accent"}`;
}

/** Pesan kesalahan satu kolom; `id`-nya ditunjuk aria-describedby input terkait. */
function Pesan({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1 text-xs text-high">
      {message}
    </p>
  );
}

/** id kolom dibuat dari prefix pemanggil supaya dua form di satu halaman tidak bentrok. */
export function fieldId(prefix: string, field: DraftField): string {
  return `${prefix}-${field}`;
}

export default function ProjectFields({
  prefix,
  draft,
  errors,
  options,
  onChange,
}: {
  prefix: string;
  draft: ProjectDraft;
  errors: DraftErrors;
  options: FilterOptions;
  onChange: (field: DraftField, value: string) => void;
}) {
  const errId = (field: DraftField) => `${prefix}-${field}-error`;

  // Isian yang belum jadi angka diperlakukan seperti belum diisi — pratinjaunya
  // tetap muncul, dan kesalahan ketiknya sudah dilaporkan Pesan di kolomnya.
  const angka = (isi: string): number | null => {
    const bersih = isi.trim();
    if (bersih === "") return null;
    const n = Number(bersih);
    return Number.isFinite(n) ? n : null;
  };

  const nilaiKontrak = angka(draft.value);
  const pratinjau =
    nilaiKontrak === null
      ? null
      : projectMargin({
          value: nilaiKontrak,
          taxType: (TAX_TYPES as string[]).includes(draft.taxType)
            ? (draft.taxType as TaxType)
            : "Non PKP",
          salesFee: angka(draft.salesFee),
          operationalCost: angka(draft.operationalCost),
        });

  const a11y = (field: DraftField) => ({
    id: fieldId(prefix, field),
    value: draft[field],
    "aria-invalid": errors[field] ? true : undefined,
    "aria-describedby": errors[field] ? errId(field) : undefined,
  });

  return (
    <div className="grid gap-4">
      <label className="block text-sm">
        <span className="font-medium">Nama proyek</span>
        <input
          {...a11y("name")}
          type="text"
          onChange={(e) => onChange("name", e.target.value)}
          placeholder="Contoh: Topografi Kawasan Industri Cikarang"
          className={`mt-1 ${inputClass(errors.name)}`}
        />
        <Pesan id={errId("name")} message={errors.name} />
      </label>

      <label className="block text-sm">
        <span className="font-medium">Deskripsi</span>
        <textarea
          {...a11y("description")}
          rows={3}
          onChange={(e) => onChange("description", e.target.value)}
          placeholder="Ruang lingkup singkat pekerjaan."
          className={`mt-1 ${inputClass(errors.description)}`}
        />
        <span className="mt-1 block text-xs text-muted">
          {draft.description.trim().length}/{DESCRIPTION_MAX} karakter
        </span>
        <Pesan id={errId("description")} message={errors.description} />
      </label>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block text-sm">
          <span className="font-medium">Jenis</span>
          <select
            {...a11y("type")}
            onChange={(e) => onChange("type", e.target.value)}
            className={`mt-1 ${inputClass(errors.type)}`}
          >
            <option value="">Pilih jenis…</option>
            {options.types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <Pesan id={errId("type")} message={errors.type} />
        </label>

        <label className="block text-sm">
          <span className="font-medium">Status</span>
          <select
            {...a11y("status")}
            onChange={(e) => onChange("status", e.target.value)}
            className={`mt-1 ${inputClass(errors.status)}`}
          >
            {PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <Pesan id={errId("status")} message={errors.status} />
        </label>

        {/* Prioritas default dihitung sistem; select-nya baru hidup kalau dikunci manual. */}
        <div className="block text-sm">
          <span className="font-medium">Prioritas</span>
          <div className="mt-1 flex gap-3">
            {(
              [
                ["auto", "Otomatis"],
                ["manual", "Kunci manual"],
              ] as const
            ).map(([mode, label]) => (
              <label key={mode} className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name={fieldId(prefix, "priorityMode")}
                  value={mode}
                  checked={draft.priorityMode === mode}
                  onChange={() => onChange("priorityMode", mode)}
                  className="accent-accent"
                />
                <span className={draft.priorityMode === mode ? "font-medium" : "text-muted"}>
                  {label}
                </span>
              </label>
            ))}
          </div>

          <select
            {...a11y("priority")}
            disabled={draft.priorityMode !== "manual"}
            onChange={(e) => onChange("priority", e.target.value)}
            className={`mt-2 ${inputClass(errors.priority)} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {PROJECT_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-muted">
            {draft.priorityMode === "auto"
              ? "Dihitung dari enam parameter berbobot: nilai, klien, penalti, progres, tenggat, ketergantungan."
              : "Sistem tidak akan menimpa nilai ini."}
          </span>
          <Pesan id={errId("priority")} message={errors.priority} />
          <Pesan id={errId("priorityMode")} message={errors.priorityMode} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block text-sm">
          <span className="font-medium">Tanggal mulai</span>
          <input
            {...a11y("startDate")}
            type="date"
            onChange={(e) => onChange("startDate", e.target.value)}
            className={`mt-1 ${inputClass(errors.startDate)}`}
          />
          <Pesan id={errId("startDate")} message={errors.startDate} />
        </label>

        <label className="block text-sm">
          <span className="font-medium">Tenggat</span>
          <input
            {...a11y("deadline")}
            type="date"
            min={draft.startDate || undefined}
            onChange={(e) => onChange("deadline", e.target.value)}
            className={`mt-1 ${inputClass(errors.deadline)}`}
          />
          <Pesan id={errId("deadline")} message={errors.deadline} />
        </label>

        <label className="block text-sm">
          <span className="font-medium">Progres (%)</span>
          <input
            {...a11y("progressPct")}
            type="number"
            min={0}
            max={100}
            step={1}
            onChange={(e) => onChange("progressPct", e.target.value)}
            className={`mt-1 ${inputClass(errors.progressPct)}`}
          />
          <Pesan id={errId("progressPct")} message={errors.progressPct} />
        </label>
      </div>

      <label className="block text-sm sm:max-w-xs">
        <span className="font-medium">PIC internal</span>
        <select
          {...a11y("ownerId")}
          onChange={(e) => onChange("ownerId", e.target.value)}
          className={`mt-1 ${inputClass(errors.ownerId)}`}
        >
          <option value="">Pilih anggota…</option>
          {options.owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <Pesan id={errId("ownerId")} message={errors.ownerId} />
      </label>

      {/* Blok klien dipisah garis: isinya tentang pihak luar, bukan soal pekerjaannya. */}
      <fieldset className="mt-2 border-t border-border pt-4">
        <legend className="sr-only">Data klien dan risiko</legend>
        <p className="mb-3 text-label-caps text-muted uppercase">Klien &amp; risiko</p>

        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium">Instansi klien</span>
              <input
                {...a11y("clientOrg")}
                type="text"
                onChange={(e) => onChange("clientOrg", e.target.value)}
                placeholder="Contoh: PT Karya Bumi Sejahtera"
                className={`mt-1 ${inputClass(errors.clientOrg)}`}
              />
              <Pesan id={errId("clientOrg")} message={errors.clientOrg} />
            </label>

            <label className="block text-sm">
              <span className="font-medium">
                Nama PIC klien <span className="font-normal text-muted">(opsional)</span>
              </span>
              <input
                {...a11y("clientName")}
                type="text"
                onChange={(e) => onChange("clientName", e.target.value)}
                placeholder="Contoh: Ir. Hendra Wijaya"
                className={`mt-1 ${inputClass(errors.clientName)}`}
              />
              <Pesan id={errId("clientName")} message={errors.clientName} />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium">
                Email <span className="font-normal text-muted">(opsional)</span>
              </span>
              <input
                {...a11y("clientEmail")}
                type="email"
                onChange={(e) => onChange("clientEmail", e.target.value)}
                placeholder="nama@instansi.co.id"
                className={`mt-1 ${inputClass(errors.clientEmail)}`}
              />
              <Pesan id={errId("clientEmail")} message={errors.clientEmail} />
            </label>

            <label className="block text-sm">
              <span className="font-medium">
                Telepon <span className="font-normal text-muted">(opsional)</span>
              </span>
              <input
                {...a11y("clientPhone")}
                type="tel"
                onChange={(e) => onChange("clientPhone", e.target.value)}
                placeholder="+62 812-3456-7890"
                className={`mt-1 ${inputClass(errors.clientPhone)}`}
              />
              <Pesan id={errId("clientPhone")} message={errors.clientPhone} />
            </label>
          </div>

          {/* Dua parameter yang tidak bisa ditebak sistem dari data lain — keduanya
             langsung menyumbang 20% dan 15% ke skor prioritas. */}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium">Tingkat kemitraan</span>
              <select
                {...a11y("clientTier")}
                onChange={(e) => onChange("clientTier", e.target.value)}
                className={`mt-1 ${inputClass(errors.clientTier)}`}
              >
                {CLIENT_TIERS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-muted">
                VIP paling kritis, proyek internal paling aman. Bobot 20%.
              </span>
              <Pesan id={errId("clientTier")} message={errors.clientTier} />
            </label>

            <label className="block text-sm">
              <span className="font-medium">Risiko penalti</span>
              <select
                {...a11y("penaltyRisk")}
                onChange={(e) => onChange("penaltyRisk", e.target.value)}
                className={`mt-1 ${inputClass(errors.penaltyRisk)}`}
              >
                {PENALTY_RISKS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-muted">
                Konsekuensi kontrak kalau terlambat. Bobot 15%.
              </span>
              <Pesan id={errId("penaltyRisk")} message={errors.penaltyRisk} />
            </label>
          </div>
        </div>
      </fieldset>

      {/* Sisi kontrak dan uang dikumpulkan di satu blok supaya margin bisa
         ditampilkan tepat di bawah angka-angka yang membentuknya. */}
      <fieldset className="mt-2 border-t border-border pt-4">
        <legend className="sr-only">Detail kontrak dan keuangan</legend>
        <p className="mb-3 text-label-caps text-muted uppercase">Kontrak &amp; keuangan</p>

        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block text-sm">
              <span className="font-medium">
                No kontrak <span className="font-normal text-muted">(opsional)</span>
              </span>
              <input
                {...a11y("contractNo")}
                type="text"
                onChange={(e) => onChange("contractNo", e.target.value)}
                placeholder="SPK/KBS/2026/0142"
                className={`mt-1 ${inputClass(errors.contractNo)}`}
              />
              <Pesan id={errId("contractNo")} message={errors.contractNo} />
            </label>

            <label className="block text-sm">
              <span className="font-medium">
                Tanggal kontrak <span className="font-normal text-muted">(opsional)</span>
              </span>
              <input
                {...a11y("contractDate")}
                type="date"
                onChange={(e) => onChange("contractDate", e.target.value)}
                className={`mt-1 ${inputClass(errors.contractDate)}`}
              />
              <span className="mt-1 block text-xs text-muted">
                Tanggal tanda tangan, boleh berbeda dari tanggal mulai.
              </span>
              <Pesan id={errId("contractDate")} message={errors.contractDate} />
            </label>

            <label className="block text-sm">
              <span className="font-medium">
                Nilai kontrak <span className="font-normal text-muted">(opsional)</span>
              </span>
              <input
                {...a11y("value")}
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                onChange={(e) => onChange("value", e.target.value)}
                placeholder="450000000"
                className={`mt-1 ${inputClass(errors.value)}`}
              />
              <span className="mt-1 block text-xs text-muted">
                Rupiah penuh, tanpa titik. Untuk klien PKP, isi nilai termasuk PPN.
              </span>
              <Pesan id={errId("value")} message={errors.value} />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium">TOP (skema pembayaran)</span>
              <select
                {...a11y("paymentTerm")}
                onChange={(e) => onChange("paymentTerm", e.target.value)}
                className={`mt-1 ${inputClass(errors.paymentTerm)}`}
              >
                {PAYMENT_TERMS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <Pesan id={errId("paymentTerm")} message={errors.paymentTerm} />
            </label>

            <label className="block text-sm">
              <span className="font-medium">Type tax</span>
              <select
                {...a11y("taxType")}
                onChange={(e) => onChange("taxType", e.target.value)}
                className={`mt-1 ${inputClass(errors.taxType)}`}
              >
                {TAX_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-muted">
                PKP: PPN dikeluarkan dulu sebelum margin dihitung.
              </span>
              <Pesan id={errId("taxType")} message={errors.taxType} />
            </label>
          </div>

          <label className="block text-sm">
            <span className="font-medium">
              Keterangan pembayaran{" "}
              {draft.paymentTerm === "Custom" ? (
                <span className="font-normal text-muted">(wajib untuk skema Custom)</span>
              ) : (
                <span className="font-normal text-muted">(opsional)</span>
              )}
            </span>
            <input
              {...a11y("paymentNote")}
              type="text"
              onChange={(e) => onChange("paymentNote", e.target.value)}
              placeholder="30% DP, 40% progres 70%, 30% setelah BAST"
              className={`mt-1 ${inputClass(errors.paymentNote)}`}
            />
            <Pesan id={errId("paymentNote")} message={errors.paymentNote} />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium">
                Sales fee / kickback <span className="font-normal text-muted">(opsional)</span>
              </span>
              <input
                {...a11y("salesFee")}
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                onChange={(e) => onChange("salesFee", e.target.value)}
                placeholder="20000000"
                className={`mt-1 ${inputClass(errors.salesFee)}`}
              />
              <Pesan id={errId("salesFee")} message={errors.salesFee} />
            </label>

            <label className="block text-sm">
              <span className="font-medium">
                Cost operasional <span className="font-normal text-muted">(opsional)</span>
              </span>
              <input
                {...a11y("operationalCost")}
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                onChange={(e) => onChange("operationalCost", e.target.value)}
                placeholder="300000000"
                className={`mt-1 ${inputClass(errors.operationalCost)}`}
              />
              <Pesan id={errId("operationalCost")} message={errors.operationalCost} />
            </label>
          </div>

          {/* Margin dihitung, tidak diketik. Ditampilkan di sini supaya akibat
             angka yang baru diisi terlihat sebelum disimpan. */}
          <div className="rounded-lg bg-background px-3 py-2 text-sm" aria-live="polite">
            {pratinjau === null ? (
              <span className="text-muted">Margin muncul setelah nilai kontrak diisi.</span>
            ) : (
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="text-muted">
                  Margin ={" "}
                  <span className="text-foreground">{formatCurrency(pratinjau.revenueBase)}</span>
                  {" − "}
                  <span className="text-foreground">{formatCurrency(pratinjau.salesFee)}</span>
                  {" − "}
                  <span className="text-foreground">
                    {formatCurrency(pratinjau.operationalCost)}
                  </span>
                </span>
                <span
                  className={`font-semibold tabular-nums ${
                    pratinjau.margin < 0 ? "text-high" : "text-foreground"
                  }`}
                >
                  {formatCurrency(pratinjau.margin)}
                  <span className="ml-1 font-normal text-muted">
                    ({formatMarginPct(pratinjau.marginPct)})
                  </span>
                </span>
              </div>
            )}
            {pratinjau?.incomplete && (
              <p className="mt-1 text-xs text-muted">
                Masih estimasi — ada komponen biaya yang belum diisi.
              </p>
            )}
            {pratinjau !== null && draft.taxType === "PKP" && (
              <p className="mt-1 text-xs text-muted">PPN sudah dikeluarkan dari nilai kontrak.</p>
            )}
          </div>
        </div>
      </fieldset>
    </div>
  );
}
