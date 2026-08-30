import StatCard from "@/components/StatCard";
import TeamList from "@/components/TeamList";
import { getTeam } from "@/lib/api";
import { formatCurrencyShort } from "@/lib/ui";

// Beban kerja berubah tiap proyek berpindah tangan, jadi jangan dicache.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Tim — Divisi Enterprise JSI",
  description: "Beban kerja tiap anggota divisi: proyek aktif, nilai, tenggat, dan bentrok jadwal.",
};

export default async function TimPage() {
  const members = await getTeam();

  const aktif = members.reduce((sum, m) => sum + m.activeCount, 0);
  const telat = members.reduce((sum, m) => sum + m.overdue, 0);
  const nilai = members.reduce((sum, m) => sum + m.pipelineValue, 0);
  const kosong = members.filter((m) => m.activeCount === 0).length;

  return (
    <div className="w-full">
      <header>
        <h1 className="text-headline-lg font-semibold">Tim</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Siapa memegang apa, dan seberapa padat. Diurutkan dari yang proyek aktifnya
          paling banyak, supaya penumpukan langsung kelihatan.
        </p>
      </header>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Anggota" value={members.length} hint="Seluruh divisi" />
        <StatCard label="Proyek Aktif" value={aktif} hint="Dipegang seluruh tim" accent="text-accent" />
        <StatCard
          label="Nilai Ditangani"
          value={formatCurrencyShort(nilai)}
          hint="Total proyek aktif"
        />
        <StatCard
          label="Lewat Tenggat"
          value={telat}
          hint={kosong > 0 ? `${kosong} anggota belum ada proyek` : "Seluruh anggota terpakai"}
          accent="text-high"
          danger={telat > 0}
        />
      </div>

      <section aria-labelledby="daftar-anggota" className="mt-8">
        <h2 id="daftar-anggota" className="text-headline-sm font-semibold">
          Beban Kerja Anggota
        </h2>
        <div className="mt-4">
          <TeamList members={members} />
        </div>
      </section>
    </div>
  );
}
