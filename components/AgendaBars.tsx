"use client";

import { useEffect, useRef, useState } from "react";
import {
  type AgendaBarRow,
  type LaidOutBar,
  type RentangAgenda,
  type SisiBar,
  type TickAgenda,
  barSpan,
  clampResize,
} from "@/lib/agenda";
import { canEditAgenda } from "@/lib/permissions";
import { fromDay, toDay } from "@/lib/timeline";
import type { AgendaView } from "@/lib/api";
import { type AgendaKind, type User } from "@/lib/types";
import { formatDate } from "@/lib/ui";

/* Papan Tim: satu baris per anggota, sepekan.

   Menjawab "siapa sedang di mana" — pertanyaan yang petak kalender justru
   menyulitkan, karena di sana barisnya tanggal, bukan orang. Sengaja mingguan
   saja: hanya di rentang sependek itu bar per orang masih lega terbaca.

   Agenda yang proyek dan jenisnya sama serta tanggalnya bersambung digambar
   sebagai SATU bar. Penggabungan, kepala kolom, dan posisi bar dihitung
   lib/agenda.ts; berkas ini menggambar dan menangani seretan.

   Seretan memakai Pointer Events, bukan HTML5 drag-and-drop: satu API untuk
   tetikus, pena, dan sentuh, dan hanya itu yang bisa dipakai untuk gagang
   ubah-durasi. */

const kindClass: Record<AgendaKind, string> = {
  Lapangan: "bg-accent/15 text-accent ring-1 ring-accent/30",
  Kantor: "bg-stage/15 text-stage ring-1 ring-stage/30",
  Perjalanan: "bg-med/15 text-med ring-1 ring-med/30",
  Cuti: "text-muted ring-1 ring-border bg-surface",
};

/** Tinggi satu jalur, termasuk jarak antar bar. */
const TINGGI_JALUR = 38;

export type Bar = LaidOutBar<AgendaView>;
export type Kotak = { top: number; left: number; width: number; height: number };

const keKotak = (el: Element): Kotak => {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
};
export type ViewerRingkas = { id: number; accessLevel: User["accessLevel"] };

type Seret = {
  barKey: string;
  mode: "geser" | SisiBar;
  pointerId: number;
  /** Posisi X saat seretan dimulai. */
  x0: number;
  /** Lebar satu hari dalam piksel, diukur saat seretan dimulai. */
  lebarHari: number;
  barisAsal: number;
  dxHari: number;
  barisTujuan: number;
};

export default function AgendaBars({
  rows,
  rentang,
  ticks,
  viewer,
  idBentrok,
  terpilih,
  pending,
  onBuka,
  onToggle,
  onGeser,
  onUbahRentang,
  onIsi,
}: {
  rows: AgendaBarRow<AgendaView>[];
  rentang: RentangAgenda;
  ticks: TickAgenda[];
  viewer: ViewerRingkas;
  /** Id entri yang bentrok dengan agenda lain milik orang yang sama. */
  idBentrok: Set<number>;
  /** Id entri yang sedang dicentang. */
  terpilih: Set<number>;
  pending: boolean;
  onBuka: (bar: Bar, kotak: Kotak) => void;
  onToggle: (bar: Bar) => void;
  onGeser: (bar: Bar, deltaHari: number, userIdBaru: number | null) => void;
  onUbahRentang: (bar: Bar, sisi: SisiBar, deltaHari: number) => void;
  onIsi: (userId: number, kotak: Kotak) => void;
}) {
  const jalurRefs = useRef<(HTMLDivElement | null)[]>([]);
  const rafRef = useRef<number | null>(null);
  const [seret, setSeret] = useState<Seret | null>(null);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const tinggiJalur = TINGGI_JALUR;

  const bolehUbah = (bar: Bar) => bar.entries.every((e) => canEditAgenda(viewer, e));
  const bolehBaris = (i: number) => canEditAgenda(viewer, { userId: rows[i].user.id });

  /** Baris mana yang sedang ditunjuk pointer; baris terlarang diabaikan. */
  function barisDi(clientY: number, asal: number): number {
    for (let i = 0; i < rows.length; i++) {
      const el = jalurRefs.current[i];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (clientY >= r.top && clientY <= r.bottom) {
        // Bar tidak mengikuti ke baris yang tidak boleh disunting — umpan balik
        // yang jujur, dan server akan menolaknya juga.
        return bolehBaris(i) ? i : asal;
      }
    }
    return asal;
  }

  function mulaiSeret(e: React.PointerEvent, bar: Bar, barisAsal: number, mode: Seret["mode"]) {
    if (pending || !bolehUbah(bar)) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;

    const jalur = jalurRefs.current[barisAsal];
    if (!jalur) return;

    const lebar = jalur.getBoundingClientRect().width / rentang.totalDays;
    if (lebar <= 0) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
    setSeret({
      barKey: bar.key,
      mode,
      pointerId: e.pointerId,
      x0: e.clientX,
      lebarHari: lebar,
      barisAsal,
      dxHari: 0,
      barisTujuan: barisAsal,
    });
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
        const dxHari = Math.round((clientX - s.x0) / s.lebarHari);
        const barisTujuan = s.mode === "geser" ? barisDi(clientY, s.barisAsal) : s.barisAsal;
        return dxHari === s.dxHari && barisTujuan === s.barisTujuan
          ? s
          : { ...s, dxHari, barisTujuan };
      });
    });
  }

  function lepas(e: React.PointerEvent, bar: Bar) {
    if (!seret || e.pointerId !== seret.pointerId) return;
    const s = seret;
    setSeret(null);

    if (s.mode !== "geser") {
      const geserBersih = clampResize(bar, s.mode, s.dxHari);
      if (geserBersih !== 0) onUbahRentang(bar, s.mode, geserBersih);
      return;
    }

    const pindah = s.barisTujuan !== s.barisAsal;
    // Seretan yang tidak berpindah ke mana-mana itu klik biasa.
    if (s.dxHari === 0 && !pindah) {
      onBuka(bar, keKotak(e.currentTarget as Element));
      return;
    }
    onGeser(bar, s.dxHari, pindah ? rows[s.barisTujuan].user.id : null);
  }

  function batal() {
    setSeret(null);
  }

  function tombol(e: React.KeyboardEvent, bar: Bar, barisAsal: number) {
    if (pending) return;

    if (e.key === "Enter") {
      e.preventDefault();
      onBuka(bar, keKotak(e.currentTarget as Element));
      return;
    }
    if (!bolehUbah(bar)) return;

    if (e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      onToggle(bar);
      return;
    }

    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const arah = e.key === "ArrowLeft" ? -1 : 1;
      if (e.shiftKey) onUbahRentang(bar, "kanan", clampResize(bar, "kanan", arah));
      else onGeser(bar, arah, null);
      return;
    }
    if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      const arah = e.key === "ArrowUp" ? -1 : 1;
      for (let i = barisAsal + arah; i >= 0 && i < rows.length; i += arah) {
        if (bolehBaris(i)) {
          onGeser(bar, 0, rows[i].user.id);
          return;
        }
      }
    }
  }

  /** Tanggal bar saat sedang diseret; di luar seretan, tanggal aslinya. */
  function rentangBar(bar: Bar): { startDate: string; endDate: string } {
    if (!seret || seret.barKey !== bar.key) return bar;

    if (seret.mode === "geser") {
      return {
        startDate: fromDay(toDay(bar.startDate) + seret.dxHari),
        endDate: fromDay(toDay(bar.endDate) + seret.dxHari),
      };
    }
    const geserBersih = clampResize(bar, seret.mode, seret.dxHari);
    return {
      startDate:
        seret.mode === "kiri" ? fromDay(toDay(bar.startDate) + geserBersih) : bar.startDate,
      endDate: seret.mode === "kanan" ? fromDay(toDay(bar.endDate) + geserBersih) : bar.endDate,
    };
  }

  /** Bar yang tampil di satu baris, termasuk bar yang sedang diseret ke sini. */
  function barBaris(i: number): Bar[] {
    const asli = rows[i].bars.filter((b) => !(seret?.barKey === b.key && seret.barisTujuan !== i));
    if (!seret || seret.barisTujuan !== i || seret.barisAsal === i) return asli;

    const datang = rows[seret.barisAsal]?.bars.find((b) => b.key === seret.barKey);
    return datang ? [...asli, datang] : asli;
  }

  function uraianBar(bar: Bar, namaOrang: string): string {
    const judul = bar.entries[0].project?.name ?? "";
    return `${namaOrang}, ${bar.kind}${judul ? `, ${judul}` : ""}, ${formatDate(
      bar.startDate
    )} sampai ${formatDate(bar.endDate)}, ${bar.entries.length} agenda`;
  }

  return (
    <div className="mt-4 hidden overflow-x-auto rounded-xl border border-border bg-surface shadow-card md:block">
      <table className="w-full min-w-[56rem] table-fixed text-sm">
        <caption className="sr-only">
          Agenda tim {rentang.start} sampai {rentang.end}. Agenda dengan proyek dan jenis
          yang sama serta tanggal bersambung digabung jadi satu bar.
        </caption>
        <thead>
          <tr className="border-b border-border text-left text-label-caps text-muted">
            <th scope="col" className="w-44 px-4 py-3 font-medium">
              Anggota
            </th>
            {/* Satu sel kepala yang memuat seluruh penanda kolom: jumlah tick
                berubah menurut rentang, jadi kolom tetap tidak lagi cocok. */}
            <th scope="col" className="px-0 py-3 font-medium">
              <div className="relative mx-2 h-4">
                {ticks.map((t) => (
                  <span
                    key={t.key}
                    className="absolute top-0 whitespace-nowrap"
                    style={{ left: `${t.leftPct}%` }}
                  >
                    {t.label}
                  </span>
                ))}
              </div>
            </th>
            <th scope="col" className="w-24 px-4 py-3">
              <span className="sr-only">Aksi</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((baris, i) => (
            <tr key={baris.user.id} className="border-b border-border last:border-0">
              <th scope="row" className="px-4 py-3 align-top text-left font-medium">
                <span className="block">{baris.user.name}</span>
                <span className="block text-xs font-normal text-muted">
                  {baris.total === 0 ? "Tidak ada agenda" : `${baris.total} agenda`}
                </span>
              </th>

              <td className="px-0 py-2 align-top">
                <div
                  ref={(el) => {
                    jalurRefs.current[i] = el;
                  }}
                  className={`relative mx-2 rounded ${
                    seret?.barisTujuan === i && seret.barisAsal !== i ? "bg-accent/5" : ""
                  }`}
                  style={{ height: baris.laneCount * tinggiJalur }}
                >
                  {/* Garis pemisah sejajar kepala kolom, sekadar penuntun mata. */}
                  {ticks.slice(1).map((t) => (
                    <span
                      key={t.key}
                      aria-hidden
                      className="absolute top-0 bottom-0 w-px bg-border/50"
                      style={{ left: `${t.leftPct}%` }}
                    />
                  ))}

                  {barBaris(i).map((bar) => {
                    const lihat = rentangBar(bar);
                    const span = barSpan(lihat, rentang);
                    const boleh = bolehUbah(bar);
                    const diseret = seret?.barKey === bar.key;
                    const tamu = diseret && seret.barisAsal !== i;
                    const dipilih = bar.entries.every((e) => terpilih.has(e.id));
                    const bentrok = bar.entries.some((e) => idBentrok.has(e.id));
                    const uraian = uraianBar(bar, baris.user.name);
                    const atas = (tamu ? 0 : bar.lane) * tinggiJalur;

                    return (
                      <div
                        key={bar.key}
                        role="button"
                        tabIndex={0}
                        aria-label={uraian}
                        aria-pressed={dipilih}
                        onPointerDown={(e) => mulaiSeret(e, bar, i, "geser")}
                        onPointerMove={gerak}
                        onPointerUp={(e) => lepas(e, bar)}
                        onPointerCancel={batal}
                        onKeyDown={(e) => tombol(e, bar, i)}
                        className={`absolute flex items-center gap-1.5 overflow-hidden px-2 text-xs transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                          kindClass[bar.kind]
                        } ${span.terpotongKiri ? "rounded-l-none" : "rounded-l"} ${
                          span.terpotongKanan ? "rounded-r-none" : "rounded-r"
                        } ${bentrok ? "ring-2 ring-high/60" : ""} ${
                          dipilih ? "ring-2 ring-accent" : ""
                        } ${
                          diseret
                            ? "z-20 scale-[1.02] opacity-95 shadow-card transition-[left,width] duration-75 ease-out"
                            : "z-10 transition-[left,width,top] duration-200 ease-out"
                        } ${
                          boleh ? "cursor-grab active:cursor-grabbing" : "cursor-default"
                        }`}
                        style={{
                          left: `${span.leftPct}%`,
                          width: `${span.widthPct}%`,
                          top: atas,
                          height: tinggiJalur - 6,
                          touchAction: "none",
                        }}
                      >
                        {span.terpotongKiri && (
                          <span aria-hidden className="shrink-0 opacity-70">
                            ‹
                          </span>
                        )}

                        {boleh && (
                          <input
                            type="checkbox"
                            checked={dipilih}
                            disabled={pending}
                            aria-label={`Pilih ${uraian}`}
                            // Jangan sampai mencentang malah memulai seretan.
                            onPointerDown={(e) => e.stopPropagation()}
                            onChange={() => onToggle(bar)}
                            className="h-3.5 w-3.5 shrink-0 accent-accent"
                          />
                        )}

                        <span className="min-w-0 flex-1 leading-tight">
                          <span className="block truncate font-medium">
                            {bar.kind}
                            {bar.entries[0].project?.name
                              ? ` · ${bar.entries[0].project.name}`
                              : ""}
                          </span>
                          <span className="block truncate opacity-80">
                            {[
                              bar.entries[0].locationCity,
                              bar.entries.length > 1 ? `${bar.entries.length} agenda` : "",
                              bar.bertumpuk ? "bertumpuk" : "",
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </span>

                        {span.terpotongKanan && (
                          <span aria-hidden className="shrink-0 opacity-70">
                            ›
                          </span>
                        )}

                        {/* Gagang ubah-durasi. Disembunyikan di sisi yang terpotong:
                            tepi yang terlihat di sana adalah batas rentang, bukan
                            ujung agendanya, jadi menyeretnya akan menyesatkan. */}
                        {boleh && !span.terpotongKiri && (
                          <span
                            aria-hidden
                            onPointerDown={(e) => mulaiSeret(e, bar, i, "kiri")}
                            onPointerMove={gerak}
                            onPointerUp={(e) => lepas(e, bar)}
                            onPointerCancel={batal}
                            className="absolute top-0 bottom-0 left-0 w-2 cursor-ew-resize"
                          />
                        )}
                        {boleh && !span.terpotongKanan && (
                          <span
                            aria-hidden
                            onPointerDown={(e) => mulaiSeret(e, bar, i, "kanan")}
                            onPointerMove={gerak}
                            onPointerUp={(e) => lepas(e, bar)}
                            onPointerCancel={batal}
                            className="absolute top-0 right-0 bottom-0 w-2 cursor-ew-resize"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </td>

              <td className="px-4 py-2 text-right align-top">
                {bolehBaris(i) && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={(e) => onIsi(baris.user.id, keKotak(e.currentTarget))}
                    className="rounded-lg border border-border px-2.5 py-1 text-sm text-muted hover:bg-background"
                  >
                    + Isi<span className="sr-only"> agenda {baris.user.name}</span>
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
