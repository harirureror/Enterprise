import Link from "next/link";
import { notFound } from "next/navigation";
import PlanForm from "@/components/PlanForm";
import { getPlan, getUsers } from "@/lib/api";
import { requireAbility } from "@/lib/auth";
import { planToDraft } from "@/lib/plan-form";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params) {
  const plan = await getPlan(Number((await params).id));
  return { title: plan ? `Ubah ${plan.title} — Rencana Strategis` : "Rencana tidak ditemukan" };
}

export default async function UbahRencanaPage({ params }: Params) {
  await requireAbility("kelola-rencana");

  const { id } = await params;
  // Id non-angka ("abc") ikut jatuh ke notFound lewat NaN.
  const plan = await getPlan(Number(id));
  if (!plan) notFound();

  // Termasuk yang nonaktif: PIC yang sudah tidak aktif tetap harus muncul,
  // kalau tidak menyimpan perubahan kecil akan diam-diam mengganti PIC-nya.
  const anggota = await getUsers();

  return (
    <div className="w-full">
      <header>
        <Link href={`/rencana/${plan.id}`} className="text-sm text-muted hover:text-foreground">
          ← Kembali ke {plan.title}
        </Link>
        <h1 className="mt-2 text-headline-lg font-semibold">Ubah Rencana</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Langkah dan calon klien diubah dari halaman rencananya, bukan dari sini.
        </p>
      </header>

      <div className="mt-6">
        <PlanForm awal={planToDraft(plan)} owners={anggota} planId={plan.id} />
      </div>
    </div>
  );
}
