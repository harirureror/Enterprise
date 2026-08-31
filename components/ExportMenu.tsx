"use client";

import { useState } from "react";
import { type ExportFormat, type ExportScope, exportProjects } from "@/lib/export-actions";

/* Tombol ekspor: Excel, Word, PDF.

   Berkasnya dibuat di server lewat server action, bukan route handler — sama
   alasannya dengan lib/actions.ts. Yang dikirim ke sana hanya id proyek yang
   sedang tampil, jadi hasil ekspornya mengikuti filter di layar, sementara
   angkanya tetap dibaca ulang dari sumber data. */

const LABEL: Record<ExportFormat, string> = {
  excel: "Excel (.xlsx)",
  word: "Word (.docx)",
  pdf: "PDF (.pdf)",
};

const FORMATS: ExportFormat[] = ["excel", "word", "pdf"];

/** base64 → Blob. Server action hanya bisa mengembalikan data yang bisa diserialisasi. */
function keBlob(base64: string, mime: string): Blob {
  const biner = atob(base64);
  const byte = new Uint8Array(biner.length);
  for (let i = 0; i < biner.length; i++) byte[i] = biner.charCodeAt(i);
  return new Blob([byte], { type: mime });
}

function unduh(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Dilepas setelah klik sempat diproses; kalau langsung dicabut, sebagian
  // peramban membatalkan unduhannya.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export default function ExportMenu({
  scope,
  ids,
  label = "Ekspor",
}: {
  scope: ExportScope;
  /** Id proyek yang sedang tampil, urut sesuai layar. Kosong = semua proyek. */
  ids: number[];
  label?: string;
}) {
  const [sibuk, setSibuk] = useState<ExportFormat | null>(null);
  const [gagal, setGagal] = useState<string | null>(null);

  async function jalankan(format: ExportFormat) {
    if (sibuk) return;
    setSibuk(format);
    setGagal(null);

    try {
      const hasil = await exportProjects(scope, format, ids);
      if (!hasil.ok) {
        setGagal(hasil.error);
        return;
      }
      unduh(keBlob(hasil.base64, hasil.mime), hasil.filename);
    } catch {
      // Jaringan putus atau server action ditolak: jangan biarkan tombolnya
      // membeku tanpa penjelasan.
      setGagal("Tidak bisa menghubungi server. Coba lagi.");
    } finally {
      setSibuk(null);
    }
  }

  return (
    <div>
      <details className="relative">
        <summary className="cursor-pointer list-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-muted marker:content-none hover:bg-background">
          {sibuk ? "Menyiapkan…" : label}
        </summary>

        <div className="absolute right-0 z-10 mt-1 w-52 rounded-lg border border-border bg-surface p-1.5 shadow-card">
          <p className="px-2 pb-1 text-xs text-muted">
            {ids.length > 0 ? `${ids.length} proyek terpilih` : "Seluruh proyek"}
          </p>
          {FORMATS.map((f) => (
            <button
              key={f}
              type="button"
              disabled={sibuk !== null}
              onClick={() => jalankan(f)}
              className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-background disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sibuk === f ? "Menyiapkan…" : LABEL[f]}
            </button>
          ))}
        </div>
      </details>

      {gagal && (
        <p role="alert" className="mt-1 text-xs text-high">
          {gagal}
        </p>
      )}
    </div>
  );
}
