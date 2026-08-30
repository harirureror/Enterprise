"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { perbaruiProfil } from "@/lib/auth-actions";
import {
  NAME_MAX,
  type ProfileDraft,
  type ProfileErrors,
  initials,
  validateProfile,
} from "@/lib/profile-form";

/* Form ubah profil. Email dan peran tidak bisa diubah sendiri — keduanya
   menentukan akses, jadi urusan admin. Ditampilkan tapi dikunci supaya jelas
   bahwa itu memang tidak bisa diubah, bukan lupa dibuat. */

export default function ProfileForm({
  name,
  avatarUrl,
  email,
  role,
}: {
  name: string;
  avatarUrl: string | null;
  email: string;
  role: string;
}) {
  const router = useRouter();
  const uid = useId();
  const [draft, setDraft] = useState<ProfileDraft>({ name, avatarUrl: avatarUrl ?? "" });
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [gagal, setGagal] = useState<string | null>(null);
  const [berhasil, setBerhasil] = useState(false);
  const [fotoRusak, setFotoRusak] = useState(false);

  function ubah(field: keyof ProfileDraft, value: string) {
    const berikutnya = { ...draft, [field]: value };
    setDraft(berikutnya);
    setBerhasil(false);
    if (field === "avatarUrl") setFotoRusak(false);
    if (submitted) setErrors(validateProfile(berikutnya));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitted(true);
    setGagal(null);
    setBerhasil(false);

    const temuan = validateProfile(draft);
    setErrors(temuan);
    if (Object.keys(temuan).length > 0) {
      document.getElementById(`${uid}-${Object.keys(temuan)[0]}`)?.focus();
      return;
    }

    setSaving(true);
    try {
      const hasil = await perbaruiProfil(draft);
      if (!hasil.ok) {
        setErrors(hasil.errors);
        setGagal(hasil.error);
        return;
      }
      setBerhasil(true);
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

  const pratinjau = draft.avatarUrl.trim();
  const bisaPratinjau = pratinjau !== "" && !errors.avatarUrl && !fotoRusak;

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

      <div className="flex items-center gap-4">
        {bisaPratinjau ? (
          // Sengaja <img>, bukan next/image: sumbernya URL sembarang dari
          // pengguna, jadi tidak bisa lewat pengoptimal yang butuh domain
          // terdaftar di next.config.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={pratinjau}
            alt=""
            onError={() => setFotoRusak(true)}
            className="h-16 w-16 shrink-0 rounded-full object-cover ring-1 ring-border"
          />
        ) : (
          <span
            aria-hidden
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-background text-lg font-semibold text-muted ring-1 ring-border"
          >
            {initials(draft.name || name)}
          </span>
        )}

        <div className="min-w-0 text-sm text-muted">
          {fotoRusak ? (
            <span className="text-med">Gambar tidak bisa dimuat; inisial dipakai sementara.</span>
          ) : (
            <span>Foto tampil di topbar, daftar tim, dan diskusi proyek.</span>
          )}
        </div>
      </div>

      <label className="mt-5 block text-sm" htmlFor={`${uid}-name`}>
        <span className="font-medium">Nama</span>
      </label>
      <input
        id={`${uid}-name`}
        type="text"
        value={draft.name}
        aria-invalid={errors.name ? true : undefined}
        aria-describedby={errors.name ? `${uid}-name-error` : undefined}
        onChange={(e) => ubah("name", e.target.value)}
        maxLength={NAME_MAX + 20}
        className={inputClass(errors.name)}
      />
      {errors.name && (
        <p id={`${uid}-name-error`} className="mt-1 text-xs text-high">
          {errors.name}
        </p>
      )}

      <label className="mt-4 block text-sm" htmlFor={`${uid}-avatarUrl`}>
        <span className="font-medium">
          URL foto <span className="font-normal text-muted">(opsional)</span>
        </span>
      </label>
      <input
        id={`${uid}-avatarUrl`}
        type="url"
        value={draft.avatarUrl}
        aria-invalid={errors.avatarUrl ? true : undefined}
        aria-describedby={errors.avatarUrl ? `${uid}-avatarUrl-error` : undefined}
        onChange={(e) => ubah("avatarUrl", e.target.value)}
        placeholder="https://contoh.co.id/foto.jpg"
        className={inputClass(errors.avatarUrl)}
      />
      <span className="mt-1 block text-xs text-muted">
        Unggah berkas belum tersedia — penyimpanan berkas belum terpasang. Kosongkan
        untuk memakai inisial.
      </span>
      {errors.avatarUrl && (
        <p id={`${uid}-avatarUrl-error`} className="mt-1 text-xs text-high">
          {errors.avatarUrl}
        </p>
      )}

      <div className="mt-5 grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium">Email</span>
          <input
            type="email"
            value={email}
            readOnly
            disabled
            className="mt-1 w-full cursor-not-allowed rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Peran</span>
          <input
            type="text"
            value={role}
            readOnly
            disabled
            className="mt-1 w-full cursor-not-allowed rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted"
          />
        </label>
      </div>
      <p className="mt-1 text-xs text-muted">
        Email dan peran menentukan hak akses, jadi hanya admin yang bisa mengubahnya.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-on-brand transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {saving ? "Menyimpan…" : "Simpan Profil"}
        </button>
        <p aria-live="polite" className="text-sm text-muted">
          {berhasil ? "Profil tersimpan." : ""}
        </p>
      </div>
    </form>
  );
}
