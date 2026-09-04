import AgendaBoard from "@/components/AgendaBoard";
import ExportMenu from "@/components/ExportMenu";
import { getAgenda, getProjects, getUsers } from "@/lib/api";
import { requireAbility } from "@/lib/auth";
import { agendaClashes, weekRange } from "@/lib/agenda";
import { can } from "@/lib/permissions";
import { isActiveStatus } from "@/lib/types";

// Agenda berubah tiap orang mengisinya, jadi jangan dicache.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Agenda Tim — Divisi Enterprise JSI",
  description: "Siapa sedang di mana pekan ini: lapangan, kantor, perjalanan, atau cuti.",
};

export default async function AgendaPage() {
  const pengguna = await requireAbility("lihat-agenda");

  const [agenda, users, projects] = await Promise.all([
    getAgenda(),
    getUsers({ activeOnly: true }),
    getProjects(),
  ]);

  // Tanggal acuan dari server: kalau pekan awalnya dihitung di klien, dua orang
  // di zona waktu berbeda bisa melihat pekan yang berbeda.
  const hariIni = new Date().toISOString().slice(0, 10);
  const pekan = weekRange(hariIni);
  const sepekan = agenda.filter((a) => a.startDate <= pekan.end && a.endDate >= pekan.start);
  const bentrok = agendaClashes(agenda);

  const diLapangan = sepekan.filter((a) => a.kind === "Lapangan").length;
  const cuti = sepekan.filter((a) => a.kind === "Cuti").length;

  return (
    <div className="w-full">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-headline-lg font-semibold">Agenda Tim</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Siapa sedang di mana. Pekan ini {sepekan.length} agenda tercatat — {diLapangan} di
            lapangan, {cuti} cuti
            {bentrok.length > 0 && `, dan ${bentrok.length} agenda saling bertumpuk`}.
          </p>
        </div>
        {can(pengguna.accessLevel, "ekspor") && (
          <ExportMenu scope="mingguan" ids={[]} label="Laporan mingguan" />
        )}
      </header>

      <div className="mt-6">
        <AgendaBoard
          entries={agenda}
          users={users}
          projects={projects.filter((p) => isActiveStatus(p.status))}
          viewer={{ id: pengguna.id, accessLevel: pengguna.accessLevel }}
          today={hariIni}
        />
      </div>
    </div>
  );
}
