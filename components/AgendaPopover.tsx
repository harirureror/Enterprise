"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

/* Popover yang menempel pada apa yang diklik.

   Dipakai papan agenda untuk rincian agenda dan untuk mengisi slot kosong.
   Posisinya dihitung dari kotak jangkar lalu dijepit ke tepi layar — popover
   yang separuh keluar layar sama saja dengan tidak muncul. */

const LEBAR = 340;
const JARAK = 8;

export type Jangkar = { top: number; left: number; width: number; height: number };

export default function AgendaPopover({
  jangkar,
  judul,
  onTutup,
  children,
}: {
  /** Kotak elemen yang diklik, dalam koordinat viewport. */
  jangkar: Jangkar;
  judul: string;
  onTutup: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [posisi, setPosisi] = useState<{ top: number; left: number } | null>(null);

  // Diukur setelah render karena tingginya bergantung isi: form isi jauh lebih
  // tinggi daripada rincian, dan keduanya memakai popover yang sama.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const tinggi = el.offsetHeight;
    const layarW = window.innerWidth;
    const layarH = window.innerHeight;

    let left = jangkar.left;
    // Meluber ke kanan: geser masuk, bukan dibiarkan terpotong.
    if (left + LEBAR + JARAK > layarW) left = layarW - LEBAR - JARAK;
    if (left < JARAK) left = JARAK;

    // Di bawah jangkar kalau muat; kalau tidak, di atasnya.
    let top = jangkar.top + jangkar.height + JARAK;
    if (top + tinggi + JARAK > layarH) {
      const atas = jangkar.top - tinggi - JARAK;
      top = atas >= JARAK ? atas : Math.max(JARAK, layarH - tinggi - JARAK);
    }

    setPosisi({ top, left });
  }, [jangkar, children]);

  useEffect(() => {
    function tombol(e: KeyboardEvent) {
      if (e.key === "Escape") onTutup();
    }
    window.addEventListener("keydown", tombol);
    return () => window.removeEventListener("keydown", tombol);
  }, [onTutup]);

  return (
    <>
      {/* Lapisan penangkap klik di luar. Tidak digelapkan: popover menempel
          pada tanggalnya, dan tanggal itu harus tetap terlihat. */}
      <div
        className="fixed inset-0 z-40"
        onPointerDown={onTutup}
        aria-hidden
      />
      <div
        ref={ref}
        role="dialog"
        aria-label={judul}
        className="fixed z-50 rounded-xl border border-border bg-surface shadow-card"
        style={{
          width: LEBAR,
          top: posisi?.top ?? jangkar.top,
          left: posisi?.left ?? jangkar.left,
          // Sebelum terukur, popover disembunyikan supaya tidak terlihat
          // melompat dari posisi tebakan ke posisi sebenarnya.
          visibility: posisi ? "visible" : "hidden",
        }}
      >
        <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-2.5">
          <h2 className="text-sm font-semibold">{judul}</h2>
          <button
            type="button"
            onClick={onTutup}
            aria-label="Tutup"
            className="-mr-1 rounded px-1.5 text-muted hover:text-foreground"
          >
            ✕
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-4 py-3">{children}</div>
      </div>
    </>
  );
}
