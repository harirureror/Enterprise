import Link from "next/link";
import CoverageSummary from "@/components/CoverageSummary";
import ExportMenu from "@/components/ExportMenu";
import PlanBoard from "@/components/PlanBoard";
import { getCoverage, getPlans, getUsers } from "@/lib/api";
import { requireAbility } from "@/lib/auth";
import { can } from "@/lib/permissions";

// Rencana berubah tiap langkah dicentang, jadi jangan dicache.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Rencana Strategis — Divisi Enterprise JSI",
  description:
    "Ke mana divisi menuju dan pasar mana yang didekati: pelatihan, riset, kemitraan, dan jangkauan wilayah.",
};

export default async function RencanaPage() {
  const pengguna = await requireAbility("lihat-rencana");

  const [plans, users, jangkauan] = await Promise.all([
    getPlans(),
    getUsers({ activeOnly: true }),
    getCoverage(),
  ]);

  const aktif = plans.filter((p) => p.status === "Berjalan").length;
  const perlu = plans.filter((p) => p.perluPerhatian).length;

  return (
    <div className="w-full">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-headline-lg font-semibold">Rencana Strategis</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Ke mana divisi menuju, dan pasar mana yang akan didekati. {plans.length} rencana
            tercatat — {aktif} sedang berjalan
            {perlu > 0 && `, ${perlu} perlu perhatian`}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {can(pengguna.accessLevel, "ekspor") && (
            <ExportMenu scope="rencana" ids={[]} label="Ekspor rencana" />
          )}
          {can(pengguna.accessLevel, "kelola-rencana") && (
            <Link
              href="/rencana/baru"
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-on-brand transition-opacity hover:opacity-90"
            >
              Rencana Baru
            </Link>
          )}
        </div>
      </header>

      <div className="mt-6">
        <CoverageSummary rows={jangkauan} />
      </div>

      <div className="mt-6">
        {plans.length === 0 ? (
          <p className="rounded-xl border border-border bg-surface p-5 text-sm text-muted shadow-card">
            Belum ada rencana strategis.
            {can(pengguna.accessLevel, "kelola-rencana")
              ? " Mulai dengan menekan “Rencana Baru”."
              : " Admin atau Manager yang menyusunnya."}
          </p>
        ) : (
          <PlanBoard plans={plans} owners={users} />
        )}
      </div>
    </div>
  );
}
