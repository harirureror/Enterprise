import { redirect } from "next/navigation";
import ProfileForm from "@/components/ProfileForm";
import { getMemberProfile } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { formatCurrencyShort } from "@/lib/ui";
import StatCard from "@/components/StatCard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Profil — Divisi Enterprise JSI",
  description: "Ubah nama dan foto profil Anda.",
};

export default async function ProfilPage() {
  const sesi = await getSession();
  if (!sesi) redirect("/login");

  const { user } = sesi;
  // Beban kerja sendiri ikut ditampilkan supaya halaman ini berguna, bukan
  // sekadar form isian.
  const profil = await getMemberProfile(user.id);
  const beban = profil?.member;

  return (
    <div className="w-full">
      <header>
        <h1 className="text-headline-lg font-semibold">Profil</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Nama dan foto Anda tampil di seluruh aplikasi — topbar, daftar tim, dan
          diskusi proyek.
        </p>
      </header>

      {beban && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Proyek Aktif" value={beban.activeCount} hint={`${beban.doneCount} selesai`} accent="text-accent" />
          <StatCard label="Prioritas Tinggi" value={beban.highPriorityActive} hint="Masih berjalan" accent="text-high" danger={beban.highPriorityActive > 0} />
          <StatCard label="Nilai Ditangani" value={formatCurrencyShort(beban.pipelineValue)} hint="Proyek aktif" />
          <StatCard label="Lewat Tenggat" value={beban.overdue} hint="Perlu dikejar" accent="text-high" danger={beban.overdue > 0} />
        </div>
      )}

      <section aria-labelledby="form-profil" className="mt-8 max-w-2xl">
        <h2 id="form-profil" className="text-headline-sm font-semibold">
          Data Diri
        </h2>
        <div className="mt-4 rounded-xl border border-border bg-surface p-5 shadow-card">
          <ProfileForm
            name={user.name}
            avatarUrl={user.avatarUrl}
            email={user.email}
            role={user.role}
          />
        </div>
      </section>
    </div>
  );
}
