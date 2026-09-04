import UserAdmin from "@/components/UserAdmin";
import { getUsers } from "@/lib/api";
import { requireAbility } from "@/lib/auth";
import { ACCESS_LEVELS } from "@/lib/types";

// Daftar akun berubah tiap tindakan admin, jadi jangan dicache.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Kelola Pengguna — Divisi Enterprise JSI",
  description: "Tambah akun, setel ulang sandi, dan atur tingkat akses anggota divisi.",
};

/** Ringkasan singkat tiap tingkat akses, supaya pilihannya tidak ditebak-tebak. */
const RINGKASAN: Record<string, string> = {
  Admin: "Seluruh akses, termasuk mengelola akun.",
  Owner: "Melihat semuanya termasuk keuangan; tidak mengubah data proyek, tapi bisa berkomentar.",
  HR: "Daftar proyek, timeline, dan agenda. Tanpa angka keuangan.",
  Manager: "Melihat dan mengubah semua proyek, serta mengisi agenda anggota.",
  Anggota: "Melihat semua proyek, mengubah yang dipegang sendiri.",
};

export default async function KelolaPenggunaPage() {
  const pengguna = await requireAbility("kelola-pengguna");
  const users = await getUsers();

  const aktif = users.filter((u) => u.isActive).length;
  const admin = users.filter((u) => u.isActive && u.accessLevel === "Admin").length;

  return (
    <div className="w-full">
      <header>
        <h1 className="text-headline-lg font-semibold">Kelola Pengguna</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          {aktif} akun aktif dari {users.length} terdaftar · {admin} admin. Akun
          dinonaktifkan, tidak dihapus — namanya tetap melekat di proyek dan komentar yang
          pernah dibuatnya.
        </p>
      </header>

      <section
        aria-labelledby="tingkat-heading"
        className="mt-6 rounded-xl border border-border bg-surface p-5 shadow-card"
      >
        <h2 id="tingkat-heading" className="text-headline-sm font-semibold">
          Arti Tingkat Akses
        </h2>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {ACCESS_LEVELS.map((l) => (
            <div key={l} className="rounded-lg bg-background px-3 py-2">
              <dt className="font-medium">{l}</dt>
              <dd className="mt-0.5 text-xs text-muted">{RINGKASAN[l]}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="mt-6">
        <UserAdmin users={users} meId={pengguna.id} />
      </div>
    </div>
  );
}
