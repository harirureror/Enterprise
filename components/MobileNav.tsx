"use client";

import { useEffect, useRef, useState } from "react";
import SidebarNav from "@/components/SidebarNav";
import type { Notification } from "@/lib/notifications";
import { readStateSnapshot, unreadCount } from "@/lib/notification-reads";
import { useSyncExternalStore } from "react";
import { serverReadState, subscribeReadState } from "@/lib/notification-reads";

/* Navigasi layar kecil sebagai laci geser.

   Sebelumnya menu ditaruh sebagai deretan yang digulir menyamping; dengan enam
   menu, sebagian selalu terpotong di luar layar dan tidak ada tandanya. Laci
   menampilkan semuanya sekaligus.

   Pakai <dialog> supaya fokus terkunci, Escape menutup, dan latar jadi inert
   tanpa library. Bedanya dengan modal biasa: `m-0 mr-auto` menempelkannya ke
   tepi kiri setinggi layar, bukan memusatkannya. */

export default function MobileNav({ notifications }: { notifications: Notification[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [terbuka, setTerbuka] = useState(false);

  const read = useSyncExternalStore(subscribeReadState, readStateSnapshot, serverReadState);
  const belumDibaca = read === null ? 0 : unreadCount(notifications, read);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (terbuka && !d.open) d.showModal();
    if (!terbuka && d.open) d.close();
  }, [terbuka]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setTerbuka(true)}
        aria-haspopup="dialog"
        aria-expanded={terbuka}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted ring-1 ring-border transition-colors hover:bg-background"
      >
        <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5 fill-current">
          <path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z" />
        </svg>
        <span className="sr-only">Buka menu navigasi</span>
        {belumDibaca > 0 && (
          // Lencana ikut ke tombol: menunya tertutup, jadi angkanya tidak
          // terlihat kalau hanya ada di dalam laci.
          <span
            aria-hidden
            className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-high px-1 text-[10px] font-semibold text-on-brand tabular-nums"
          >
            {belumDibaca}
          </span>
        )}
      </button>

      <dialog
        ref={dialogRef}
        onClose={() => setTerbuka(false)}
        aria-label="Navigasi utama"
        className="m-0 mr-auto h-dvh max-h-none w-[min(18rem,85vw)] max-w-none border-r border-border bg-surface p-0 text-foreground backdrop:bg-foreground/40 backdrop:backdrop-blur-sm"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-mark text-lg font-bold text-on-mark">
                DE
              </span>
              <div className="min-w-0">
                <p className="truncate text-headline-sm font-bold">Divisi Enterprise</p>
                <p className="truncate text-xs text-muted">Jaya Survei Indonesia</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setTerbuka(false)}
              aria-label="Tutup menu"
              className="shrink-0 rounded-lg border border-border px-2 py-1 text-sm text-muted hover:bg-background"
            >
              Tutup
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-3">
            {/* Menutup laci setelah pindah halaman; kalau tidak, laci menutupi
                halaman yang baru saja dibuka. */}
            <SidebarNav notifications={notifications} onNavigate={() => setTerbuka(false)} />
          </div>
        </div>
      </dialog>
    </div>
  );
}
