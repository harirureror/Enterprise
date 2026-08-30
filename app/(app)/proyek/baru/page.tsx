import Link from "next/link";
import ProjectForm from "@/components/ProjectForm";
import { getFilterOptions } from "@/lib/api";

export const metadata = {
  title: "Tambah Proyek — Divisi Enterprise JSI",
  description: "Form pembuatan proyek baru beserta PIC, jadwal, dan prioritasnya.",
};

export default async function ProyekBaruPage() {
  const options = await getFilterOptions();

  return (
    <div className="w-full">
      <header>
        <Link href="/proyek" className="text-sm text-muted hover:text-foreground">
          ← Kembali ke daftar proyek
        </Link>
        <h1 className="mt-2 text-headline-lg font-semibold">Tambah Proyek</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Tanggal mulai dan tenggat wajib diisi karena dipakai timeline untuk mendeteksi
          tumpang tindih jadwal.
        </p>
      </header>

      <div className="mt-6">
        <ProjectForm options={options} />
      </div>
    </div>
  );
}
