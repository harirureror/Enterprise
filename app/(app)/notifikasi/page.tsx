import NotificationList from "@/components/NotificationList";
import StatCard from "@/components/StatCard";
import { getNotifications, getReminderStatusMap, getUsers } from "@/lib/api";
import { KIND_LABELS, SOON_DAYS, STALE_DAYS } from "@/lib/notifications";
import { requireAbility } from "@/lib/auth";

// Notifikasi dihitung dari keadaan terkini, jadi halamannya tidak boleh dicache.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Notifikasi — Divisi Enterprise JSI",
  description: "Proyek yang perlu ditindaklanjuti: lewat tenggat, segera jatuh tempo, atau mandek.",
};

export default async function NotifikasiPage() {
  await requireAbility("lihat-notifikasi");

  const [feed, users, statusPengingat] = await Promise.all([
    getNotifications(),
    getUsers(),
    getReminderStatusMap(),
  ]);

  const perJenis = (Object.keys(KIND_LABELS) as (keyof typeof KIND_LABELS)[]).map((k) => ({
    kind: k,
    label: KIND_LABELS[k],
    count: feed.items.filter((n) => n.kind === k).length,
  }));

  return (
    <div className="w-full">
      <header>
        <h1 className="text-headline-lg font-semibold">Notifikasi</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Disusun otomatis dari keadaan proyek: tenggat yang lewat atau tinggal {SOON_DAYS} hari,
          proyek tanpa catatan progres {STALE_DAYS} hari, dan PIC yang menangani dua proyek
          bersamaan. Begitu penyebabnya beres, notifikasinya hilang sendiri.
        </p>
      </header>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Perlu Tindakan"
          value={feed.total}
          hint="Seluruh notifikasi aktif"
          accent={feed.counts.tinggi > 0 ? "text-high" : undefined}
          danger={feed.counts.tinggi > 0}
        />
        <StatCard label="Mendesak" value={feed.counts.tinggi} hint="Sudah lewat tenggat" accent="text-high" />
        <StatCard label="Perlu Dipantau" value={feed.counts.sedang} hint="Segera jatuh tempo atau mandek" accent="text-med" />
        <StatCard label="Informasi" value={feed.counts.info} hint="Bentrok jadwal PIC" />
      </div>

      <div className="mt-4 rounded-xl border border-border bg-surface p-4 shadow-card">
        <p className="text-label-caps font-bold text-muted uppercase">Rincian</p>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          {perJenis.map((j) => (
            <div key={j.kind}>
              <dt className="text-xs text-muted">{j.label}</dt>
              <dd className="mt-0.5 font-semibold tabular-nums">{j.count}</dd>
            </div>
          ))}
        </dl>
      </div>

      <section aria-labelledby="daftar-notifikasi" className="mt-8">
        <h2 id="daftar-notifikasi" className="text-headline-sm font-semibold">
          Daftar Tindak Lanjut
        </h2>
        <div className="mt-4">
          <NotificationList items={feed.items} users={users} reminders={statusPengingat} />
        </div>
      </section>
    </div>
  );
}
