import PlanTabs from "@/components/PlanTabs";
import { requireAbility } from "@/lib/auth";
import { can } from "@/lib/permissions";

/**
 * Kerangka tab "Rencana & Agenda".
 *
 * Dua hal yang dulu berdiri sendiri kini satu tempat: arah yang dituju divisi,
 * dan siapa sedang di mana untuk menjalankannya. Datanya tetap terpisah karena
 * pertanyaannya memang berbeda — yang disatukan pintu masuknya.
 *
 * Penjaga di sini hanya memastikan orangnya boleh membuka salah satu tab;
 * tiap halaman tetap punya penjaganya sendiri.
 */
export default async function RencanaLayout({ children }: { children: React.ReactNode }) {
  const pengguna = await requireAbility("lihat-rencana");

  return (
    <div className="w-full">
      <PlanTabs
        bolehRencana={can(pengguna.accessLevel, "lihat-rencana")}
        bolehAgenda={can(pengguna.accessLevel, "lihat-agenda")}
      />
      <div className="mt-6">{children}</div>
    </div>
  );
}
