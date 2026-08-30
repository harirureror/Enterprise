"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import type { Notification } from "@/lib/notifications";
import {
  readStateSnapshot,
  serverReadState,
  subscribeReadState,
  unreadCount,
} from "@/lib/notification-reads";

/** Ikon inline — masih sedikit, tidak perlu tarik webfont ikon. */
const icons: Record<string, string> = {
  dashboard: "M3 3h8v8H3V3zm10 0h8v5h-8V3zM3 13h8v8H3v-8zm10 3h8v5h-8v-5z",
  daftar: "M3 5h3v3H3V5zm5 0h13v3H8V5zM3 10.5h3v3H3v-3zm5 0h13v3H8v-3zM3 16h3v3H3v-3zm5 0h13v3H8v-3z",
  jenis: "M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z",
  timeline: "M3 6h11v3H3V6zm4 4.5h13v3H7v-3zM3 15h9v3H3v-3z",
  tim: "M16 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm-8 0a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm0 2c-2.7 0-8 1.3-8 4v3h9v-3c0-1 .4-2.1 1.3-3-.8-.1-1.6-.2-2.3-.2zm8 0c-.3 0-.7 0-1.1.1A5 5 0 0 1 17 16v3h7v-3c0-2.7-5.3-4-8-4z",
  lonceng: "M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22zm7-5.5-1.5-2V10a5.5 5.5 0 0 0-4-5.3V4a1.5 1.5 0 0 0-3 0v.7A5.5 5.5 0 0 0 6.5 10v4.5L5 16.5V18h14v-1.5z",
};

const NAV = [
  { href: "/", label: "Overview", icon: "dashboard" },
  { href: "/proyek", label: "Daftar Proyek", icon: "daftar" },
  { href: "/proyek/jenis", label: "Jenis Proyek", icon: "jenis" },
  { href: "/timeline", label: "Timeline", icon: "timeline" },
  { href: "/notifikasi", label: "Notifikasi", icon: "lonceng" },
  { href: "/tim", label: "Tim", icon: "tim" },
];

/* Lencana jumlah belum dibaca dihitung di klien: daftarnya datang dari server,
   tapi status bacanya ada di localStorage masing-masing peramban. Selama render
   server statusnya belum diketahui, jadi lencananya belum ditampilkan — bukan
   ditampilkan penuh lalu menyusut setelah hidrasi. */
export default function SidebarNav({
  notifications = [],
  onNavigate,
}: {
  notifications?: Notification[];
  /** Dipanggil setelah menu diklik — dipakai laci mobile untuk menutup diri. */
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const read = useSyncExternalStore(subscribeReadState, readStateSnapshot, serverReadState);
  const belumDibaca = read === null ? 0 : unreadCount(notifications, read);

  return (
    <nav
      aria-label="Navigasi utama"
      // Di laci mobile dan di sidebar desktop sama-sama menumpuk vertikal.
      className="flex flex-col gap-1 lg:mt-6"
    >
      {NAV.map(({ href, label, icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm transition-colors ${
              active
                ? "bg-background font-semibold lg:rounded-r-none lg:border-r-4 lg:border-foreground"
                : "text-muted hover:bg-background"
            }`}
          >
            <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5 shrink-0 fill-current">
              <path d={icons[icon]} />
            </svg>
            <span className="flex-1">{label}</span>
            {href === "/notifikasi" && belumDibaca > 0 && (
              <span className="ml-auto inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-high px-1.5 py-0.5 text-xs font-semibold text-on-brand tabular-nums">
                {belumDibaca}
                <span className="sr-only"> notifikasi belum dibaca</span>
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
