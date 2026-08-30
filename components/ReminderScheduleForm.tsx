"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { aturJadwalPengingat, ubahAktifJadwal } from "@/lib/actions";
import {
  FREQUENCY_LABELS,
  REMINDER_FREQUENCIES,
  type ReminderFrequency,
  type ScheduleDraft,
  type ScheduleErrors,
  nextOccurrence,
  validateSchedule,
} from "@/lib/reminder-schedule";
import type { ReminderSchedule } from "@/lib/types";
import { formatDate } from "@/lib/ui";

/* Satu proyek cukup punya satu jadwal; mengatur ulang menimpa yang lama.
   Pratinjau tanggal dihitung di klien dari fungsi yang sama dengan server,
   jadi yang terlihat di form persis yang akan tersimpan. */

export default function ReminderScheduleForm({
  projectId,
  schedule,
  today,
}: {
  projectId: number;
  schedule: ReminderSchedule | null;
  /** Tanggal acuan dari server, supaya validasi klien dan server sepakat. */
  today: string;
}) {
  const router = useRouter();
  const uid = useId();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<ScheduleDraft>({
    frequency: schedule?.frequency ?? "mingguan",
    startDate: schedule?.nextAt ?? today,
  });
  const [errors, setErrors] = useState<ScheduleErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [gagal, setGagal] = useState<string | null>(null);
  const [berhasil, setBerhasil] = useState(false);

  function ubah(field: keyof ScheduleDraft, value: string) {
    const berikutnya = { ...draft, [field]: value };
    setDraft(berikutnya);
    setBerhasil(false);
    if (submitted) setErrors(validateSchedule(berikutnya, today));
  }

  // Pratinjau hanya masuk akal kalau isiannya sendiri sudah sah.
  const sah = Object.keys(validateSchedule(draft, today)).length === 0;
  const pratinjau: string[] = [];
  if (sah) {
    let kursor = draft.startDate;
    for (let i = 0; i < 3; i++) {
      pratinjau.push(kursor);
      kursor = nextOccurrence(kursor, draft.frequency as ReminderFrequency);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitted(true);
    setGagal(null);
    setBerhasil(false);

    const temuan = validateSchedule(draft, today);
    setErrors(temuan);
    if (Object.keys(temuan).length > 0) return;

    startTransition(async () => {
      const hasil = await aturJadwalPengingat(projectId, draft);
      if (!hasil.ok) {
        setErrors(hasil.errors);
        setGagal(hasil.error);
        return;
      }
      setBerhasil(true);
      router.refresh();
    });
  }

  function toggleAktif() {
    setGagal(null);
    startTransition(async () => {
      const hasil = await ubahAktifJadwal(projectId, !schedule?.isActive);
      if (!hasil.ok) {
        setGagal(hasil.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <form noValidate onSubmit={handleSubmit}>
      {gagal && (
        <p
          role="alert"
          className="mb-3 rounded-lg border border-high/30 bg-high/10 p-2.5 text-sm text-high"
        >
          {gagal}
        </p>
      )}

      {schedule && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-background p-3">
          <p className="text-sm">
            {schedule.isActive ? (
              <>
                Aktif · berikutnya{" "}
                <span className="font-medium">{formatDate(schedule.nextAt)}</span>
              </>
            ) : (
              <span className="text-muted">Jadwal sedang dimatikan.</span>
            )}
          </p>
          <button
            type="button"
            onClick={toggleAktif}
            disabled={pending}
            className="rounded-lg border border-border px-2.5 py-1 text-sm text-muted hover:bg-surface disabled:opacity-60"
          >
            {schedule.isActive ? "Matikan" : "Hidupkan"}
          </button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium">Frekuensi</span>
          <select
            id={`${uid}-frequency`}
            value={draft.frequency}
            aria-invalid={errors.frequency ? true : undefined}
            onChange={(e) => ubah("frequency", e.target.value)}
            className={`mt-1 w-full rounded-lg border bg-surface px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-accent/20 ${
              errors.frequency ? "border-high" : "border-border focus:border-accent"
            }`}
          >
            {REMINDER_FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {FREQUENCY_LABELS[f]}
              </option>
            ))}
          </select>
          {errors.frequency && <p className="mt-1 text-xs text-high">{errors.frequency}</p>}
        </label>

        <label className="block text-sm">
          <span className="font-medium">Mulai</span>
          <input
            id={`${uid}-startDate`}
            type="date"
            min={today}
            value={draft.startDate}
            aria-invalid={errors.startDate ? true : undefined}
            onChange={(e) => ubah("startDate", e.target.value)}
            className={`mt-1 w-full rounded-lg border bg-surface px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-accent/20 ${
              errors.startDate ? "border-high" : "border-border focus:border-accent"
            }`}
          />
          {errors.startDate && <p className="mt-1 text-xs text-high">{errors.startDate}</p>}
        </label>
      </div>

      {pratinjau.length > 0 && (
        <p className="mt-2 text-xs text-muted">
          Tiga pengiriman berikutnya: {pratinjau.map((d) => formatDate(d)).join(" · ")}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-background disabled:opacity-60"
        >
          {pending ? "Menyimpan…" : schedule ? "Perbarui Jadwal" : "Atur Jadwal"}
        </button>
        <p aria-live="polite" className="text-sm text-muted">
          {berhasil ? "Jadwal tersimpan." : ""}
        </p>
      </div>
    </form>
  );
}
