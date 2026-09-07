"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/* Sub-navigasi tab "Rencana & Agenda".

   Dipakai bersama ketiga rute di bawah /rencana. Tab disaring menurut hak
   supaya tidak ada tautan yang ujungnya memantulkan orang kembali. */

const TABS = [
  { href: "/rencana", label: "Rencana Strategis", kunci: "rencana" as const },
  { href: "/rencana/agenda", label: "Agenda Tim", kunci: "agenda" as const },
];

export default function PlanTabs({
  bolehRencana,
  bolehAgenda,
}: {
  bolehRencana: boolean;
  bolehAgenda: boolean;
}) {
  const pathname = usePathname();
  const boleh = { rencana: bolehRencana, agenda: bolehAgenda };
  const tabs = TABS.filter((t) => boleh[t.kunci]);

  // Halaman detail (/rencana/123) tetap menandai tab Rencana sebagai aktif.
  const aktif = (href: string) =>
    href === "/rencana" ? !pathname.startsWith("/rencana/agenda") : pathname.startsWith(href);

  return (
    <nav aria-label="Bagian rencana dan agenda" className="border-b border-border">
      <ul className="flex flex-wrap gap-1">
        {tabs.map(({ href, label }) => (
          <li key={href}>
            <Link
              href={href}
              aria-current={aktif(href) ? "page" : undefined}
              className={`inline-block px-4 py-2.5 text-sm transition-colors ${
                aktif(href)
                  ? "-mb-px border-b-2 border-foreground font-semibold"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
