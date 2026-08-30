"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { kirimPengingat } from "@/lib/actions";
import {
  MESSAGE_MAX,
  REMINDER_TEMPLATES,
  type ReminderErrors,
  validateReminder,
} from "@/lib/reminder-form";

/* Pengingat manual ke PIC proyek. Validasinya dijalankan di sini supaya
   pesannya langsung terlihat, dan diulang di server action karena klien tidak
   boleh jadi satu-satunya penjaga. */

export default function ReminderForm({
  projectId,
  ownerName,
}: {
  projectId: number;
  ownerName: string;
}) {
  const router = useRouter();
  const uid = useId();
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<ReminderErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [gagal, setGagal] = useState<string | null>(null);
  const [berhasil, setBerhasil] = useState(false);

  function ubah(nilai: string) {
    setMessage(nilai);
    setBerhasil(false);
    if (submitted) setErrors(validateReminder({ message: nilai }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitted(true);
    setGagal(null);
    setBerhasil(false);

    const temuan = validateReminder({ message });
    setErrors(temuan);
    if (Object.keys(temuan).length > 0) {
      document.getElementById(`${uid}-message`)?.focus();
      return;
    }

    setSaving(true);
    try {
      const hasil = await kirimPengingat(projectId, { message });
      if (!hasil.ok) {
        setErrors(hasil.errors);
        setGagal(hasil.error);
        return;
      }

      setMessage("");
      setSubmitted(false);
      setBerhasil(true);
      router.refresh();
    } catch {
      setGagal("Tidak bisa menghubungi server. Coba lagi.");
    } finally {
      setSaving(false);
    }
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

      <label className="block text-sm" htmlFor={`${uid}-message`}>
        <span className="font-medium">Pesan untuk {ownerName}</span>
      </label>
      <textarea
        id={`${uid}-message`}
        value={message}
        rows={3}
        aria-invalid={errors.message ? true : undefined}
        aria-describedby={errors.message ? `${uid}-error` : undefined}
        onChange={(e) => ubah(e.target.value)}
        placeholder="Contoh: Mohon perbarui progres sebelum rapat Jumat."
        className={`mt-1 w-full rounded-lg border bg-surface px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-accent/20 ${
          errors.message ? "border-high focus:border-high" : "border-border focus:border-accent"
        }`}
      />
      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-xs text-muted">
          {message.trim().length}/{MESSAGE_MAX} karakter
        </span>
        {errors.message && (
          <p id={`${uid}-error`} className="text-xs text-high">
            {errors.message}
          </p>
        )}
      </div>

      {/* Kalimat siap pakai supaya tidak mulai dari halaman kosong. */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {REMINDER_TEMPLATES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => ubah(t)}
            className="rounded-lg border border-border px-2 py-1 text-xs text-muted hover:bg-background"
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-on-brand transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {saving ? "Mengirim…" : "Kirim Pengingat"}
        </button>
        <p aria-live="polite" className="text-sm text-muted">
          {berhasil ? "Pengingat terkirim." : ""}
        </p>
      </div>
    </form>
  );
}
