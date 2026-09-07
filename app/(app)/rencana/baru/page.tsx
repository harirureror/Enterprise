import Link from "next/link";
import PlanForm from "@/components/PlanForm";
import { getUsers } from "@/lib/api";
import { requireAbility } from "@/lib/auth";
import { emptyPlanDraft } from "@/lib/plan-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Rencana Baru — Divisi Enterprise JSI",
  description: "Menyusun rencana strategis beserta tujuan dan sasaran pasarnya.",
};

export default async function RencanaBaruPage() {
  const pengguna = await requireAbility("kelola-rencana");
  const anggota = await getUsers({ activeOnly: true });

  return (
    <div className="w-full">
      <header>
        <Link href="/rencana" className="text-sm text-muted hover:text-foreground">
          ← Kembali ke daftar rencana
        </Link>
        <h1 className="mt-2 text-headline-lg font-semibold">Rencana Baru</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Tanggal boleh dikosongkan — sebuah ide belum tentu sudah berjadwal. Langkah,
          calon klien, dan proyek yang lahir darinya ditambahkan sesudah rencana tersimpan.
        </p>
      </header>

      <div className="mt-6">
        {/* PIC awal diisi penyusunnya sendiri: itu tebakan yang paling sering benar,
            dan tetap bisa diganti. */}
        <PlanForm awal={emptyPlanDraft(pengguna.id)} owners={anggota} />
      </div>
    </div>
  );
}
