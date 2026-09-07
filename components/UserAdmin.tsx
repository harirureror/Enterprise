"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Badge from "@/components/Badge";
import {
  resetSandi,
  tambahPengguna,
  ubahAktifPengguna,
  ubahIdentitasPengguna,
  ubahTingkatAkses,
} from "@/lib/admin-actions";
import { PASSWORD_MIN } from "@/lib/login-form";
import { type UserDraft, type UserErrors, emptyUserDraft } from "@/lib/user-form";
import { ACCESS_LEVELS, type AccessLevel, type User } from "@/lib/types";

/* Kelola pengguna.

   Semua tindakan di sini memanggil server action yang memeriksa izinnya
   sendiri — komponen ini hanya menyusun formnya. Tombol yang tidak dirender
   bukan penahan; yang menahan ada di lib/admin-actions.ts. */

const levelClass: Record<AccessLevel, string> = {
  Admin: "bg-high/10 text-high ring-1 ring-high/20",
  Owner: "bg-stage/15 text-stage ring-1 ring-stage/30",
  HR: "bg-med/15 text-med ring-1 ring-med/30",
  Manager: "bg-accent/15 text-accent ring-1 ring-accent/30",
  Anggota: "text-muted ring-1 ring-border",
};

const fieldClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/20";

export default function UserAdmin({ users, meId }: { users: User[]; meId: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<UserDraft>(emptyUserDraft);
  const [errors, setErrors] = useState<UserErrors>({});
  const [gagal, setGagal] = useState<string | null>(null);
  const [kabar, setKabar] = useState<string | null>(null);
  const [resetId, setResetId] = useState<number | null>(null);
  const [sandiBaru, setSandiBaru] = useState("");
  /** Baris yang sedang disunting identitasnya, beserta isian sementaranya. */
  const [ubahId, setUbahId] = useState<number | null>(null);
  const [identitas, setIdentitas] = useState({ name: "", email: "" });

  function set(field: keyof UserDraft, value: string) {
    setDraft((lama) => ({ ...lama, [field]: value }));
    setErrors((lama) => ({ ...lama, [field]: undefined }));
  }

  /** Pembungkus seragam: satu tempat mengurus pending, pesan, dan penyegaran. */
  function jalankan(
    aksi: () => Promise<{ ok: true } | { ok: false; error: string; errors: UserErrors }>,
    sukses: string,
    sesudah?: () => void
  ) {
    setGagal(null);
    setKabar(null);
    startTransition(async () => {
      const hasil = await aksi();
      if (!hasil.ok) {
        setGagal(hasil.error);
        setErrors(hasil.errors);
        return;
      }
      setKabar(sukses);
      sesudah?.();
      router.refresh();
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Form tambah akun */}
      <section
        aria-labelledby="tambah-heading"
        className="rounded-xl border border-border bg-surface p-5 shadow-card"
      >
        <h2 id="tambah-heading" className="text-headline-sm font-semibold">
          Tambah Akun
        </h2>
        <p className="mt-1 text-xs text-muted">
          Sandi awal diserahkan ke orangnya; ia bisa mengubahnya lewat reset kapan saja.
        </p>

        <form
          noValidate
          className="mt-4 grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            jalankan(() => tambahPengguna(draft), `Akun ${draft.name} dibuat.`, () => {
              setDraft(emptyUserDraft());
              setErrors({});
            });
          }}
        >
          <label className="block text-sm">
            <span className="font-medium">Nama</span>
            <input
              type="text"
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
              className={`mt-1 ${fieldClass}`}
            />
            {errors.name && <p className="mt-1 text-xs text-high">{errors.name}</p>}
          </label>

          <label className="block text-sm">
            <span className="font-medium">Email</span>
            <input
              type="email"
              value={draft.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="nama@jayasurvey.id"
              className={`mt-1 ${fieldClass}`}
            />
            {errors.email && <p className="mt-1 text-xs text-high">{errors.email}</p>}
          </label>

          <label className="block text-sm">
            <span className="font-medium">
              Jabatan <span className="font-normal text-muted">(opsional)</span>
            </span>
            <input
              type="text"
              value={draft.role}
              onChange={(e) => set("role", e.target.value)}
              placeholder="Project Manager"
              className={`mt-1 ${fieldClass}`}
            />
            <span className="mt-1 block text-xs text-muted">
              Jabatan tidak menentukan hak akses.
            </span>
            {errors.role && <p className="mt-1 text-xs text-high">{errors.role}</p>}
          </label>

          <label className="block text-sm">
            <span className="font-medium">Tingkat akses</span>
            <select
              value={draft.accessLevel}
              onChange={(e) => set("accessLevel", e.target.value)}
              className={`mt-1 ${fieldClass}`}
            >
              {ACCESS_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
            {errors.accessLevel && (
              <p className="mt-1 text-xs text-high">{errors.accessLevel}</p>
            )}
          </label>

          <label className="block text-sm">
            <span className="font-medium">Sandi awal</span>
            <input
              type="text"
              value={draft.password}
              onChange={(e) => set("password", e.target.value)}
              className={`mt-1 ${fieldClass}`}
            />
            <span className="mt-1 block text-xs text-muted">
              Minimal {PASSWORD_MIN} karakter. Sengaja terlihat supaya bisa disalin.
            </span>
            {errors.password && <p className="mt-1 text-xs text-high">{errors.password}</p>}
          </label>

          <button
            type="submit"
            disabled={pending}
            className="mt-1 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-on-brand transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Menyimpan…" : "Tambah Akun"}
          </button>
        </form>
      </section>

      {/* Daftar akun */}
      <section aria-labelledby="daftar-heading" className="lg:col-span-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="daftar-heading" className="text-headline-sm font-semibold">
            Akun Terdaftar
          </h2>
          <span className="text-sm text-muted">{users.length} akun</span>
        </div>

        <p aria-live="polite" className="mt-2 min-h-5 text-sm">
          {gagal ? (
            <span className="text-high">{gagal}</span>
          ) : kabar ? (
            <span className="text-muted">{kabar}</span>
          ) : null}
        </p>

        <ul className="mt-2 grid gap-3">
          {users.map((u) => (
            <li
              key={u.id}
              className={`rounded-xl border border-border bg-surface p-4 shadow-card ${
                u.isActive ? "" : "opacity-70"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold leading-snug">
                    {u.name}
                    {u.id === meId && (
                      <span className="ml-2 text-xs font-normal text-muted">(Anda)</span>
                    )}
                  </h3>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    {u.email} · {u.role || "Tanpa jabatan"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge className={levelClass[u.accessLevel]}>{u.accessLevel}</Badge>
                  {!u.isActive && (
                    <Badge className="text-muted ring-1 ring-border">Nonaktif</Badge>
                  )}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                <label className="flex items-center gap-2 text-sm">
                  <span className="text-muted">Akses</span>
                  <select
                    value={u.accessLevel}
                    disabled={pending}
                    onChange={(e) =>
                      jalankan(
                        () => ubahTingkatAkses(u.id, e.target.value),
                        `${u.name} kini ${e.target.value}. Sesinya dicabut.`
                      )
                    }
                    className="rounded-lg border border-border bg-surface px-2 py-1 text-sm"
                  >
                    {ACCESS_LEVELS.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    const buka = ubahId !== u.id;
                    setUbahId(buka ? u.id : null);
                    setResetId(null);
                    setErrors({});
                    setGagal(null);
                    if (buka) setIdentitas({ name: u.name, email: u.email });
                  }}
                  className="rounded-lg border border-border px-2.5 py-1 text-sm text-muted hover:bg-background"
                >
                  Ubah Identitas
                </button>

                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setResetId(resetId === u.id ? null : u.id);
                    setUbahId(null);
                    setSandiBaru("");
                  }}
                  className="rounded-lg border border-border px-2.5 py-1 text-sm text-muted hover:bg-background"
                >
                  Setel Sandi
                </button>

                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    jalankan(
                      () => ubahAktifPengguna(u.id, !u.isActive),
                      u.isActive
                        ? `${u.name} dinonaktifkan dan sesinya dicabut.`
                        : `${u.name} diaktifkan kembali.`
                    )
                  }
                  className="rounded-lg border border-border px-2.5 py-1 text-sm text-muted hover:border-high/30 hover:bg-high/10 hover:text-high"
                >
                  {u.isActive ? "Nonaktifkan" : "Aktifkan"}
                </button>
              </div>

              {ubahId === u.id && (
                <form
                  noValidate
                  className="mt-3 grid gap-2 border-t border-border pt-3 sm:grid-cols-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const emailBerubah =
                      identitas.email.trim().toLowerCase() !== u.email.toLowerCase();
                    jalankan(
                      () => ubahIdentitasPengguna(u.id, identitas.name, identitas.email),
                      emailBerubah
                        ? `Identitas ${identitas.name.trim()} diperbarui. Sesinya dicabut.`
                        : `Nama ${identitas.name.trim()} diperbarui.`,
                      () => setUbahId(null)
                    );
                  }}
                >
                  <label className="block text-sm">
                    <span className="text-muted">Nama</span>
                    <input
                      type="text"
                      value={identitas.name}
                      disabled={pending}
                      onChange={(e) => {
                        setIdentitas((x) => ({ ...x, name: e.target.value }));
                        setErrors((x) => ({ ...x, name: undefined }));
                      }}
                      className={`mt-1 ${fieldClass}`}
                    />
                    {errors.name && <p className="mt-1 text-xs text-high">{errors.name}</p>}
                  </label>

                  <label className="block text-sm">
                    <span className="text-muted">Email</span>
                    <input
                      type="email"
                      value={identitas.email}
                      disabled={pending}
                      onChange={(e) => {
                        setIdentitas((x) => ({ ...x, email: e.target.value }));
                        setErrors((x) => ({ ...x, email: undefined }));
                      }}
                      className={`mt-1 ${fieldClass}`}
                    />
                    {errors.email && <p className="mt-1 text-xs text-high">{errors.email}</p>}
                  </label>

                  {identitas.email.trim().toLowerCase() !== u.email.toLowerCase() && (
                    <p className="rounded-lg border border-med/30 bg-med/10 p-2 text-xs text-med sm:col-span-2">
                      Email adalah alamat untuk masuk. Menggantinya mencabut seluruh sesi
                      {u.id === meId ? " Anda — Anda akan diminta masuk lagi." : ` ${u.name}.`}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2 sm:col-span-2">
                    <button
                      type="submit"
                      disabled={pending}
                      className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-on-brand disabled:opacity-60"
                    >
                      {pending ? "Menyimpan…" : "Simpan"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setUbahId(null)}
                      className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted"
                    >
                      Batal
                    </button>
                  </div>
                </form>
              )}

              {resetId === u.id && (
                <form
                  noValidate
                  className="mt-3 flex flex-wrap items-end gap-2 border-t border-border pt-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    jalankan(
                      () => resetSandi(u.id, sandiBaru),
                      `Sandi ${u.name} disetel ulang. Sesinya dicabut, jadi ia harus masuk lagi.`,
                      () => {
                        setResetId(null);
                        setSandiBaru("");
                      }
                    );
                  }}
                >
                  <label className="flex-1 text-sm">
                    <span className="font-medium">Sandi baru untuk {u.name}</span>
                    <input
                      type="text"
                      value={sandiBaru}
                      onChange={(e) => setSandiBaru(e.target.value)}
                      className={`mt-1 ${fieldClass}`}
                    />
                    <span className="mt-1 block text-xs text-muted">
                      Minimal {PASSWORD_MIN} karakter. Menyetel sandi mencabut semua
                      sesinya, jadi ia langsung keluar.
                    </span>
                  </label>
                  <button
                    type="submit"
                    disabled={pending}
                    className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-on-brand disabled:opacity-60"
                  >
                    Simpan
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
