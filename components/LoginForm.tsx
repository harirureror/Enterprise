"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useId, useState } from "react";
import { masuk } from "@/lib/auth-actions";
import { type LoginDraft, type LoginErrors, emptyLoginDraft, validateLogin } from "@/lib/login-form";

/* Form masuk. Validasi bentuk isian dijalankan di klien supaya pesannya
   langsung terlihat, lalu diulang di server action. Kesalahan kredensial
   sengaja hanya datang dari server, dengan satu pesan seragam. */

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const uid = useId();
  const [draft, setDraft] = useState<LoginDraft>(emptyLoginDraft);
  const [errors, setErrors] = useState<LoginErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [gagal, setGagal] = useState<string | null>(null);
  const [lihatSandi, setLihatSandi] = useState(false);

  function ubah(field: keyof LoginDraft, value: string) {
    const berikutnya = { ...draft, [field]: value };
    setDraft(berikutnya);
    setGagal(null);
    if (submitted) setErrors(validateLogin(berikutnya));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitted(true);
    setGagal(null);

    const temuan = validateLogin(draft);
    setErrors(temuan);
    if (Object.keys(temuan).length > 0) {
      document.getElementById(`${uid}-${Object.keys(temuan)[0]}`)?.focus();
      return;
    }

    setSaving(true);
    try {
      const hasil = await masuk(draft);
      if (!hasil.ok) {
        setErrors(hasil.errors);
        setGagal(hasil.error);
        return;
      }

      // Kembali ke halaman yang tadi dituju. Hanya path internal yang
      // diterima, supaya parameter ini tidak bisa dipakai mengarahkan orang
      // ke situs lain.
      const tujuan = params.get("next");
      const aman = tujuan?.startsWith("/") && !tujuan.startsWith("//") ? tujuan : "/";
      router.push(aman);
      router.refresh();
    } catch {
      setGagal("Tidak bisa menghubungi server. Coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  const inputClass = (error?: string) =>
    `mt-1 w-full rounded-lg border bg-surface px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-accent/20 ${
      error ? "border-high focus:border-high" : "border-border focus:border-accent"
    }`;

  return (
    <form noValidate onSubmit={handleSubmit}>
      {gagal && (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-high/30 bg-high/10 p-3 text-sm text-high"
        >
          {gagal}
        </p>
      )}

      <label className="block text-sm" htmlFor={`${uid}-email`}>
        <span className="font-medium">Email</span>
      </label>
      <input
        id={`${uid}-email`}
        type="email"
        autoComplete="username"
        value={draft.email}
        aria-invalid={errors.email ? true : undefined}
        aria-describedby={errors.email ? `${uid}-email-error` : undefined}
        onChange={(e) => ubah("email", e.target.value)}
        placeholder="nama@jayasurvei.co.id"
        className={inputClass(errors.email)}
      />
      {errors.email && (
        <p id={`${uid}-email-error`} className="mt-1 text-xs text-high">
          {errors.email}
        </p>
      )}

      <label className="mt-4 block text-sm" htmlFor={`${uid}-password`}>
        <span className="font-medium">Kata sandi</span>
      </label>
      <div className="relative">
        <input
          id={`${uid}-password`}
          type={lihatSandi ? "text" : "password"}
          autoComplete="current-password"
          value={draft.password}
          aria-invalid={errors.password ? true : undefined}
          aria-describedby={errors.password ? `${uid}-password-error` : undefined}
          onChange={(e) => ubah("password", e.target.value)}
          className={`${inputClass(errors.password)} pr-20`}
        />
        <button
          type="button"
          onClick={() => setLihatSandi((v) => !v)}
          className="absolute inset-y-0 right-2 my-auto h-7 rounded-lg px-2 text-xs text-muted hover:bg-background"
        >
          {lihatSandi ? "Sembunyikan" : "Lihat"}
          <span className="sr-only"> kata sandi</span>
        </button>
      </div>
      {errors.password && (
        <p id={`${uid}-password-error`} className="mt-1 text-xs text-high">
          {errors.password}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="mt-6 w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-on-brand transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {saving ? "Memeriksa…" : "Masuk"}
      </button>

      <p aria-live="polite" className="mt-3 text-center text-sm text-muted">
        {submitted && Object.keys(errors).length > 0
          ? `${Object.keys(errors).length} kolom perlu diperbaiki.`
          : ""}
      </p>
    </form>
  );
}
