import TimelineChart from "@/components/TimelineChart";
import { getTimeline } from "@/lib/api";

export const metadata = {
  title: "Timeline Proyek — Divisi Enterprise JSI",
  description: "Peta jadwal proyek untuk melihat tumpang tindih dan alokasi tim lapangan.",
};

export default async function TimelinePage() {
  // Sumber data sama dengan GET /api/projects/timeline, tanpa lompat HTTP dari server.
  const { projects, overlapPairs } = await getTimeline();

  return (
    <div className="w-full">
      <header>
        <h1 className="text-headline-lg font-semibold">Timeline Proyek</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Bar dibaca dari tanggal mulai sampai tenggat. Proyek prioritas tinggi ada di urutan atas.
          {overlapPairs > 0 && ` Ada ${overlapPairs} pasang jadwal yang tumpang tindih.`}
        </p>
      </header>

      <div className="mt-6">
        <TimelineChart projects={projects} />
      </div>
    </div>
  );
}
