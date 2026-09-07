"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  type LaidOutBar,
  type RentangAgenda,
  type SisiBar,
  assignLanes,
  barSpan,
  clampResize,
  coversDay,
  diLuarRentang,
  mergeBars,
  modeTampilan,
  monthsOf,
  weekRowsOf,
} from "@/lib/agenda";
import { canEditAgenda } from "@/lib/permissions";
import { fromDay, toDay } from "@/lib/timeline";
import type { AgendaView } from "@/lib/api";
import type { AgendaKind, User } from "@/lib/types";
import { formatDate } from "@/lib/ui";

/* Petak kalender.

   Baris = pekan, kolom = tujuh hari. Tiap baris pekan itu sendiri sebuah
   RentangAgenda tujuh hari, jadi barSpan() yang sudah ada langsung menempatkan
   chip di dalamnya — agenda yang melewati batas pekan otomatis terpotong jadi
   dua segmen bersambung, seperti kalender pada umumnya.

   Rentang panjang (di atas ~4 bulan) berganti ke petak bulan kecil bertitik:
   lima puluh tiga baris pekan tidak bisa dibaca sebagai satu tampilan. */

const chipClass: Record<AgendaKind, string> = {
  Lapangan: "bg-accent/20 text-accent ring-1 ring-accent/40",
  Kantor: "bg-stage/20 text-stage ring-1 ring-stage/40",
  Perjalanan: "bg-med/20 text-med ring-1 ring-med/40",
  Cuti: "bg-surface text-muted ring-1 ring-border",
};

const dotClass: Record<AgendaKind, string> = {
  Lapangan: "bg-accent",
  Kantor: "bg-stage",
  Perjalanan: "bg-med",
  Cuti: "bg-muted",
};

const NAMA_HARI = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

const TINGGI_CHIP = 22;
/** Jalur di atas ini disembunyikan jadi "+N lainnya", meniru kalender umum. */
const MAKS_JALUR = 3;

export type Bar = LaidOutBar<AgendaView>;
export type Kotak = { top: number; left: number; width: number; height: number };
export type ViewerRingkas = { id: number; accessLevel: User["accessLevel"] };

type Seret = {
  barKey: string;
  mode: "geser" | SisiBar;
  pointerId: number;
  /** Hari yang berada di bawah pointer saat seretan dimulai. */
  hariAwal: number;
  /** Geseran dalam hari, dibulatkan ke sel yang sedang ditunjuk. */
  delta: number;
};

const keKotak = (el: Element): Kotak => {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
};

export default function AgendaCalendar({
  entries,
  rentang,
  viewer,
  terpilih,
  idBentrok,
  pending,
  onBar,
  onSlot,
  onGeser,
  onUbahRentang,
  onToggle,
}: {
  entries: AgendaView[];
  rentang: RentangAgenda;
  viewer: ViewerRingkas;
  terpilih: Set<number>;
  idBentrok: Set<number>;
  pending: boolean;
  onBar: (bar: Bar, kotak: Kotak) => void;
  onSlot: (tanggal: string, kotak: Kotak) => void;
  onGeser: (bar: Bar, deltaHari: number) => void;
  onUbahRentang: (bar: Bar, sisi: SisiBar, deltaHari: number) => void;
  onToggle: (bar: Bar) => void;
}) {
  const barisRefs = useRef<(HTMLDivElement | null)[]>([]);
  const rafRef = useRef<number | null>(null);
  const [seret, setSeret] = useState<Seret | null>(null);
  const [lihatSemua, setLihatSemua] = useState<Set<string>>(new Set());

  const titik = modeTampilan(rentang) === "titik";
  const semuaBar = useMemo(() => mergeBars(entries), [entries]);
  const barisPekan = useMemo(() => weekRowsOf(rentang), [rentang]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const bolehUbah = (bar: Bar) => bar.entries.every((e) => canEditAgenda(viewer, e));

  /** Bar yang menyentuh satu baris pekan, sudah dijatah jalur. */
  function barBaris(row: RentangAgenda): Bar[] {
    return assignLanes(
      semuaBar.filter((b) => b.startDate <= row.end && b.endDate >= row.start)
    );
  }

  /** Hari yang berada tepat di bawah pointer, dari baris mana pun. */
  function hariDi(clientX: number, clientY: number): number | null {
    for (let i = 0; i < barisPekan.length; i++) {
      const el = barisRefs.current[i];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (clientY < r.top || clientY > r.bottom) continue;

      const kolom = Math.min(
        6,
        Math.max(0, Math.floor(((clientX - r.left) / r.width) * 7))
      );
      return toDay(barisPekan[i].start) + kolom;
    }
    return null;
  }

  function mulaiSeret(e: React.PointerEvent, bar: Bar, mode: Seret["mode"]) {
    if (titik || pending || !bolehUbah(bar)) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;

    const hari = hariDi(e.clientX, e.clientY);
    if (hari === null) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
    e.stopPropagation();
    setSeret({ barKey: bar.key, mode, pointerId: e.pointerId, hariAwal: hari, delta: 0 });
  }

  function gerak(e: React.PointerEvent) {
    if (!seret || e.pointerId !== seret.pointerId) return;

    // pointermove datang jauh lebih rapat daripada laju gambar. Tanpa diredam
    // ke satu frame, tiap kejadian memicu render dan seretan justru tersendat.
    const { clientX, clientY } = e;
    if (rafRef.current !== null) return;

    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      setSeret((s) => {
        if (!s) return s;
        const hari = hariDi(clientX, clientY);
        if (hari === null) return s;
        const delta = hari - s.hariAwal;
        return delta === s.delta ? s : { ...s, delta };
      });
    });
  }

  function lepas(e: React.PointerEvent, bar: Bar) {
    if (!seret || e.pointerId !== seret.pointerId) return;
    const s = seret;
    setSeret(null);

    if (s.mode !== "geser") {
      const bersih = clampResize(bar, s.mode, s.delta);
      if (bersih !== 0) onUbahRentang(bar, s.mode, bersih);
      return;
    }
    if (s.delta === 0) {
      onBar(bar, keKotak(e.currentTarget as Element));
      return;
    }
    onGeser(bar, s.delta);
  }

  function tombolChip(e: React.KeyboardEvent, bar: Bar) {
    if (pending) return;
    if (e.key === "Enter") {
      e.preventDefault();
      onBar(bar, keKotak(e.currentTarget as Element));
      return;
    }
    if (!bolehUbah(bar)) return;
    if (e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      onToggle(bar);
      return;
    }
    if (titik) return;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const arah = e.key === "ArrowLeft" ? -1 : 1;
      if (e.shiftKey) onUbahRentang(bar, "kanan", clampResize(bar, "kanan", arah));
      else onGeser(bar, arah);
    }
  }

  /** Sel ini sedang jadi sasaran seretan? Dipakai menyorot tujuan. */
  function hariSasaran(s: Seret, tanggal: string): boolean {
    if (s.mode !== "geser" || s.delta === 0) return false;
    const bar = semuaBar.find((b) => b.key === s.barKey);
    if (!bar) return false;
    const mulai = toDay(bar.startDate) + s.delta;
    const selesai = toDay(bar.endDate) + s.delta;
    const hari = toDay(tanggal);
    return hari >= mulai && hari <= selesai;
  }

  /** Tanggal chip saat diseret; di luar seretan, tanggal aslinya. */
  function rentangBar(bar: Bar): { startDate: string; endDate: string } {
    if (!seret || seret.barKey !== bar.key || seret.delta === 0) return bar;

    if (seret.mode === "geser") {
      return {
        startDate: fromDay(toDay(bar.startDate) + seret.delta),
        endDate: fromDay(toDay(bar.endDate) + seret.delta),
      };
    }
    const bersih = clampResize(bar, seret.mode, seret.delta);
    return {
      startDate: seret.mode === "kiri" ? fromDay(toDay(bar.startDate) + bersih) : bar.startDate,
      endDate: seret.mode === "kanan" ? fromDay(toDay(bar.endDate) + bersih) : bar.endDate,
    };
  }

  function labelBar(bar: Bar): string {
    const orang = bar.entries[0].user?.name ?? "";
    const proyek = bar.entries[0].project?.name ?? "";
    return `${orang}${orang ? " · " : ""}${bar.kind}${proyek ? ` · ${proyek}` : ""}`;
  }

  function uraianBar(bar: Bar): string {
    return `${labelBar(bar)}, ${formatDate(bar.startDate)} sampai ${formatDate(
      bar.endDate
    )}, ${bar.entries.length} agenda`;
  }

  /* --- Tampilan tahunan: petak bulan kecil bertitik ------------------------- */

  if (titik) {
    return (
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {monthsOf(rentang).map((bulan) => (
          <section
            key={bulan.key}
            aria-label={bulan.label}
            className="rounded-xl border border-border bg-surface p-3 shadow-card"
          >
            <h3 className="mb-2 text-sm font-semibold">{bulan.label}</h3>
            <div className="grid grid-cols-7 text-center text-[10px] text-muted">
              {NAMA_HARI.map((h) => (
                <span key={h} className="py-1">
                  {h}
                </span>
              ))}
            </div>
            {weekRowsOf(bulan.rentang).map((row) => (
              <div key={row.start} className="grid grid-cols-7">
                {Array.from({ length: 7 }, (_, k) => {
                  const tanggal = fromDay(toDay(row.start) + k);
                  const luar = diLuarRentang(tanggal, bulan.rentang);
                  const hariIni = entries.filter((e) => coversDay(e, tanggal));
                  const jenis = [...new Set(hariIni.map((e) => e.kind))];

                  return (
                    <button
                      key={tanggal}
                      type="button"
                      disabled={luar}
                      onClick={(e) => onSlot(tanggal, keKotak(e.currentTarget))}
                      aria-label={`${tanggal}, ${hariIni.length} agenda`}
                      className={`flex h-9 flex-col items-center justify-center rounded transition-colors ${
                        luar ? "invisible" : "hover:bg-background"
                      }`}
                    >
                      <span className="text-[11px] tabular-nums leading-none">
                        {Number(tanggal.slice(8))}
                      </span>
                      <span className="mt-0.5 flex h-1.5 items-center gap-0.5">
                        {jenis.slice(0, 4).map((k) => (
                          <span
                            key={k}
                            className={`block h-1.5 w-1.5 rounded-full ${dotClass[k]}`}
                          />
                        ))}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </section>
        ))}
      </div>
    );
  }

  /* --- Tampilan petak pekan -------------------------------------------------- */

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-border bg-surface shadow-card">
      <div className="grid grid-cols-7 border-b border-border">
        {NAMA_HARI.map((h) => (
          <div key={h} className="px-2 py-2 text-label-caps text-muted">
            {h}
          </div>
        ))}
      </div>

      {barisPekan.map((row, ri) => {
        const bars = barBaris(row);
        const tampil = bars.filter((b) => b.lane < MAKS_JALUR || lihatSemua.has(row.start));
        const jalur = Math.max(...tampil.map((b) => b.lane + 1), 1);

        return (
          <div
            key={row.start}
            ref={(el) => {
              barisRefs.current[ri] = el;
            }}
            className="relative border-b border-border last:border-0"
          >
            <div className="grid grid-cols-7">
              {Array.from({ length: 7 }, (_, k) => {
                const tanggal = fromDay(toDay(row.start) + k);
                const luar = diLuarRentang(tanggal, rentang);
                const sasaran =
                  seret !== null && hariSasaran(seret, tanggal) ? "bg-accent/10" : "";
                const tersembunyi = lihatSemua.has(row.start)
                  ? 0
                  : bars.filter(
                      (b) => b.lane >= MAKS_JALUR && b.startDate <= tanggal && b.endDate >= tanggal
                    ).length;

                return (
                  <div
                    key={tanggal}
                    onClick={(e) => onSlot(tanggal, keKotak(e.currentTarget))}
                    className={`border-r border-border/60 px-1.5 pt-1.5 last:border-r-0 transition-colors ${
                      luar ? "bg-background/40" : "hover:bg-background/60"
                    } ${sasaran}`}
                    style={{ minHeight: 28 + jalur * TINGGI_CHIP + 20 }}
                  >
                    <span
                      className={`inline-block rounded px-1 text-xs tabular-nums ${
                        luar ? "text-muted/50" : "text-muted"
                      }`}
                    >
                      {Number(tanggal.slice(8))}
                    </span>
                    {tersembunyi > 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLihatSemua((s) => new Set(s).add(row.start));
                        }}
                        className="absolute bottom-1 text-[11px] text-muted underline hover:text-foreground"
                        style={{ left: `calc(${(k / 7) * 100}% + 0.5rem)` }}
                      >
                        +{tersembunyi} lainnya
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Lapisan chip. pointer-events dimatikan supaya klik menembus ke
                sel di bawahnya; hanya chipnya sendiri yang menangkap. */}
            <div className="pointer-events-none absolute inset-x-0" style={{ top: 26 }}>
              {tampil.map((bar) => {
                const span = barSpan(rentangBar(bar), row);
                if (span.widthPct <= 0) return null;

                const boleh = bolehUbah(bar);
                const diseret = seret?.barKey === bar.key;
                const dipilih = bar.entries.every((e) => terpilih.has(e.id));
                const bentrok = bar.entries.some((e) => idBentrok.has(e.id));

                return (
                  <div
                    key={bar.key}
                    role="button"
                    tabIndex={0}
                    aria-label={uraianBar(bar)}
                    aria-pressed={dipilih}
                    title={uraianBar(bar)}
                    onPointerDown={(e) => mulaiSeret(e, bar, "geser")}
                    onPointerMove={gerak}
                    onPointerUp={(e) => lepas(e, bar)}
                    onPointerCancel={() => setSeret(null)}
                    onKeyDown={(e) => tombolChip(e, bar)}
                    className={`pointer-events-auto absolute flex items-center gap-1 overflow-hidden px-1.5 text-xs leading-none focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                      chipClass[bar.kind]
                    } ${span.terpotongKiri ? "rounded-l-none" : "rounded-l"} ${
                      span.terpotongKanan ? "rounded-r-none" : "rounded-r"
                    } ${bentrok ? "ring-2 ring-high/60" : ""} ${
                      dipilih ? "ring-2 ring-accent" : ""
                    } ${
                      diseret
                        ? "z-30 scale-[1.02] opacity-95 shadow-card transition-[left,width] duration-75 ease-out"
                        : "z-10 transition-[left,width,top] duration-200 ease-out"
                    } ${boleh ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}`}
                    style={{
                      left: `calc(${span.leftPct}% + 2px)`,
                      width: `calc(${span.widthPct}% - 4px)`,
                      top: bar.lane * TINGGI_CHIP,
                      height: TINGGI_CHIP - 3,
                      touchAction: "none",
                      willChange: diseret ? "left, width" : undefined,
                    }}
                  >
                    {span.terpotongKiri && (
                      <span aria-hidden className="shrink-0 opacity-70">
                        ‹
                      </span>
                    )}
                    <span className="truncate">{labelBar(bar)}</span>
                    {bar.entries.length > 1 && (
                      <span className="shrink-0 opacity-70">·{bar.entries.length}</span>
                    )}
                    {span.terpotongKanan && (
                      <span aria-hidden className="ml-auto shrink-0 opacity-70">
                        ›
                      </span>
                    )}

                    {/* Gagang ubah-durasi; disembunyikan di sisi yang terpotong
                        karena tepi di sana adalah batas pekan, bukan ujung agenda. */}
                    {boleh && !span.terpotongKiri && (
                      <span
                        aria-hidden
                        onPointerDown={(e) => mulaiSeret(e, bar, "kiri")}
                        onPointerMove={gerak}
                        onPointerUp={(e) => lepas(e, bar)}
                        className="absolute top-0 bottom-0 left-0 w-1.5 cursor-ew-resize"
                      />
                    )}
                    {boleh && !span.terpotongKanan && (
                      <span
                        aria-hidden
                        onPointerDown={(e) => mulaiSeret(e, bar, "kanan")}
                        onPointerMove={gerak}
                        onPointerUp={(e) => lepas(e, bar)}
                        className="absolute top-0 right-0 bottom-0 w-1.5 cursor-ew-resize"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );

}
