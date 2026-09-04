import { redirect } from "next/navigation";
import MobileNav from "@/components/MobileNav";
import SidebarNav from "@/components/SidebarNav";
import ThemeSettings from "@/components/ThemeSettings";
import UserMenu from "@/components/UserMenu";
import { getNotifications } from "@/lib/api";
import { authWajib, getSession } from "@/lib/auth";

/**
 * Kerangka aplikasi: sidebar, topbar, dan area konten.
 *
 * Dipisah ke route group `(app)` supaya halaman masuk tidak ikut memakainya —
 * menampilkan navigasi aplikasi di layar login itu keliru: isinya menu untuk
 * sesuatu yang belum boleh diakses.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sesi = await getSession();
  // Tanpa identitas, seluruh isi aplikasi tidak ada artinya — antar ke halaman
  // masuk ketimbang menampilkan kerangka kosong.
  if (!sesi) redirect("/login");

  const feed = await getNotifications();
  const currentUser = sesi.user;
  const initials = currentUser.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
      <>
      {/* Sidebar tetap di desktop; di layar kecil digantikan laci di topbar,
          supaya enam menu tidak berdesakan jadi deretan yang digulir. */}
      <aside className="hidden bg-surface lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 lg:block lg:w-[280px] lg:border-r lg:border-border lg:px-4 lg:py-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-mark text-lg font-bold text-on-mark">
            DE
          </span>
          <div className="min-w-0">
            <p className="truncate text-headline-sm font-bold">Divisi Enterprise</p>
            <p className="truncate text-xs text-muted">Jaya Survei Indonesia</p>
          </div>
        </div>
        <SidebarNav notifications={feed.items} accessLevel={currentUser.accessLevel} />
      </aside>

      <div className="lg:ml-[280px]">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b border-border bg-surface/90 px-4 backdrop-blur-md sm:px-6 lg:justify-end lg:px-8">
          <div className="flex items-center gap-2 lg:hidden">
            <MobileNav notifications={feed.items} accessLevel={currentUser.accessLevel} />
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-mark text-sm font-bold text-on-mark">
              DE
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeSettings />
            <UserMenu
              name={currentUser.name}
              initials={initials}
              assumed={sesi.source === "dev-fallback" && !authWajib()}
            />
          </div>
        </header>

        <main className="px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </div>
      </>
  );
}
